// Runs in the browser under `measure:capacity`: confirms deterministic Plans, then opens some of
// them with Position Changes (D2 plan, section 1.3), then adds Marks, acknowledgments and Daily
// Trade Review Actions (D4 T4.28), then deferred Position Change Reflections resolved in Reviews
// (D5 T5.19), through the production application facade on the engine's
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
async function executionJsonBytes(name: string): Promise<{ bytes: number; count: number }> {
  const trades = (await storeRecords(name, 'trades')) as { facts: { kind: string }[] }[];
  const executions = trades.flatMap((t) => t.facts.filter((f) => f.kind === 'Execution'));
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
  const strategy = strategies.items[0]!;
  const workspace = (await indexedDB.databases()).find((d) => d.name?.startsWith('tj-ws-'))!.name!;

  const pcDefinition = await app.Journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
  if (pcDefinition.kind !== 'Found') throw new Error('Position Change Reflection definition missing');
  const tradeIds: string[] = [];

  const before = await usage();
  const tradesBefore = await storeJsonBytes(workspace, 'trades');
  const journalBefore = await reflectionJsonBytes(workspace);
  for (let i = 0; i < plans; i++) {
    const symbol = SYMBOLS[i % SYMBOLS.length]!;
    const entry = 40 + (i % 160);
    const result = await app.TradeWorkflows.confirmPlan({
      accountId: account.record.id,
      accountRevision: account.record.recordRevision,
      strategyId: strategy.id,
      strategyRevision: strategy.recordRevision,
      economicTime: new Date(Date.UTC(2026, 0, 2) + i * 3_600_000).toISOString().replace('.000Z', 'Z'),
      plan: {
        underlying: symbol,
        legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol }, quantity: String(10 + (i % 90)), intendedEntry: `${entry}.25` }],
        stops: [{ kind: 'UnderlyingPrice', price: `${entry - 3}.10` }],
        targets: [{ kind: 'UnderlyingPrice', price: `${entry + 6}.80` }],
      },
      reflection: {
        definitionId: definition.definition.id,
        answers: {
          'prompt.plan-reflection.thesis': { kind: 'Text', text: `${symbol} reclaimed its 50-day average on rising volume after a tight two-week base; plan ${i}.` },
          'prompt.plan-reflection.invalidation': { kind: 'Text', text: `A daily close back inside the base, below ${entry - 3}.10.` },
          'prompt.plan-reflection.conviction': { kind: 'Scale', value: 1 + (i % 5) },
          'prompt.plan-reflection.primary-emotion': { kind: 'Option', optionId: 'option.plan-reflection.primary-emotion.calm' },
        },
      },
    });
    if (result.kind !== 'Confirmed') throw new Error(`plan ${i}: ${result.kind}`);
    tradeIds.push(result.receipt.tradeId);
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
  return {
    ...review,
    ...debt,
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
