// The bench build's generator entry point (D2 T2.20). Only `vite build --mode bench` reaches this
// module; the production bundle never imports it (`verify:no-fault-hooks` searches dist/ for the
// marker and `__tjBench`). It creates the plan's section 1.3 dataset through the production
// application facade on the real browser host, with seeded identities and a clock that starts at
// 2024-01-02 and moves forward with the generated Economic Times. From D4 (T4.30) it simulates the
// trader session by session: after each session's completion it saves that session's Marks for
// the 150 Instruments the Open Trades hold, opens the Daily Review, and saves an Action for each
// eligible Trade. From D5 (T5.21) a Position Change's reflection is completed, declined, or deferred
// by the plan's section 1.4 split, and each session's Review first resolves the deferred
// reflections that have fallen due (answer or decline). While it runs, and only then,
// mutations skip the per-mutation readiness recheck (D1 A4, D2 section 6.0).
import { CAPACITY_REQUIREMENT } from '../delivery/capacity.ts';
import { browserHost } from '../delivery/browser-host.ts';
import { RELEASE_ID } from '../delivery/release-identity.ts';
import type { Clock } from '../domain/time/index.ts';
import { createWebLocksLifecycleLock, type IdGenerator } from '../persistence/index.ts';
import {
  BENCH_CLOCK_START,
  BENCH_DISPOSITIONS,
  BENCH_GENERATOR_MARKER,
  BENCH_GENERATOR_VERSION,
  BENCH_PROFILE,
  BENCH_SEED,
  BENCH_TIME_ZONE,
  type BenchAsOf,
  type BenchCounts,
  type BenchDisposition,
  type BenchOutstandingDebt,
} from './bench.ts';
import { createApplication, type Application } from './compose.ts';
import type { ActionChoice, DailyTradeReview, PostSaveReview } from '../coordinators/daily-review/index.ts';
import type { AnswerInput } from '../modules/journal/index.ts';

// mulberry32: a small seeded generator, so every run produces the same identities.
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

// Version-4-shaped identities from the seeded generator.
function seededIds(seed: number): IdGenerator {
  const random = seededRandom(seed);
  const hex = (n: number) =>
    Array.from({ length: n }, () =>
      Math.floor(random() * 16)
        .toString(16)
        .toLowerCase(),
    ).join('');
  return { next: () => `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(random() * 4)]}${hex(3)}-${hex(12)}` };
}

const MINUTE = 60_000;
const ACTIONS = ['Exit', 'Roll', 'Adjust'] as const;
const iso = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z');

// One simulated session. The completion is the close plus the policy's 30-minute buffer.
interface Session {
  readonly date: string;
  readonly close: string;
  readonly completion: string;
}
const COMPLETION_BUFFER = 30 * MINUTE;
const COVERAGE_END = '2028-12-31';

// The real sessions from the clock start through the end of session-policy coverage, asked of Market
// Data (only it sees the policy, A39): for each calendar day, the latest completed session as of that
// day's end is the day itself exactly when the day is a session. 1,255 sessions, the last on
// 2028-12-29 (the plan says about 1,260).
async function realSessions(app: Application): Promise<readonly Session[]> {
  const sessions: Session[] = [];
  for (let day = Date.parse(BENCH_CLOCK_START.slice(0, 10)); new Date(day).toISOString().slice(0, 10) <= COVERAGE_END; day += 86_400_000) {
    const date = new Date(day).toISOString().slice(0, 10);
    const found = await app.MarketData.query({ kind: 'ResolveSession', context: { kind: 'Current', asOf: `${date}T23:59:00Z` } });
    if (found.kind !== 'Session') throw new Error(`session ${date}: ${found.kind}`);
    if (found.tradingDate === date) sessions.push({ date, close: found.closeInstant, completion: iso(Date.parse(found.closeInstant) + COMPLETION_BUFFER) });
  }
  return sessions;
}

const SYMBOLS = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AVGO', 'COST', 'NFLX', 'CSCO', 'KO', 'PFE', 'JPM', 'V', 'MA', 'UNH', 'HD',
  'PG', 'XOM', 'CVX', 'LLY', 'ABBV', 'MRK', 'PEP', 'ADBE', 'CRM', 'ORCL', 'AMD', 'INTC', 'QCOM', 'TXN', 'WMT', 'DIS', 'NKE', 'MCD',
  'BA', 'CAT', 'DE', 'GS',
];
// The 150 Instruments the Open Trades hold: the 40 above and 110 synthetic three-letter symbols.
const INSTRUMENTS: readonly string[] = [
  ...SYMBOLS,
  ...Array.from({ length: BENCH_PROFILE.instruments - SYMBOLS.length }, (_, k) => `Q${String.fromCharCode(65 + Math.floor(k / 26))}${String.fromCharCode(65 + (k % 26))}`),
];
const PLAN_EMOTIONS = ['calm', 'eager', 'anxious', 'fomo', 'relieved'];
const DECISION_MODES = ['as-planned', 'deliberate-adjustment', 'reactive'];
const PC_EMOTIONS = ['calm', 'eager', 'anxious', 'relieved'];
// Each Open Trade has 1–3 Position Changes and each has 1–3 Executions: two of each on average.
const PATTERN = [1, 2, 3, 2] as const;
// The Open Trades' total entered quantity as tenths of the planned quantity: some still
// entering, most resolved at plan, some above plan (an Entry Size Excess).
const FILL_TENTHS = [10, 6, 10, 12, 10] as const;
// Every 125th Trade (from the 62nd) is opened, so Open Trades span the five years.
const OPEN_EVERY = BENCH_PROFILE.trades / BENCH_PROFILE.openTrades;
const OPEN_OFFSET = Math.floor(OPEN_EVERY / 2);
// Open Trade k holds Instrument k mod 150, so 50 Instruments are shared by two Trades.
const symbolOf = (index: number) =>
  index % OPEN_EVERY === OPEN_OFFSET ? INSTRUMENTS[((index - OPEN_OFFSET) / OPEN_EVERY) % INSTRUMENTS.length]! : SYMBOLS[index % SYMBOLS.length]!;

const cents = (value: number) => `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`;

interface PlanEvent {
  readonly kind: 'Plan';
  readonly time: number;
  readonly index: number;
}
interface ChangeEvent {
  readonly kind: 'PositionChange';
  readonly time: number;
  readonly index: number;
  readonly sequence: number;
  readonly quantities: readonly number[];
}

// The whole dataset as a time-ordered list of Plan confirmations and Position Changes.
function schedule(days: readonly number[]): (PlanEvent | ChangeEvent)[] {
  const events: (PlanEvent | ChangeEvent)[] = [];
  let sequence = 0;
  let session = -1;
  let slot = 0;
  for (let index = 0; index < BENCH_PROFILE.trades; index++) {
    const s = Math.floor((index * days.length) / BENCH_PROFILE.trades);
    slot = s === session ? slot + 1 : 0;
    session = s;
    events.push({ kind: 'Plan', time: days[s]! + 13 * 60 * MINUTE + 45 * MINUTE + slot * 15 * MINUTE, index });
    if (index % OPEN_EVERY !== OPEN_OFFSET) continue;
    const open = (index - OPEN_OFFSET) / OPEN_EVERY;
    const changes = PATTERN[open % PATTERN.length]!;
    const fills = Array.from({ length: changes }, (_, k) => PATTERN[(sequence + k) % PATTERN.length]!);
    const total = fills.reduce((a, b) => a + b, 0);
    const target = (plannedQuantity(index) * FILL_TENTHS[open % FILL_TENTHS.length]!) / 10;
    const base = Math.floor(target / total);
    let remainder = target - base * total;
    for (let k = 0; k < changes; k++) {
      const quantities = Array.from({ length: fills[k]! }, () => base + (remainder-- > 0 ? 1 : 0));
      events.push({ kind: 'PositionChange', time: days[s + 1 + k]! + 19 * 60 * MINUTE + 30 * MINUTE, index, sequence: sequence++, quantities });
    }
  }
  return events.sort((a, b) => a.time - b.time);
}

// The disposition of each Position Change, by its number in the generated order. The last two are
// deferred and never resolved, so they are still Outstanding (and due) at the as-of Review; the rest
// are spread by a seeded shuffle of the section 1.4 counts.
function dispositionsFor(total: number): readonly BenchDisposition[] {
  const kinds = Object.keys(BENCH_DISPOSITIONS) as BenchDisposition[];
  const sum = kinds.reduce((a, kind) => a + BENCH_DISPOSITIONS[kind], 0);
  if (sum !== total) throw new Error(`dispositions total ${sum}, the schedule has ${total} Position Changes`);
  const pool = kinds.filter((kind) => kind !== 'outstanding').flatMap((kind) => Array.from({ length: BENCH_DISPOSITIONS[kind] }, () => kind));
  const random = seededRandom(BENCH_SEED);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return [...pool, ...Array.from({ length: BENCH_DISPOSITIONS.outstanding }, (): BenchDisposition => 'outstanding')];
}

// The Position Change Reflection's answers, the same whether given at capture or in the Review.
function reflectionAnswers(n: number, symbol: string): Record<string, AnswerInput> {
  return {
    'prompt.position-change-reflection.decision-mode': {
      kind: 'Option',
      optionId: `option.position-change-reflection.decision-mode.${DECISION_MODES[n % DECISION_MODES.length]}`,
    },
    'prompt.position-change-reflection.primary-emotion': {
      kind: 'Option',
      optionId: `option.position-change-reflection.primary-emotion.${PC_EMOTIONS[n % PC_EMOTIONS.length]}`,
    },
    'prompt.position-change-reflection.decision-confidence': { kind: 'Scale', value: 1 + (n % 5) },
    ...(n % 2 === 0 && { 'prompt.position-change-reflection.note': { kind: 'Text', text: `Scaled in near the planned level on ${symbol}; entry ${n}.` } }),
  };
}

function plannedQuantity(index: number): number {
  return 10 * (5 + (index % 15));
}
function intendedEntryCents(index: number): number {
  return 2_000 + ((index * 7_919) % 38_000);
}

// Counts the stored Workspace's records directly, as provenance for `bench/dataset.json`. The Open
// Trades' underlyings come from the Open list, since the Instruments they hold are not counted
// from the stored Trades.
async function countStored(openUnderlyings: readonly string[] = []): Promise<BenchCounts> {
  const open = (name: string) =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error(`open ${name} failed`));
    });
  const all = (db: IDBDatabase, store: string) =>
    new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const request = db.transaction(store).objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result as Record<string, unknown>[]);
      request.onerror = () => reject(request.error ?? new Error(`read ${store} failed`));
    });
  // A cursor, so the 190,000 observations and 126,000 Actions are never all in memory at once.
  const each = (db: IDBDatabase, store: string, visit: (record: unknown) => void) =>
    new Promise<void>((resolve, reject) => {
      const request = db.transaction(store).objectStore(store).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return resolve();
        visit(cursor.value);
        cursor.continue();
      };
      request.onerror = () => reject(request.error ?? new Error(`read ${store} failed`));
    });
  const root = await open('tj-root');
  const pointer = (await all(root, 'pointer')).find((r) => r.key === 'current') as { databaseName: string };
  root.close();
  const db = await open(pointer.databaseName);
  const sessionDates = new Set<string>();
  let marks = 0;
  let markCorrections = 0;
  let acknowledgments = 0;
  await each(db, 'observations', (r) => {
    const record = r as { tradingDate: string; marks: { intention: string }[]; acknowledgments: unknown[] };
    sessionDates.add(record.tradingDate);
    marks += record.marks.filter((m) => m.intention === 'InitialManual').length;
    markCorrections += record.marks.filter((m) => m.intention === 'Correction').length;
    acknowledgments += record.acknowledgments.length;
  });
  const entryCounts: Record<string, number> = {};
  let editedActions = 0;
  await each(db, 'journalEntries', (r) => {
    const entry = r as { entryTypeKey: string; versions: unknown[] };
    entryCounts[entry.entryTypeKey] = (entryCounts[entry.entryTypeKey] ?? 0) + 1;
    if (entry.entryTypeKey === 'entry-type.daily-trade-review' && entry.versions.length > 1) editedActions++;
  });
  const trades = (await all(db, 'trades')) as { lifecycle: string; facts: { kind: string }[] }[];
  const declines = await all(db, 'journalDeclines');
  const catalog = (await all(db, 'catalog')) as { kind: string }[];
  const debts = (await all(db, 'journalDebts')) as { versions: { status: string }[] }[];
  db.close();
  const debtsWith = (status: string) => debts.filter((d) => d.versions[d.versions.length - 1]?.status === status).length;
  const facts = (kind: string) => trades.reduce((sum, t) => sum + t.facts.filter((f) => f.kind === kind).length, 0);
  const catalogOf = (kind: string) => catalog.filter((r) => r.kind === kind).length;
  const held = new Map<string, number>();
  for (const underlying of openUnderlyings) held.set(underlying, (held.get(underlying) ?? 0) + 1);
  return {
    trades: trades.length,
    openTrades: trades.filter((t) => t.lifecycle === 'Open').length,
    plannedTrades: trades.filter((t) => t.lifecycle === 'Planned').length,
    positionChanges: facts('PositionChange'),
    executions: facts('Execution'),
    planReflectionEntries: entryCounts['entry-type.plan-reflection'] ?? 0,
    positionChangeReflectionEntries: entryCounts['entry-type.position-change-reflection'] ?? 0,
    positionChangeReflectionDeclines: declines.length,
    institutions: catalogOf('Institution'),
    accounts: catalogOf('Account'),
    strategies: catalogOf('Strategy'),
    sessions: sessionDates.size,
    openInstruments: held.size,
    sharedInstruments: [...held.values()].filter((n) => n > 1).length,
    marks,
    markCorrections,
    acknowledgments,
    actions: entryCounts['entry-type.daily-trade-review'] ?? 0,
    editedActions,
    debts: debts.length,
    debtsSettled: debtsWith('Settled'),
    debtsDeclined: debtsWith('Declined'),
    debtsOutstanding: debtsWith('Outstanding'),
  };
}

async function generate() {
  let now = BENCH_CLOCK_START;
  const clock: Clock = { now: () => now };
  let generating = true;
  const app = await createApplication({
    indexedDB: window.indexedDB,
    host: browserHost(),
    clock,
    ids: seededIds(BENCH_SEED),
    releaseId: RELEASE_ID,
    capacityRequirement: CAPACITY_REQUIREMENT,
    locks: createWebLocksLifecycleLock(navigator.locks),
    skipMutationRecheck: () => generating,
  });
  const stats = {
    marks: 0,
    corrections: 0,
    actions: 0,
    edited: 0,
    byChoice: {} as Record<string, number>,
    dispositions: { complete: 0, declined: 0, answered: 0, declinedLater: 0, outstanding: 0 } satisfies Record<BenchDisposition, number>,
  };
  const final: { asOf?: BenchAsOf } = {};
  // The deferred reflections by Debt identity: what the Review will do when each falls due.
  const deferred = new Map<string, BenchOutstandingDebt & { readonly disposition: BenchDisposition }>();

  // The Marks of one session: every one of the 150 Instruments, except that the as-of session leaves
  // 10 of them Missing (the disclosed fraction). Every 100th Mark is corrected once.
  async function saveMarks(session: Session, sessionNumber: number, last: boolean) {
    for (const [k, instrumentKey] of INSTRUMENTS.entries()) {
      if (last && k % (BENCH_PROFILE.instruments / BENCH_PROFILE.missingAsOfInstruments) === 7) continue;
      const price = 2_000 + ((k * 977) % 18_000) + ((sessionNumber * 131 + k * 17) % 301) - 150;
      const saved = await app.MarketData.save({
        intention: 'RecordInitialManualMark',
        instrumentKey,
        tradingDate: session.date,
        expectedResolutionRevision: 'None',
        price: cents(price),
      });
      if (saved.kind !== 'Saved') throw new Error(`mark ${instrumentKey} ${session.date}: ${saved.kind}`);
      if (++stats.marks % BENCH_PROFILE.correctedMarkEvery !== 0) continue;
      const fix = await app.MarketData.save({
        intention: 'CorrectMark',
        instrumentKey,
        tradingDate: session.date,
        expectedResolutionRevision: saved.resolutionRevision,
        price: cents(price + 1),
        reason: 'Keyed the wrong digit from the broker statement.',
      });
      if (fix.kind !== 'Saved') throw new Error(`correction ${instrumentKey} ${session.date}: ${fix.kind}`);
      stats.corrections++;
    }
  }

  // Opens the Review and saves an Action for each eligible Trade: 85% Hold, 15% Exit, Roll or
  // Adjust with an Intent, and 2% of them edited once (a second save under the new binding).
  async function reviewSession(session: Session, last: boolean) {
    const opened = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: now });
    // Before the first Trade opens there is nothing to review.
    if (opened.kind === 'Empty' && !last) return;
    if (opened.kind !== 'Ready' || opened.reviewDate !== session.date) throw new Error(`open ${session.date}: ${opened.kind}`);
    if (last) {
      const marks = opened.families.find((f) => f.family === 'Marks');
      const due = opened.families.reduce((sum, f) => sum + (f.family === 'Trades' ? f.trades.reduce((s, t) => s + t.reflections.due, 0) : 0), 0);
      final.asOf = {
        asOf: now,
        reviewDate: session.date,
        actionsByChoice: {},
        missingInstruments: (marks?.family === 'Marks' ? marks.today : []).filter((r) => r.task === 'Manual').map((r) => r.instrumentKey).sort(),
        asOfDueReflections: due,
        outstandingDebts: [],
        dispositions: stats.dispositions,
      };
    }
    let binding = opened.binding;
    let carried: DailyTradeReview | undefined;
    // The binding the facade returned after a save, or a fresh one when writes kept landing.
    const adopt = async (review: PostSaveReview) => {
      if (review.kind === 'Ready') {
        binding = review.binding;
        return;
      }
      const reopened = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: now });
      if (reopened.kind !== 'Ready') throw new Error(`reopen ${session.date}: ${reopened.kind}`);
      binding = reopened.binding;
    };
    // The Trade's reflections that are due here: answered or declined by the Debt's planned outcome.
    // The Outstanding ones are left owed. Leaves the Trade's current form in `carried`.
    const resolveDue = async (item: { tradeId: string }) => {
      for (;;) {
        let trade = carried?.tradeId === item.tradeId ? carried : undefined;
        if (!trade) {
          const form = await app.DailyReview.getTrade({ reviewDate: session.date, tradeId: item.tradeId, binding });
          if (form.kind !== 'Ready') throw new Error(`getTrade ${session.date}: ${form.kind}`);
          trade = form.trade;
        }
        carried = trade;
        const owed = trade.reflections.find((r) => r.classification === 'Due' && deferred.get(r.debtId)?.disposition !== 'outstanding');
        if (!owed) return;
        const plan = deferred.get(owed.debtId);
        if (!plan) throw new Error(`${session.date}: unknown Debt ${owed.debtId}`);
        const answer = plan.disposition === 'answered';
        const saved = await app.DailyReview.save({
          kind: 'ResolveReviewDebt',
          reviewDate: session.date,
          binding: owed.saveBinding,
          resolution: answer
            ? { kind: 'Answer', answers: reflectionAnswers(plan.positionChange, plan.underlying) }
            : { kind: 'Decline', ...(plan.positionChange % 2 === 0 && { reason: 'Could not recall the decision well enough to answer.' }) },
        });
        if (saved.kind !== 'DebtResolved') throw new Error(`debt ${session.date} ${plan.underlying} ${plan.positionChange}: ${saved.kind}`);
        stats.dispositions[plan.disposition]++;
        deferred.delete(owed.debtId);
        carried = undefined;
        await adopt(saved.review);
      }
    };
    const save = async (item: { tradeId: string; underlying: string }, action: ActionChoice, n: number) => {
      // The previous save's next step already carries this Trade's form when it is the next in the walk.
      let trade = carried?.tradeId === item.tradeId ? carried : undefined;
      if (!trade) {
        const form = await app.DailyReview.getTrade({ reviewDate: session.date, tradeId: item.tradeId, binding });
        if (form.kind !== 'Ready') throw new Error(`getTrade ${session.date}: ${form.kind}`);
        trade = form.trade;
      }
      const saved = await app.DailyReview.save({
        kind: 'SaveTradeAction',
        binding: trade.saveBinding,
        action,
        ...(action !== 'Hold' && { intent: `Cut the ${item.underlying} exposure if the next close is below the stop; action ${n}.` }),
      });
      if (saved.kind !== 'Saved') throw new Error(`save ${session.date} ${item.underlying}: ${saved.kind}`);
      carried = saved.review.kind === 'Ready' && saved.review.nextStep.kind === 'Trade' ? saved.review.nextStep.trade : undefined;
      await adopt(saved.review);
    };
    for (const family of opened.families) {
      if (family.family !== 'Trades') continue;
      for (const item of family.trades) {
        if (item.reflections.due > 0) await resolveDue(item);
        const n = stats.actions++;
        const choice = n % 20 < 3 ? ACTIONS[n % 3]! : 'Hold';
        await save(item, choice, n);
        stats.byChoice[choice] = (stats.byChoice[choice] ?? 0) + 1;
        if (n % BENCH_PROFILE.editedActionEvery !== 0) continue;
        await save(item, choice === 'Hold' ? 'Adjust' : 'Hold', n);
        stats.edited++;
      }
    }
  }

  try {
    const initialized = await app.Workspace.initialize({ timeZone: BENCH_TIME_ZONE });
    if (initialized.kind !== 'Opened') throw new Error(`initialize: ${initialized.kind}`);

    const accounts: { id: string; recordRevision: number }[] = [];
    for (const [institutionLabel, accountLabels] of [
      ['Fidelity', ['Individual Brokerage', 'Roth IRA']],
      ['Charles Schwab', ['Joint Brokerage', 'Traditional IRA']],
      ['Interactive Brokers', ['Margin', 'Cash']],
    ] as const) {
      const institution = await app.ReferenceCatalog.save({ kind: 'CreateInstitution', label: institutionLabel });
      if (institution.kind !== 'Saved') throw new Error(`institution: ${institution.kind}`);
      for (const label of accountLabels) {
        const account = await app.ReferenceCatalog.save({ kind: 'CreateAccount', institutionId: institution.record.id, label });
        if (account.kind !== 'Saved') throw new Error(`account: ${account.kind}`);
        accounts.push(account.record);
      }
    }
    const strategies = await app.ReferenceCatalog.query({ family: 'Strategy' });
    const planDefinition = await app.Journal.getDefinitions({ latestFor: 'entry-type.plan-reflection' });
    const changeDefinition = await app.Journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
    if (strategies.kind !== 'Page' || planDefinition.kind !== 'Found' || changeDefinition.kind !== 'Found') throw new Error('seed missing');
    const strategy = strategies.items[0]!;

    const tradeIds: string[] = [];
    const sessions = await realSessions(app);
    const events = schedule(sessions.map((session) => Date.parse(session.date)));
    const dispositions = dispositionsFor(events.filter((event) => event.kind === 'PositionChange').length);
    const applyEvent = async (event: PlanEvent | ChangeEvent) => {
      // Authored five minutes after the event's Economic Time, so nothing is in the future.
      now = iso(event.time + 5 * MINUTE);
      const i = event.index;
      const symbol = symbolOf(i);
      const entry = intendedEntryCents(i);
      if (event.kind === 'Plan') {
        const account = accounts[i % accounts.length]!;
        const result = await app.TradeWorkflows.confirmPlan({
          accountId: account.id,
          accountRevision: account.recordRevision,
          strategyId: strategy.id,
          strategyRevision: strategy.recordRevision,
          economicTime: iso(event.time),
          plan: {
            underlying: symbol,
            legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol }, quantity: String(plannedQuantity(i)), intendedEntry: cents(entry) }],
            stops: [{ kind: 'UnderlyingPrice', price: cents(entry - Math.round(entry * 0.05)) }],
            targets: [{ kind: 'UnderlyingPrice', price: cents(entry + Math.round(entry * 0.12)) }],
          },
          reflection: {
            definitionId: planDefinition.definition.id,
            answers: {
              'prompt.plan-reflection.thesis': { kind: 'Text', text: `${symbol} reclaimed its 50-day average on rising volume after a tight base; plan ${i}.` },
              'prompt.plan-reflection.invalidation': { kind: 'Text', text: `A daily close back inside the base, below ${cents(entry - Math.round(entry * 0.05))}.` },
              'prompt.plan-reflection.conviction': { kind: 'Scale', value: 1 + (i % 5) },
              'prompt.plan-reflection.primary-emotion': { kind: 'Option', optionId: `option.plan-reflection.primary-emotion.${PLAN_EMOTIONS[i % PLAN_EMOTIONS.length]}` },
            },
          },
        });
        if (result.kind !== 'Confirmed') throw new Error(`plan ${i}: ${result.kind}`);
        tradeIds[i] = result.receipt.tradeId;
        if ((i + 1) % 2_500 === 0) console.log(`bench: ${i + 1} plans`);
        return;
      }
      const tradeId = tradeIds[i]!;
      const n = event.sequence;
      const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
      if (detail.kind !== 'Ready') throw new Error(`trade ${i}: ${detail.kind}`);
      const members = event.quantities.map((quantity, j) => ({
        kind: 'Execution' as const,
        tradeId,
        action: 'Buy' as const,
        instrument: { kind: 'Stock' as const, symbol },
        intent: { kind: 'ServesPlannedLeg' as const, plannedLegId: detail.view.plan.legs[0]!.factId },
        quantity: String(quantity),
        price: cents(entry + ((n + j) % 21) - 10),
        fee: (n + j) % 3 === 0 ? '0' : '0.65',
        economicTime: iso(event.time + j * MINUTE),
      }));
      const definitionId = changeDefinition.definition.id;
      const disposition = dispositions[n]!;
      const reflection =
        disposition === 'declined'
          ? { kind: 'Decline' as const, definitionId, ...(n % 2 === 0 && { reason: 'Filled during a fast open; no time to reflect.' }) }
          : disposition === 'complete'
            ? { kind: 'Complete' as const, form: { definitionId, answers: reflectionAnswers(n, symbol) } }
            : { kind: 'Defer' as const };
      const recorded = await app.TradeWorkflows.recordPositionChange({
        originTradeId: tradeId,
        trades: [{ tradeId, expectedFactRevision: detail.view.factRevision }],
        members,
        reflection,
      });
      if (recorded.kind !== 'Recorded') throw new Error(`trade ${i} change ${n}: ${recorded.kind}`);
      if (reflection.kind !== 'Defer') {
        stats.dispositions[disposition]++;
        return;
      }
      if (recorded.receipt.reflection.kind !== 'Debt') throw new Error(`trade ${i} change ${n}: deferred but recorded ${recorded.receipt.reflection.kind}`);
      const debtId = recorded.receipt.reflection.id;
      deferred.set(debtId, { debtId, tradeId, underlying: symbol, positionChange: n, recordedSession: iso(event.time).slice(0, 10), disposition });
      if (disposition === 'outstanding') stats.dispositions.outstanding++;
    };

    // The trader, session by session: the day's Plans and Position Changes, then (after the
    // session's completion) its Marks, the Review, and an Action for each eligible Trade.
    const started = performance.now();
    let next = 0;
    for (const [n, session] of sessions.entries()) {
      while (events[next] && events[next]!.time < Date.parse(session.completion)) await applyEvent(events[next++]!);
      // Five minutes after the session's completion: the pinned clock for the rest of the session.
      now = iso(Date.parse(session.completion) + 5 * MINUTE);
      const last = n === sessions.length - 1;
      await saveMarks(session, n, last);
      await reviewSession(session, last);
      if ((n + 1) % 25 === 0) console.log(`bench: session ${n + 1} of ${sessions.length} (${session.date}), ${Math.round((performance.now() - started) / 1000)} s, ${stats.marks} Marks, ${stats.actions} Actions`);
    }
    if (next !== events.length) throw new Error(`${events.length - next} events after the last session`);
  } finally {
    generating = false;
  }
  const open = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' });
  if (open.kind !== 'Ready') throw new Error(`browse Open: ${open.kind}`);
  if (!final.asOf) throw new Error('no session was simulated');
  const counts = await countStored(open.view.items.map((item) => item.underlying));
  // The facade's own tallies must agree with what is stored.
  if (counts.marks !== stats.marks || counts.markCorrections !== stats.corrections || counts.actions !== stats.actions || counts.editedActions !== stats.edited) {
    throw new Error(`stored ${counts.marks}/${counts.markCorrections}/${counts.actions}/${counts.editedActions} Marks/corrections/Actions/edited, saved ${stats.marks}/${stats.corrections}/${stats.actions}/${stats.edited}`);
  }
  // Section 1.4: every Position Change got its disposition, and the stored Journal agrees with the facade's tallies.
  const d = stats.dispositions;
  for (const kind of Object.keys(BENCH_DISPOSITIONS) as BenchDisposition[]) {
    if (d[kind] !== BENCH_DISPOSITIONS[kind]) throw new Error(`disposition ${kind}: ${d[kind]} applied, ${BENCH_DISPOSITIONS[kind]} planned`);
  }
  const outstandingDebts = [...deferred.values()].map((debt): BenchOutstandingDebt => ({ debtId: debt.debtId, tradeId: debt.tradeId, underlying: debt.underlying, positionChange: debt.positionChange, recordedSession: debt.recordedSession }));
  if (
    counts.positionChangeReflectionEntries !== d.complete + d.answered ||
    counts.positionChangeReflectionDeclines !== d.declined + d.declinedLater ||
    counts.debts !== d.answered + d.declinedLater + d.outstanding ||
    counts.debtsSettled !== d.answered ||
    counts.debtsDeclined !== d.declinedLater ||
    counts.debtsOutstanding !== d.outstanding ||
    outstandingDebts.length !== d.outstanding ||
    final.asOf.asOfDueReflections !== d.outstanding
  ) {
    throw new Error(`stored ${JSON.stringify(counts)} disagree with dispositions ${JSON.stringify(d)}, ${outstandingDebts.length} Outstanding, ${final.asOf.asOfDueReflections} due at as-of`);
  }
  return { generatorVersion: BENCH_GENERATOR_VERSION, counts, openItems: open.view.items, ...final.asOf, actionsByChoice: stats.byChoice, outstandingDebts };
}

declare global {
  interface Window {
    __tjBench?: {
      readonly marker: string;
      generate: typeof generate;
      count: typeof countStored;
    };
  }
}

export function installBenchGenerator(): void {
  window.__tjBench = { marker: BENCH_GENERATOR_MARKER, generate, count: countStored };
}
