// Runs in the browser under `measure:capacity`: confirms deterministic Plans, then opens some of
// them with Position Changes (D2 plan, section 1.3), then adds Marks, acknowledgments and Daily
// Trade Review Actions (D4 T4.28), then deferred Position Change Reflections resolved in Reviews
// (D5 T5.19), then Trades closed with a Close Reason and a Close Review (D6 T6.22), through the
// production application facade on the engine's
// real IndexedDB, and reports the storage growth of each phase.
// Readiness inputs come from NodeTestHost (no service worker here); storage is the real engine's.
import { createApplication } from '../../src/app/compose.ts';
import { createWebLocksLifecycleLock } from '../../src/persistence/index.ts';
import { randomIds } from '../../src/app/system.ts';
import { nyseSessionPolicy } from '../../src/domain/session-policy/index.ts';
import { fixedClock } from '../../src/domain/time/index.ts';
import { nodeTestHost } from '../../tests/support/node-test-host.ts';

// NodeTestHost reports 10 GB of quota; the measurement does not depend on this requirement.
const READINESS_CAPACITY = { projectedWorkspaceBytes: 1, requiredQuotaBytes: 3 };

const SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AVGO', 'COST', 'NFLX'];

async function storeRecords(name: string, store: string): Promise<unknown[]> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open(name);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('open failed'));
  });
  const records = await new Promise<unknown[]>((resolve) => {
    const request = db.transaction(store).objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result);
  });
  db.close();
  return records;
}

const encoder = new TextEncoder();
const jsonBytes = (records: readonly unknown[]) => records.reduce<number>((sum, r) => sum + encoder.encode(JSON.stringify(r)).length, 0);

async function storeJsonBytes(name: string, store: string): Promise<{ bytes: number; count: number }> {
  const records = await storeRecords(name, store);
  return { bytes: jsonBytes(records), count: records.length };
}

// Stores a reflection outcome writes: its Entry or decline and its obligation record (Plan
// Reflections have obligation records too since D2).
const REFLECTION_STORES = ['journalEntries', 'journalDeclines', 'journalObligations'] as const;
async function reflectionJsonBytes(name: string): Promise<number> {
  let sum = 0;
  for (const store of REFLECTION_STORES) sum += (await storeJsonBytes(name, store)).bytes;
  return sum;
}

// Executions live inside the Trade document as facts; their share of it is their own JSON.
async function executionJsonBytes(name: string, action?: 'Buy' | 'Sell'): Promise<{ bytes: number; count: number }> {
  const trades = (await storeRecords(name, 'trades')) as { facts: { kind: string; versions: { value: { action?: string } }[] }[] }[];
  const executions = trades.flatMap((t) => t.facts.filter((f) => f.kind === 'Execution' && (action === undefined || f.versions.at(-1)!.value.action === action)));
  return { bytes: jsonBytes(executions), count: executions.length };
}

// The Position Change Reflections settled at capture, split as the section 1.4 prices them: each
// Entry or decline with its obligation record. Called when only the Plan Reflections (which are not
// Position Change Reflections) and the Open phase's outcomes exist.
async function captureReflectionShare(name: string) {
  const entries = ((await storeRecords(name, 'journalEntries')) as { entryTypeKey: string }[]).filter(
    (e) => e.entryTypeKey === 'entry-type.position-change-reflection',
  );
  const declines = await storeRecords(name, 'journalDeclines');
  const obligations = (await storeRecords(name, 'journalObligations')) as { obligationKey: string; outcome: { kind: string } }[];
  const owed = obligations.filter((o) => o.obligationKey.startsWith('PositionChangeReflection:'));
  const share = (outcomes: readonly unknown[], kind: string) => {
    const records = owed.filter((o) => o.outcome.kind === kind);
    return { bytes: jsonBytes([...outcomes, ...records]), count: outcomes.length };
  };
  return { completed: share(entries, 'Entry'), declined: share(declines, 'Decline') };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 2_000));

// Section 1.3 at D2: each Open Trade has 1–3 Position Changes, each with 1–3 Executions (about two
// of each on average), and about 80% of the reflections are Entries and 20% declines.
const PATTERN = [1, 2, 3, 2] as const;

// Review phase (T4.28): 200 real sessions × the 10 Instruments the Open Trades hold = 2,000 Marks, 1%
// corrected; 10 earlier sessions × the 10 Instruments = 100 acknowledgments; and 10 Review Dates ×
// the 200 Open Trades = 2,000 Actions, 85% Hold and 15% Exit, Roll or Adjust with an Intent.
const MARK_SESSIONS = 200;
const ACK_SESSIONS = 10;
const REVIEW_DATES = 10;
const REVIEW_FROM = '2026-02-02';
// The last completed session the pinned clock allows; Marks and Review Dates all fall on or before it.
const LAST_SESSION = '2026-10-09';
const CORRECTED_EVERY = 100;
const ACTIONS = ['Exit', 'Roll', 'Adjust'] as const;

const usage = async () => (await navigator.storage.estimate()).usage ?? 0;

type Application = Awaited<ReturnType<typeof createApplication>>;

async function measureReviewPhase(app: Application, workspace: string, openTrades: number) {
  const covered = nyseSessionPolicy.sessionsBetween('2025-11-01', LAST_SESSION);
  if (!covered.ok) throw new Error('sessions not covered');
  const sessions = covered.value.map((s) => s.date).slice(-(MARK_SESSIONS + ACK_SESSIONS));
  const ackDates = sessions.slice(0, ACK_SESSIONS);
  const markDates = sessions.slice(ACK_SESSIONS);
  const reviewDates = markDates.filter((d) => d >= REVIEW_FROM).slice(0, REVIEW_DATES);
  if (markDates.length !== MARK_SESSIONS || reviewDates.length !== REVIEW_DATES) throw new Error('too few sessions');

  const usageBefore = await usage();
  const observationsBefore = await storeRecords(workspace, 'observations');
  const journalBefore = await reflectionJsonBytes(workspace);

  let marks = 0;
  let corrected = 0;
  for (const tradingDate of markDates) {
    for (const [s, symbol] of SYMBOLS.entries()) {
      const n = marks++;
      const price = `${40 + (s % 160)}.${String(10 + (n % 90)).padStart(2, '0')}`;
      const saved = await app.MarketData.save({
        intention: 'RecordInitialManualMark',
        instrumentKey: symbol,
        tradingDate,
        expectedResolutionRevision: 'None',
        price,
      });
      if (saved.kind !== 'Saved') throw new Error(`mark ${symbol} ${tradingDate}: ${saved.kind}`);
      if (n % CORRECTED_EVERY === 0) {
        const fix = await app.MarketData.save({
          intention: 'CorrectMark',
          instrumentKey: symbol,
          tradingDate,
          expectedResolutionRevision: saved.resolutionRevision,
          price: `${40 + (s % 160)}.${String(10 + ((n + 1) % 90)).padStart(2, '0')}`,
          reason: 'Keyed the wrong digit from the broker statement.',
        });
        if (fix.kind !== 'Saved') throw new Error(`correction ${symbol} ${tradingDate}: ${fix.kind}`);
        corrected++;
      }
    }
  }
  const observationsAfterMarks = await storeRecords(workspace, 'observations');

  let acknowledgments = 0;
  for (const tradingDate of ackDates) {
    for (const symbol of SYMBOLS) {
      acknowledgments++;
      const saved = await app.MarketData.save({
        intention: 'AssertUnavailable',
        instrumentKey: symbol,
        tradingDate,
        expectedResolutionRevision: 'None',
        reason: 'No quote available from my broker that day.',
      });
      if (saved.kind !== 'Saved') throw new Error(`acknowledgment ${symbol} ${tradingDate}: ${saved.kind}`);
    }
  }
  const observationsAfter = await storeRecords(workspace, 'observations');
  const journalBeforeActions = await reflectionJsonBytes(workspace);

  let actions = 0;
  for (const date of reviewDates) {
    const opened = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: `${date}T23:30:00Z` });
    if (opened.kind !== 'Ready' || opened.reviewDate !== date) throw new Error(`open ${date}: ${opened.kind}`);
    const trades = opened.families.flatMap((f) => (f.family === 'Trades' ? f.trades : []));
    if (trades.length !== openTrades) throw new Error(`${date}: ${trades.length} eligible Trades, expected ${openTrades}`);
    let binding = opened.binding;
    for (const item of trades) {
      const n = actions++;
      const form = await app.DailyReview.getTrade({ reviewDate: date, tradeId: item.tradeId, binding });
      if (form.kind !== 'Ready') throw new Error(`getTrade ${date}: ${form.kind}`);
      const choice = n % 20 < 3 ? ACTIONS[n % 20] : undefined;
      const saved = await app.DailyReview.save({
        kind: 'SaveTradeAction',
        binding: form.trade.saveBinding,
        action: choice ?? 'Hold',
        ...(choice && { intent: `Cut the ${item.underlying} exposure if the next close is below the stop; action ${n}.` }),
      });
      if (saved.kind !== 'Saved') throw new Error(`save ${date}: ${saved.kind}`);
      if (saved.review.kind === 'Ready') binding = saved.review.binding;
    }
  }
  await settle();
  const usageAfter = await usage();
  const observationsEnd = await storeRecords(workspace, 'observations');
  const journalAfter = await reflectionJsonBytes(workspace);

  const markRecordBytes = jsonBytes(observationsAfterMarks) - jsonBytes(observationsBefore);
  const ackRecordBytes = jsonBytes(observationsAfter) - jsonBytes(observationsAfterMarks);
  const actionBytes = journalAfter - journalBeforeActions;
  const reviewOverheadRatio =
    (usageAfter - usageBefore) / (jsonBytes(observationsEnd) - jsonBytes(observationsBefore) + journalAfter - journalBefore);
  const jsonBytesPerMark = markRecordBytes / marks;
  const jsonBytesPerAcknowledgment = ackRecordBytes / acknowledgments;
  const jsonBytesPerAction = actionBytes / actions;
  return {
    marks,
    correctedMarks: corrected,
    acknowledgments,
    actions,
    reviewOverheadRatio,
    jsonBytesPerMark,
    jsonBytesPerAcknowledgment,
    jsonBytesPerAction,
    bytesPerMark: jsonBytesPerMark * reviewOverheadRatio,
    bytesPerAcknowledgment: jsonBytesPerAcknowledgment * reviewOverheadRatio,
    bytesPerAction: jsonBytesPerAction * reviewOverheadRatio,
  };
}

// Debt phase (T5.19): 10 sessions × the 200 Open Trades = 2,000 Position Changes recorded with the
// Defer disposition, one per Trade per session. In each next session's Review, 90% of that session's
// deferred reflections are answered, 8% declined, and 2% left Outstanding (the section 1.4 split of
// the 20% that are deferred: 18%, 1.6%, 0.4%).
const DEBT_SESSIONS = 10;
const DEBT_FROM = '2026-03-02';
const DEBT_STORES = ['journalEntries', 'journalDeclines', 'journalObligations', 'journalDebts'] as const;
const DEBT_CYCLE = 50;
const DEBT_ANSWERED_BELOW = 45;
const DEBT_DECLINED_BELOW = 49;
const DEBT_ANSWERS = {
  'prompt.position-change-reflection.decision-mode': { kind: 'Option', optionId: 'option.position-change-reflection.decision-mode.as-planned' },
  'prompt.position-change-reflection.primary-emotion': { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
} as const;

async function debtStoresJsonBytes(name: string): Promise<number> {
  let sum = 0;
  for (const store of DEBT_STORES) sum += (await storeJsonBytes(name, store)).bytes;
  return sum;
}

interface StoredDebtRecord {
  obligationKey: unknown;
  versions: { status: string; entryId?: string; declineId?: string }[];
}

async function measureDebtPhase(app: Application, workspace: string, tradeIds: readonly string[], openTrades: number) {
  const covered = nyseSessionPolicy.sessionsBetween(DEBT_FROM, LAST_SESSION);
  if (!covered.ok) throw new Error('sessions not covered');
  const dates = covered.value.map((s) => s.date).slice(0, DEBT_SESSIONS + 1);
  if (dates.length !== DEBT_SESSIONS + 1) throw new Error('too few sessions');

  const usageBefore = await usage();
  const tradesBefore = (await storeJsonBytes(workspace, 'trades')).bytes;
  const storesBefore = await debtStoresJsonBytes(workspace);

  let deferred = 0;
  for (const [d, date] of dates.slice(0, DEBT_SESSIONS).entries()) {
    const reviewDate = dates[d + 1]!;
    const times: string[] = [];
    for (let i = 0; i < openTrades; i++) {
      const tradeId = tradeIds[i]!;
      const symbol = SYMBOLS[i % SYMBOLS.length]!;
      const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
      if (detail.kind !== 'Ready') throw new Error(`trade ${i}: ${detail.kind}`);
      const economicTime = new Date(Date.parse(`${date}T15:00:00Z`) + i * 60_000).toISOString().replace('.000Z', 'Z');
      times.push(economicTime);
      const recorded = await app.TradeWorkflows.recordPositionChange({
        originTradeId: tradeId,
        trades: [{ tradeId, expectedFactRevision: detail.view.factRevision }],
        members: [
          {
            kind: 'Execution' as const,
            tradeId,
            action: 'Buy' as const,
            instrument: { kind: 'Stock' as const, symbol },
            intent: { kind: 'ServesPlannedLeg' as const, plannedLegId: detail.view.plan.legs[0]!.factId },
            quantity: '1',
            price: `${40 + (i % 160)}.${String(10 + (deferred % 90)).padStart(2, '0')}`,
            fee: '0.65',
            economicTime,
          },
        ],
        reflection: { kind: 'Defer' },
      });
      if (recorded.kind !== 'Recorded') throw new Error(`defer ${date} trade ${i}: ${recorded.kind}`);
      deferred++;
    }

    const opened = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: `${reviewDate}T23:30:00Z` });
    if (opened.kind !== 'Ready' || opened.reviewDate !== reviewDate) throw new Error(`open ${reviewDate}: ${opened.kind}`);
    let binding = opened.binding;
    for (let i = 0; i < openTrades; i++) {
      const slot = (d * openTrades + i) % DEBT_CYCLE;
      if (slot >= DEBT_DECLINED_BELOW) continue;
      const form = await app.DailyReview.getTrade({ reviewDate, tradeId: tradeIds[i]!, binding });
      if (form.kind !== 'Ready') throw new Error(`getTrade ${reviewDate}: ${form.kind}`);
      const owed = form.trade.reflections.find((r) => r.economicTime === times[i]);
      if (!owed) throw new Error(`no reflection for trade ${i} at ${times[i]}`);
      const saved = await app.DailyReview.save({
        kind: 'ResolveReviewDebt',
        reviewDate,
        binding: owed.saveBinding,
        resolution:
          slot < DEBT_ANSWERED_BELOW
            ? {
                kind: 'Answer',
                answers: {
                  ...DEBT_ANSWERS,
                  'prompt.position-change-reflection.decision-confidence': { kind: 'Scale', value: 1 + (slot % 5) },
                  ...(slot % 2 === 0 && {
                    'prompt.position-change-reflection.note': { kind: 'Text', text: `Scaled in at the planned level on ${SYMBOLS[i % SYMBOLS.length]!}; recalled at the Review ${slot}.` },
                  }),
                },
              }
            : { kind: 'Decline', ...(slot % 2 === 0 && { reason: 'Cannot recall the moment well enough to say.' }) },
      });
      if (saved.kind !== 'DebtResolved') throw new Error(`resolve ${reviewDate} trade ${i}: ${saved.kind}`);
      if (saved.review.kind === 'Ready') binding = saved.review.binding;
    }
  }
  await settle();
  const usageAfter = await usage();
  const tradesAfter = (await storeJsonBytes(workspace, 'trades')).bytes;
  const storesAfter = await debtStoresJsonBytes(workspace);

  // Each Debt's share: its record with the version chain, its obligation record, and the Entry or
  // decline that settled it. Every record of the four stores that these reach was written here.
  const debts = (await storeRecords(workspace, 'journalDebts')) as StoredDebtRecord[];
  const obligations = new Map(
    ((await storeRecords(workspace, 'journalObligations')) as { obligationKey: unknown }[]).map((o) => [JSON.stringify(o.obligationKey), o]),
  );
  const entries = new Map(((await storeRecords(workspace, 'journalEntries')) as { id: string }[]).map((e) => [e.id, e]));
  const declines = new Map(((await storeRecords(workspace, 'journalDeclines')) as { id: string }[]).map((e) => [e.id, e]));
  const share = { Settled: { bytes: 0, count: 0 }, Declined: { bytes: 0, count: 0 }, Outstanding: { bytes: 0, count: 0 } } as Record<string, { bytes: number; count: number }>;
  // The Entry or decline that settled a Debt version; an Outstanding Debt has neither.
  const settlingRecord = (version: StoredDebtRecord['versions'][number]) => {
    if (version.entryId !== undefined) return entries.get(version.entryId);
    if (version.declineId !== undefined) return declines.get(version.declineId);
    return undefined;
  };
  for (const debt of debts) {
    const last = debt.versions.at(-1)!;
    const outcome = settlingRecord(last);
    const bucket = share[last.status]!;
    bucket.bytes += jsonBytes([debt, obligations.get(JSON.stringify(debt.obligationKey)), ...(outcome ? [outcome] : [])]);
    bucket.count++;
  }
  if (debts.length !== deferred) throw new Error(`${debts.length} Debts for ${deferred} deferrals`);

  const debtOverheadRatio = (usageAfter - usageBefore) / (tradesAfter - tradesBefore + storesAfter - storesBefore);
  const perDebt = (status: string) => share[status]!.bytes / share[status]!.count;
  return {
    debtsDeferred: deferred,
    debtsAnswered: share['Settled']!.count,
    debtsDeclined: share['Declined']!.count,
    debtsOutstanding: share['Outstanding']!.count,
    debtOverheadRatio,
    jsonBytesPerDebtAnswered: perDebt('Settled'),
    jsonBytesPerDebtDeclined: perDebt('Declined'),
    jsonBytesPerDebtOutstanding: perDebt('Outstanding'),
    bytesPerDebtAnswered: perDebt('Settled') * debtOverheadRatio,
    bytesPerDebtDeclined: perDebt('Declined') * debtOverheadRatio,
    bytesPerDebtOutstanding: perDebt('Outstanding') * debtOverheadRatio,
  };
}

// Close phase (T6.22): 10 rounds of 200 = 2,000 Trades, each planned, entered (1–3 Position Changes of 1–3
// Executions) and then closed on the round's exit session by 1–3 exit Position Changes of 1–3 Sell
// Executions, the last of which sells the whole Position and carries a Close Reason and the Close Review
// disposition. The Close Review split is D5 section 1.4 (D6 section 1.4): per 500 Trades 325 are completed
// at capture, 75 declined, and 100 deferred; the next session's Review answers 90 of those, declines 8,
// and leaves 2 Outstanding. Close Reasons run 30% Target Reached, 35% Stop Triggered, 15% Thesis
// Invalidated, 20% Time-Based Exit. Rounds are separate so that only 200 Trades are ever Open and walked.
const CLOSE_ROUNDS = 10;
const CLOSE_PER_ROUND = 200;
const CLOSE_FROM = '2026-04-01';
const CLOSE_CYCLE = 500;
const CLOSE_COMPLETED_BELOW = 325;
const CLOSE_DECLINED_BELOW = 400;
const CLOSE_ANSWERED_BELOW = 490;
const CLOSE_DEFERRED_DECLINED_BELOW = 498;
const CLOSE_STORES = ['journalEntries', 'journalDeclines', 'journalObligations', 'journalDebts'] as const;
const CLOSE_REASON_BY_FIFTH_OF_TWENTY: readonly string[] = [
  ...Array<string>(6).fill('Target Reached'),
  ...Array<string>(7).fill('Stop Triggered'),
  ...Array<string>(3).fill('Thesis Invalidated'),
  ...Array<string>(4).fill('Time-Based Exit'),
];

interface StoredObligation {
  obligationKey: string | string[];
  outcome: { kind: 'Entry' | 'Decline' | 'Debt'; id: string };
}

async function closeStoresJsonBytes(name: string): Promise<number> {
  let sum = 0;
  for (const store of CLOSE_STORES) sum += (await storeJsonBytes(name, store)).bytes;
  return sum;
}

interface PlanContext {
  accountId: string;
  accountRevision: Parameters<Application['TradeWorkflows']['confirmPlan']>[0]['accountRevision'];
  strategyId: string;
  strategyRevision: Parameters<Application['TradeWorkflows']['confirmPlan']>[0]['strategyRevision'];
  planDefinitionId: string;
}

// The i-th Plan with its Plan Reflection, confirmed at the given instant; returns the Trade identity.
async function confirmMeasuredPlan(app: Application, context: PlanContext, i: number, planTime: number): Promise<string> {
  const symbol = SYMBOLS[i % SYMBOLS.length]!;
  const entry = 40 + (i % 160);
  const result = await app.TradeWorkflows.confirmPlan({
    accountId: context.accountId,
    accountRevision: context.accountRevision,
    strategyId: context.strategyId,
    strategyRevision: context.strategyRevision,
    economicTime: new Date(planTime).toISOString().replace('.000Z', 'Z'),
    plan: {
      underlying: symbol,
      legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol }, quantity: String(10 + (i % 90)), intendedEntry: `${entry}.25` }],
      stops: [{ kind: 'UnderlyingPrice', price: `${entry - 3}.10` }],
      targets: [{ kind: 'UnderlyingPrice', price: `${entry + 6}.80` }],
    },
    reflection: {
      definitionId: context.planDefinitionId,
      answers: {
        'prompt.plan-reflection.thesis': { kind: 'Text', text: `${symbol} reclaimed its 50-day average on rising volume after a tight two-week base; plan ${i}.` },
        'prompt.plan-reflection.invalidation': { kind: 'Text', text: `A daily close back inside the base, below ${entry - 3}.10.` },
        'prompt.plan-reflection.conviction': { kind: 'Scale', value: 1 + (i % 5) },
        'prompt.plan-reflection.primary-emotion': { kind: 'Option', optionId: 'option.plan-reflection.primary-emotion.calm' },
      },
    },
  });
  if (result.kind !== 'Confirmed') throw new Error(`plan ${i}: ${result.kind}`);
  return result.receipt.tradeId;
}

async function measureClosePhase(app: Application, workspace: string, context: PlanContext, pcDefinitionId: string) {
  const closeReasons = await app.ReferenceCatalog.query({ family: 'CloseReason' });
  const closeReviewDefinition = await app.Journal.getDefinitions({ latestFor: 'entry-type.close-review' });
  if (closeReasons.kind !== 'Page' || closeReviewDefinition.kind !== 'Found') throw new Error('Close Reason or Close Review seed missing');
  const reasonId = (label: string) => {
    const found = closeReasons.items.find((r) => r.label === label);
    if (!found) throw new Error(`no Close Reason ${label}`);
    return found.id;
  };
  const closeReviewDefinitionId = closeReviewDefinition.definition.id;
  const covered = nyseSessionPolicy.sessionsBetween(CLOSE_FROM, LAST_SESSION);
  if (!covered.ok) throw new Error('sessions not covered');
  const dates = covered.value.map((s) => s.date).slice(0, 2 * CLOSE_ROUNDS);
  if (dates.length !== 2 * CLOSE_ROUNDS) throw new Error('too few sessions');
  const planBase = Date.UTC(2026, 0, 5);
  const decline = { kind: 'Decline' as const, definitionId: pcDefinitionId };

  let usageDelta = 0;
  let jsonDelta = 0;
  let tradesGrowth = 0;
  let sellBytes = 0;
  let exitPositionChanges = 0;
  let exitExecutions = 0;
  let closed = 0;
  for (let r = 0; r < CLOSE_ROUNDS; r++) {
    const exitDate = dates[2 * r]!;
    const reviewDate = dates[2 * r + 1]!;
    // Setup, not measured: Plans and their entries.
    const round: { tradeId: string; symbol: string; shares: number; planLeg: string }[] = [];
    for (let i = 0; i < CLOSE_PER_ROUND; i++) {
      const n = r * CLOSE_PER_ROUND + i;
      const symbol = SYMBOLS[n % SYMBOLS.length]!;
      const planTime = planBase + n * 1_800_000;
      const tradeId = await confirmMeasuredPlan(app, context, n, planTime);
      let shares = 0;
      let planLeg = '';
      for (let k = 0; k < PATTERN[n % PATTERN.length]!; k++) {
        const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
        if (detail.kind !== 'Ready') throw new Error(`close trade ${n}: ${detail.kind}`);
        planLeg = detail.view.plan.legs[0]!.factId;
        const fills = PATTERN[(n + k) % PATTERN.length]!;
        const recorded = await app.TradeWorkflows.recordPositionChange({
          originTradeId: tradeId,
          trades: [{ tradeId, expectedFactRevision: detail.view.factRevision }],
          members: Array.from({ length: fills }, (_, j) => ({
            kind: 'Execution' as const,
            tradeId,
            action: 'Buy' as const,
            instrument: { kind: 'Stock' as const, symbol },
            intent: { kind: 'ServesPlannedLeg' as const, plannedLegId: planLeg },
            quantity: '10',
            price: `${40 + (n % 160)}.${String(10 + ((n + j) % 90)).padStart(2, '0')}`,
            fee: '0.65',
            economicTime: new Date(planTime + (k + 1) * 86_400_000 + j * 60_000).toISOString().replace('.000Z', 'Z'),
          })),
          reflection: decline,
        });
        if (recorded.kind !== 'Recorded') throw new Error(`close trade ${n} entry ${k}: ${recorded.kind}`);
        shares += fills * 10;
      }
      round.push({ tradeId, symbol, shares, planLeg });
    }
    await settle();

    // Measured: the exits with their Close Reason and Close Review disposition, then the Review that
    // resolves the deferred Close Reviews.
    const usageBefore = await usage();
    const tradesBefore = (await storeJsonBytes(workspace, 'trades')).bytes;
    const storesBefore = await closeStoresJsonBytes(workspace);
    const sellsBefore = await executionJsonBytes(workspace, 'Sell');
    for (const [i, { tradeId, symbol, shares, planLeg }] of round.entries()) {
      const n = r * CLOSE_PER_ROUND + i;
      const slot = n % CLOSE_CYCLE;
      const exits = PATTERN[(n + 1) % PATTERN.length]!;
      const fillsOf = (k: number) => PATTERN[(n + k + 2) % PATTERN.length]!;
      let totalFills = 0;
      for (let k = 0; k < exits; k++) totalFills += fillsOf(k);
      let soldFills = 0;
      for (let k = 0; k < exits; k++) {
        const terminal = k === exits - 1;
        const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
        if (detail.kind !== 'Ready') throw new Error(`close trade ${n}: ${detail.kind}`);
        const members = Array.from({ length: fillsOf(k) }, (_, j) => {
          soldFills++;
          const economicTime = new Date(Date.parse(`${exitDate}T14:00:00Z`) + i * 60_000 + (k * 3 + j) * 1_000).toISOString().replace('.000Z', 'Z');
          return {
            kind: 'Execution' as const,
            tradeId,
            action: 'Sell' as const,
            instrument: { kind: 'Stock' as const, symbol },
            intent: { kind: 'ServesPlannedLeg' as const, plannedLegId: planLeg },
            // Every Execution but the last sells one share; the last sells what remains.
            quantity: String(soldFills === totalFills ? shares - (totalFills - 1) : 1),
            price: `${42 + (n % 160)}.${String(10 + ((n + j) % 90)).padStart(2, '0')}`,
            fee: '0.65',
            economicTime,
          };
        });
        const closeReview =
          slot < CLOSE_COMPLETED_BELOW
            ? {
                kind: 'Complete' as const,
                form: {
                  definitionId: closeReviewDefinitionId,
                  answers: {
                    'prompt.close-review.take-again': { kind: 'Option' as const, optionId: 'option.close-review.take-again.yes-as-planned' },
                    ...(n % 2 === 0 && {
                      'prompt.close-review.what-worked': { kind: 'Text' as const, text: `The ${symbol} entry held its level and the stop was respected; trade ${n}.` },
                      'prompt.close-review.key-lesson': { kind: 'Text' as const, text: 'Scale out into strength instead of waiting for the full target.' },
                    }),
                  },
                },
              }
            : slot < CLOSE_DECLINED_BELOW
              ? { kind: 'Decline' as const, definitionId: closeReviewDefinitionId, ...(n % 2 === 0 && { reason: 'Nothing new to learn from this one.' }) }
              : { kind: 'Defer' as const };
        const recorded = await app.TradeWorkflows.recordPositionChange({
          originTradeId: tradeId,
          trades: [{ tradeId, expectedFactRevision: detail.view.factRevision }],
          members,
          reflection: decline,
          ...(terminal && { closeReasonId: reasonId(CLOSE_REASON_BY_FIFTH_OF_TWENTY[n % 20]!), closeReview }),
        });
        if (recorded.kind !== 'Recorded') throw new Error(`close trade ${n} exit ${k}: ${recorded.kind}`);
        exitPositionChanges++;
        exitExecutions += fillsOf(k);
      }
      closed++;
    }
    const tradesAfterExits = (await storeJsonBytes(workspace, 'trades')).bytes;
    const sellsAfter = await executionJsonBytes(workspace, 'Sell');
    tradesGrowth += tradesAfterExits - tradesBefore;
    sellBytes += sellsAfter.bytes - sellsBefore.bytes;

    // The next session's Review answers or declines the deferred Close Reviews that fall due.
    const opened = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: `${reviewDate}T23:30:00Z` });
    if (opened.kind !== 'Ready' || opened.reviewDate !== reviewDate) throw new Error(`open ${reviewDate}: ${opened.kind}`);
    let binding = opened.binding;
    for (const [i, { tradeId, symbol }] of round.entries()) {
      const n = r * CLOSE_PER_ROUND + i;
      const slot = n % CLOSE_CYCLE;
      if (slot < CLOSE_DECLINED_BELOW || slot >= CLOSE_DEFERRED_DECLINED_BELOW) continue;
      const form = await app.DailyReview.getTrade({ reviewDate, tradeId, binding });
      if (form.kind !== 'ReflectionsOwed') throw new Error(`getTrade ${reviewDate} close trade ${n}: ${form.kind}`);
      if (form.card.reflections.length !== 1) throw new Error(`close trade ${n}: ${form.card.reflections.length} owed reflections`);
      const saved = await app.DailyReview.save({
        kind: 'ResolveReviewDebt',
        reviewDate,
        binding: form.card.reflections[0]!.saveBinding,
        resolution:
          slot < CLOSE_ANSWERED_BELOW
            ? {
                kind: 'Answer',
                answers: {
                  'prompt.close-review.take-again': { kind: 'Option', optionId: 'option.close-review.take-again.yes-with-changes' },
                  ...(n % 2 === 0 && {
                    'prompt.close-review.what-worked': { kind: 'Text', text: `Recalled at the Review: the ${symbol} exit was earlier than planned; trade ${n}.` },
                  }),
                },
              }
            : { kind: 'Decline', ...(n % 2 === 0 && { reason: 'Cannot recall the Trade well enough to say.' }) },
      });
      if (saved.kind !== 'DebtResolved') throw new Error(`resolve ${reviewDate} close trade ${n}: ${saved.kind}`);
      if (saved.review.kind === 'Ready') binding = saved.review.binding;
    }
    await settle();
    const usageAfter = await usage();
    usageDelta += usageAfter - usageBefore;
    jsonDelta += (await storeJsonBytes(workspace, 'trades')).bytes - tradesBefore + (await closeStoresJsonBytes(workspace)) - storesBefore;
  }

  // Each Close Review outcome's share, by the obligation it settles: an Entry or decline with its
  // obligation record, or a Debt with its obligation record and the Entry or decline that settled it.
  const entries = new Map(((await storeRecords(workspace, 'journalEntries')) as { id: string }[]).map((e) => [e.id, e]));
  const declines = new Map(((await storeRecords(workspace, 'journalDeclines')) as { id: string }[]).map((e) => [e.id, e]));
  // Daily Trade Review obligations are keyed by an array; the others by a string.
  const obligations = ((await storeRecords(workspace, 'journalObligations')) as StoredObligation[]).filter(
    (o) => typeof o.obligationKey === 'string' && o.obligationKey.startsWith('CloseReview:'),
  );
  const debts = ((await storeRecords(workspace, 'journalDebts')) as { obligationKey: string; versions: { status: string; entryId?: string; declineId?: string }[] }[]).filter(
    (d) => d.obligationKey.startsWith('CloseReview:'),
  );
  const debtByKey = new Map(debts.map((d) => [d.obligationKey, d]));
  const share = {
    completed: { bytes: 0, count: 0 },
    declined: { bytes: 0, count: 0 },
    answered: { bytes: 0, count: 0 },
    debtDeclined: { bytes: 0, count: 0 },
    outstanding: { bytes: 0, count: 0 },
  };
  for (const o of obligations) {
    // A settled Debt's obligation points at the Entry or decline that settled it, so a Debt is found first.
    const debt = debtByKey.get(o.obligationKey as string);
    if (!debt && o.outcome.kind === 'Entry') {
      share.completed.bytes += jsonBytes([o, entries.get(o.outcome.id)]);
      share.completed.count++;
    } else if (!debt && o.outcome.kind === 'Decline') {
      share.declined.bytes += jsonBytes([o, declines.get(o.outcome.id)]);
      share.declined.count++;
    } else {
      if (!debt) throw new Error(`no Debt for ${String(o.obligationKey)}`);
      const last = debt.versions.at(-1)!;
      const outcome = last.entryId !== undefined ? entries.get(last.entryId) : last.declineId !== undefined ? declines.get(last.declineId) : undefined;
      const bucket = last.status === 'Settled' ? share.answered : last.status === 'Declined' ? share.debtDeclined : share.outstanding;
      bucket.bytes += jsonBytes([debt, o, ...(outcome ? [outcome] : [])]);
      bucket.count++;
    }
  }
  if (closed !== CLOSE_ROUNDS * CLOSE_PER_ROUND || obligations.length !== closed) throw new Error(`${obligations.length} Close Review obligations for ${closed} Trades`);
  const cycles = closed / CLOSE_CYCLE;
  const counts = [share.completed.count, share.declined.count, share.answered.count, share.debtDeclined.count, share.outstanding.count];
  const expected = [325, 75, 90, 8, 2].map((c) => c * cycles);
  if (counts.some((c, k) => c !== expected[k])) throw new Error(`Close Review split ${counts.join('/')}, expected ${expected.join('/')}`);

  const closeOverheadRatio = usageDelta / jsonDelta;
  const per = (s: { bytes: number; count: number }) => s.bytes / s.count;
  const jsonBytesPerExitPositionChange = (tradesGrowth - sellBytes) / exitPositionChanges;
  const jsonBytesPerExitExecution = sellBytes / exitExecutions;
  return {
    closedTrades: closed,
    exitPositionChanges,
    exitExecutions,
    closeReviewsCompletedAtCapture: share.completed.count,
    closeReviewsDeclinedAtCapture: share.declined.count,
    closeReviewDebtsAnswered: share.answered.count,
    closeReviewDebtsDeclined: share.debtDeclined.count,
    closeReviewDebtsOutstanding: share.outstanding.count,
    closeOverheadRatio,
    jsonBytesPerExitPositionChange,
    jsonBytesPerExitExecution,
    jsonBytesPerCloseReviewCompletedAtCapture: per(share.completed),
    jsonBytesPerCloseReviewDeclinedAtCapture: per(share.declined),
    jsonBytesPerCloseReviewDebtAnswered: per(share.answered),
    jsonBytesPerCloseReviewDebtDeclined: per(share.debtDeclined),
    jsonBytesPerCloseReviewDebtOutstanding: per(share.outstanding),
    bytesPerExitPositionChange: jsonBytesPerExitPositionChange * closeOverheadRatio,
    bytesPerExitExecution: jsonBytesPerExitExecution * closeOverheadRatio,
    bytesPerCloseReviewCompletedAtCapture: per(share.completed) * closeOverheadRatio,
    bytesPerCloseReviewDeclinedAtCapture: per(share.declined) * closeOverheadRatio,
    bytesPerCloseReviewDebtAnswered: per(share.answered) * closeOverheadRatio,
    bytesPerCloseReviewDebtDeclined: per(share.debtDeclined) * closeOverheadRatio,
    bytesPerCloseReviewDebtOutstanding: per(share.outstanding) * closeOverheadRatio,
  };
}

async function measure(plans: number, openTrades: number) {
  const testHost = await nodeTestHost(indexedDB);
  const app = await createApplication({
    indexedDB,
    host: testHost.host,
    clock: fixedClock('2026-10-12T21:00:00Z'),
    ids: randomIds,
    releaseId: testHost.releaseId,
    capacityRequirement: READINESS_CAPACITY,
    locks: createWebLocksLifecycleLock(navigator.locks),
  });
  await app.Workspace.initialize({ timeZone: 'America/New_York' });
  const institution = await app.ReferenceCatalog.save({ kind: 'CreateInstitution', label: 'Fidelity' });
  if (institution.kind !== 'Saved') throw new Error('institution not saved');
  const account = await app.ReferenceCatalog.save({ kind: 'CreateAccount', institutionId: institution.record.id, label: 'Individual Brokerage' });
  if (account.kind !== 'Saved') throw new Error('account not saved');
  const strategies = await app.ReferenceCatalog.query({ family: 'Strategy' });
  const definition = await app.Journal.getDefinitions({ latestFor: 'entry-type.plan-reflection' });
  if (strategies.kind !== 'Page' || definition.kind !== 'Found') throw new Error('seed missing');
  const strategy = strategies.items.find((r) => r.kind === 'Strategy' && r.productKey === 'strategy.long-stock')!;
  const workspace = (await indexedDB.databases()).find((d) => d.name?.startsWith('tj-ws-'))!.name!;

  const pcDefinition = await app.Journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
  if (pcDefinition.kind !== 'Found') throw new Error('Position Change Reflection definition missing');
  const tradeIds: string[] = [];

  const before = await usage();
  const tradesBefore = await storeJsonBytes(workspace, 'trades');
  const journalBefore = await reflectionJsonBytes(workspace);
  const planContext: PlanContext = {
    accountId: account.record.id,
    accountRevision: account.record.recordRevision,
    strategyId: strategy.id,
    strategyRevision: strategy.recordRevision,
    planDefinitionId: definition.definition.id,
  };
  for (let i = 0; i < plans; i++) {
    tradeIds.push(await confirmMeasuredPlan(app, planContext, i, Date.UTC(2026, 0, 2) + i * 3_600_000));
  }
  // Let the engine settle its files before the second estimate.
  await settle();
  const after = await usage();
  const trades = await storeJsonBytes(workspace, 'trades');
  const journal = await reflectionJsonBytes(workspace);
  const catalog = await storeJsonBytes(workspace, 'catalog');

  const bytesPerTradeWithReflection = (after - before) / plans;
  const jsonBytesPerTradeWithReflection = (trades.bytes - tradesBefore.bytes + journal - journalBefore) / plans;

  // Second phase: open the first `openTrades` Plans with Position Changes and their reflections.
  const executionsBefore = await executionJsonBytes(workspace);
  let positionChanges = 0;
  let declines = 0;
  for (let i = 0; i < openTrades; i++) {
    const tradeId = tradeIds[i]!;
    const symbol = SYMBOLS[i % SYMBOLS.length]!;
    const planTime = Date.UTC(2026, 0, 2) + i * 3_600_000;
    for (let k = 0; k < PATTERN[i % PATTERN.length]!; k++) {
      const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
      if (detail.kind !== 'Ready') throw new Error(`trade ${i}: ${detail.kind}`);
      const n = positionChanges++;
      const fills = PATTERN[n % PATTERN.length]!;
      const members = Array.from({ length: fills }, (_, j) => ({
        kind: 'Execution' as const,
        tradeId,
        action: 'Buy' as const,
        instrument: { kind: 'Stock' as const, symbol },
        intent: { kind: 'ServesPlannedLeg' as const, plannedLegId: detail.view.plan.legs[0]!.factId },
        quantity: '1',
        price: `${40 + (i % 160)}.${String(10 + ((n + j) % 90)).padStart(2, '0')}`,
        fee: '0.65',
        economicTime: new Date(planTime + (k + 1) * 86_400_000 + j * 60_000).toISOString().replace('.000Z', 'Z'),
      }));
      const decline = n % 5 === 4;
      if (decline) declines++;
      const reflection = decline
        ? {
            kind: 'Decline' as const,
            definitionId: pcDefinition.definition.id,
            ...(n % 2 === 0 && { reason: 'Filled during a fast open; no time to reflect.' }),
          }
        : {
            kind: 'Complete' as const,
            form: {
              definitionId: pcDefinition.definition.id,
              answers: {
                'prompt.position-change-reflection.decision-mode': {
                  kind: 'Option' as const,
                  optionId: 'option.position-change-reflection.decision-mode.as-planned',
                },
                'prompt.position-change-reflection.primary-emotion': {
                  kind: 'Option' as const,
                  optionId: 'option.position-change-reflection.primary-emotion.calm',
                },
                'prompt.position-change-reflection.decision-confidence': { kind: 'Scale' as const, value: 1 + (n % 5) },
                ...(n % 2 === 0 && {
                  'prompt.position-change-reflection.note': {
                    kind: 'Text' as const,
                    text: `Scaled in at the planned level on ${symbol}; entry ${n}.`,
                  },
                }),
              },
            },
          };
      const recorded = await app.TradeWorkflows.recordPositionChange({
        originTradeId: tradeId,
        trades: [{ tradeId, expectedFactRevision: detail.view.factRevision }],
        members,
        reflection,
      });
      if (recorded.kind !== 'Recorded') throw new Error(`trade ${i} change ${k}: ${recorded.kind}`);
    }
  }
  await settle();
  const afterOpen = await usage();
  const tradesOpen = await storeJsonBytes(workspace, 'trades');
  const executions = await executionJsonBytes(workspace);
  const reflectionAfter = await reflectionJsonBytes(workspace);

  // The phase's on-disk bytes per JSON byte, as D1 measured the Plan phase; each kind's share of
  // the phase is its own JSON. The Trade document's growth beyond its Executions (the Position
  // Change fact, Last Activity, counters, any recorded Deviations) is the Position Change's.
  const jsonBytesPerExecution = (executions.bytes - executionsBefore.bytes) / (executions.count - executionsBefore.count);
  const jsonBytesPerPositionChange = (tradesOpen.bytes - trades.bytes - (executions.bytes - executionsBefore.bytes)) / positionChanges;
  const atCapture = await captureReflectionShare(workspace);
  if (atCapture.completed.count !== positionChanges - declines || atCapture.declined.count !== declines) {
    throw new Error(`${atCapture.completed.count} Entries and ${atCapture.declined.count} declines for ${positionChanges} Position Changes`);
  }
  const jsonBytesPerReflectionCompletedAtCapture = atCapture.completed.bytes / atCapture.completed.count;
  const jsonBytesPerReflectionDeclinedAtCapture = atCapture.declined.bytes / atCapture.declined.count;
  const positionChangeOverheadRatio = (afterOpen - after) / (tradesOpen.bytes - trades.bytes + reflectionAfter - journal);
  const review = await measureReviewPhase(app, workspace, openTrades);
  const debt = await measureDebtPhase(app, workspace, tradeIds, openTrades);
  const close = await measureClosePhase(app, workspace, planContext, pcDefinition.definition.id);
  return {
    ...review,
    ...debt,
    ...close,
    plans,
    usageBefore: before,
    usageAfter: after,
    bytesPerTradeWithReflection,
    jsonBytesPerTradeWithReflection,
    overheadRatio: bytesPerTradeWithReflection / jsonBytesPerTradeWithReflection,
    jsonBytesPerCatalogRecord: catalog.bytes / catalog.count,
    openTrades,
    positionChanges,
    executions: executions.count - executionsBefore.count,
    reflectionEntries: positionChanges - declines,
    reflectionDeclines: declines,
    usageAfterOpen: afterOpen,
    positionChangeOverheadRatio,
    jsonBytesPerPositionChange,
    jsonBytesPerExecution,
    jsonBytesPerReflectionCompletedAtCapture,
    jsonBytesPerReflectionDeclinedAtCapture,
    bytesPerPositionChange: jsonBytesPerPositionChange * positionChangeOverheadRatio,
    bytesPerExecution: jsonBytesPerExecution * positionChangeOverheadRatio,
    bytesPerReflectionCompletedAtCapture: jsonBytesPerReflectionCompletedAtCapture * positionChangeOverheadRatio,
    bytesPerReflectionDeclinedAtCapture: jsonBytesPerReflectionDeclinedAtCapture * positionChangeOverheadRatio,
  };
}

declare global {
  interface Window {
    measureCapacity?: typeof measure;
  }
}
window.measureCapacity = measure;
