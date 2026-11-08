// The bench build's generator entry point (D2 T2.20). Only `vite build --mode bench` reaches this
// module; the production bundle never imports it (`verify:no-fault-hooks` searches dist/ for the
// marker and `__tjBench`). It creates the plan's section 1.3 dataset through the production
// application facade on the real browser host, with seeded identities and a clock that starts at
// 2024-01-02 and moves forward with the generated Economic Times. From D4 (T4.30) it simulates the
// trader session by session: after each session's completion it saves that session's Marks for
// the 150 Instruments the Open Trades hold, opens the Daily Review, and saves an Action for each
// eligible Trade. From D5 (T5.21) a Position Change's reflection is completed, declined, or deferred
// by the plan's section 1.4 split, and each session's Review first resolves the deferred
// reflections that have fallen due (answer or decline). From D6 (T6.24) the book turns over: about
// 20 Plans a session are confirmed, entered over 1-3 sessions, held, and exited over 1-3 sessions; the
// last exit carries a Close Reason and a Close Review given the same split as the reflections; and the
// Review also resolves the deferred reflections and Close Reviews of Trades that have since closed
// (the owed-reflection group). While it runs, and only then,
// mutations skip the per-mutation readiness recheck (D1 A4, D2 section 6.0).
import { CAPACITY_REQUIREMENT } from '../delivery/capacity.ts';
import { browserHost } from '../delivery/browser-host.ts';
import { RELEASE_ID } from '../delivery/release-identity.ts';
import type { Clock } from '../domain/time/index.ts';
import { createWebLocksLifecycleLock, type IdGenerator } from '../persistence/index.ts';
import { instrumentKey, type Instrument, type OptionInstrument } from '../domain/instrument/index.ts';
import {
  BENCH_AS_OF_DATE,
  BENCH_AS_OF_INSTANT,
  BENCH_CLOCK_START,
  BENCH_CLOSE_REASONS,
  BENCH_DISPOSITION_PER_MILLE,
  BENCH_GENERATOR_MARKER,
  BENCH_GENERATOR_VERSION,
  BENCH_OPEN_STOCK_INSTRUMENTS,
  BENCH_PROFILE,
  BENCH_SETTLEMENT_DUE,
  BENCH_SEED,
  BENCH_TAIL_SESSIONS,
  BENCH_TIME_ZONE,
  benchScale,
  type BenchAsOf,
  type BenchCounts,
  type BenchDisposition,
  type BenchOutstandingDebt,
} from './bench.ts';
import { createApplication, type Application } from './compose.ts';
import type { ActionChoice, DailyTradeReview, OwedReflection, OwedReflectionsTrade, PostSaveReview, WalkedTrade } from '../coordinators/daily-review/index.ts';
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
// The reflections a walked Trade owes in this Review, from its Reflections panel (A164).
const dueNowOf = (item: WalkedTrade) => item.progress.panels.reduce((sum, panel) => sum + (panel.panel === 'Reflections' ? panel.dueNow : 0), 0);

const iso = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z');

// One simulated session. The completion is the close plus the policy's 30-minute buffer.
interface Session {
  readonly date: string;
  readonly close: string;
  readonly completion: string;
}
const COMPLETION_BUFFER = 30 * MINUTE;

// The real sessions from the clock start through the as-of date, asked of Market Data (only it sees the
// policy, A39): for each calendar day, the latest completed session as of that day's end is the day itself
// exactly when the day is a session. From D7 the run ends on the as-of date, Friday 2026-11-20.
async function realSessions(app: Application): Promise<readonly Session[]> {
  const sessions: Session[] = [];
  for (let day = Date.parse(BENCH_CLOCK_START.slice(0, 10)); new Date(day).toISOString().slice(0, 10) <= BENCH_AS_OF_DATE; day += 86_400_000) {
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
// The 90 stock Instruments the Open Trades hold: the 40 above and 50 synthetic three-letter symbols. The Open book's
// 60 option Trades each add a contract of their own, 150 Instruments in all (D7 section 1.4).
const STOCK_INSTRUMENTS: readonly string[] = [
  ...SYMBOLS,
  ...Array.from({ length: BENCH_OPEN_STOCK_INSTRUMENTS - SYMBOLS.length }, (_, k) => `Q${String.fromCharCode(65 + Math.floor(k / 26))}${String.fromCharCode(65 + (k % 26))}`),
];
const PLAN_EMOTIONS = ['calm', 'eager', 'anxious', 'fomo', 'relieved'];
const DECISION_MODES = ['as-planned', 'deliberate-adjustment', 'reactive'];
const PC_EMOTIONS = ['calm', 'eager', 'anxious', 'relieved'];
// Each Trade has 1–3 entry Position Changes and 1–3 exit Position Changes and each has 1–3 Executions:
// two of each on average, so four Position Changes and eight Executions per Closed Trade.
const PATTERN = [1, 2, 3, 2] as const;
// Sessions between the last entry and the first exit (2, 3 or 4): a Closed Trade is Open at five cutoffs on average.
const GAPS = [2, 3, 4] as const;
// The Open Trades' total entered quantity as tenths of the planned quantity: some still
// entering, most resolved at plan, some above plan (an Entry Size Excess).
const FILL_TENTHS = [10, 6, 10, 12, 10] as const;

// D7 section 1.4: 30% of the Trades are single-leg options. Within every ten Trades the first three are options,
// and within every hundred 12 are Long Calls, 8 Long Puts and 10 Cash-Secured Puts. Of the Closed option Trades
// 40% end by Expiration and 30% of those after a partial exit; 10% of the long-option Plans are Authorized.
export type OptionKind = 'LongCall' | 'LongPut' | 'CashSecuredPut';
export interface OptionSpec {
  readonly kind: OptionKind;
  readonly contracts: number;
  // The contract's expiration date.
  readonly expiration: string;
  // The Trade ends by Expiration; `partial` contracts are first sold (or bought back) in a Position Change of their own.
  readonly expires: boolean;
  readonly partial: number;
  readonly authorized: boolean;
}
const isOption = (index: number) => index % 10 < 3;
// The number of option Trades among the first n Trades.
const optionsBefore = (n: number) => 3 * Math.floor(n / 10) + Math.min(n % 10, 3);
const KIND_OF_THIRTY = (k: number): OptionKind => (k < 12 ? 'LongCall' : k < 20 ? 'LongPut' : 'CashSecuredPut');
const optionRight = (kind: OptionKind) => (kind === 'LongCall' ? 'Call' : 'Put');
const isLongOption = (kind: OptionKind) => kind !== 'CashSecuredPut';

// The Trades are, in order, the Closed ones (planned, entered, exited), the Open ones (entered, held) and the
// Planned ones. The Open stock Trades hold the 90 stock Instruments in turn (so, at 140 of them, 50 are shared by two
// Trades); each Open option Trade holds its own contract on one of the first 60 of them, which are therefore also held
// as stock. The Closed and Planned Trades hold the first 40 Instruments, which have a Mark every session.
const symbolOf = (index: number, closed: number, open: number) => {
  if (index < closed || index >= closed + open) return SYMBOLS[index % SYMBOLS.length]!;
  const optionIndex = optionsBefore(index) - optionsBefore(closed);
  return STOCK_INSTRUMENTS[(isOption(index) ? optionIndex : index - closed - optionIndex) % STOCK_INSTRUMENTS.length]!;
};

const cents = (value: number) => `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`;

// The option Trade's contract as the Plan and its Executions name it.
function contractOf(index: number, symbol: string, spec: OptionSpec): OptionInstrument {
  const u = 40 + (index % 160);
  const strike = spec.kind === 'LongCall' ? u + 5 : spec.kind === 'LongPut' ? u - 5 : u - 2;
  return { kind: 'Option', symbol, root: symbol, expiration: spec.expiration, right: optionRight(spec.kind), strike: String(strike), multiplier: 100 };
}
// Premium per share in cents: what a long option costs (or a Cash-Secured Put credits) at the Plan's intended entry.
const premiumOf = (index: number, kind: OptionKind) => (isLongOption(kind) ? 200 + 100 * (index % 5) : 120 + 100 * (index % 2));

interface PlanEvent {
  readonly kind: 'Plan';
  readonly time: number;
  readonly index: number;
  readonly option?: OptionSpec;
}
interface ChangeEvent {
  readonly kind: 'PositionChange';
  readonly time: number;
  readonly index: number;
  readonly side: 'Buy' | 'Sell';
  readonly quantities: readonly number[];
  readonly option?: OptionSpec;
  // An Expiration of the contracts still held, at the close of the contract's last session: the Trade's terminal change.
  readonly expire?: true;
  // The change that closes the whole Position: it carries the Close Review, and (unless an Expiration) the Close Reason.
  readonly terminal: boolean;
  // The change's number in the generated (time) order and, for a terminal change, the Close's number.
  readonly number: number;
  readonly closeNumber?: number;
}

// Splits a total quantity over executions grouped by Position Change, whole shares, none zero.
function splitQuantity(total: number, fills: readonly number[]): number[][] {
  const executions = fills.reduce((a, b) => a + b, 0);
  const base = Math.floor(total / executions);
  let remainder = total - base * executions;
  return fills.map((count) => Array.from({ length: count }, () => base + (remainder-- > 0 ? 1 : 0)));
}

interface Schedule {
  readonly events: readonly (PlanEvent | ChangeEvent)[];
  readonly positionChanges: number;
  readonly closes: number;
  readonly executions: number;
  // D7: the Expirations scheduled and how many follow a partial exit.
  readonly expirations: number;
  readonly expirationsAfterPartialExit: number;
}

// The week a day (UTC midnight) is in, Monday to Sunday.
const weekOf = (day: number) => Math.floor((day / 86_400_000 + 3) / 7);
const dateOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// The whole dataset as a time-ordered list of Plan confirmations and Position Changes. A Closed Trade is
// planned in a session, entered over the next 1–3 sessions, held, and exited over 1–3 sessions, one Position
// Change a session. Nothing is planned in the last sessions, and no Position Change is in the last one, so the
// reflections left Outstanding are all due at the as-of Review.
export function schedule(days: readonly number[], profile: ReturnType<typeof benchScale>, sessionCloses: readonly number[]): Schedule {
  const planSessions = days.length - BENCH_TAIL_SESSIONS;
  if (planSessions < 1) throw new Error(`${days.length} sessions are too few`);
  const { trades, closedTrades, openTrades } = profile;
  const unsorted: (PlanEvent | (Omit<ChangeEvent, 'number' | 'closeNumber'>))[] = [];
  let session = -1;
  let slot = 0;
  // Executions per Position Change run 1, 2, 3, 2 in the order the changes are scheduled: two on average.
  let fillSequence = 0;
  const lastDay = days.length - 1;
  // A contract expires at the close of the last session of a week.
  const weekEnds = days.map((day, k) => k === lastDay || weekOf(days[k + 1]!) !== weekOf(day));
  const weekEndFrom = (from: number) => {
    for (let k = from; k < lastDay; k++) if (weekEnds[k]) return k;
    return Math.max(from, lastDay - 1);
  };
  let expirations = 0;
  let expirationsAfterPartialExit = 0;
  for (let index = 0; index < trades; index++) {
    const s = Math.floor((index * planSessions) / trades);
    slot = s === session ? slot + 1 : 0;
    session = s;
    const planTime = days[s]! + 13 * 60 * MINUTE + 45 * MINUTE + slot * 5 * MINUTE;
    const planned = plannedQuantity(index);
    const change = (sessionIndex: number, side: 'Buy' | 'Sell', quantities: readonly number[], terminal: boolean, option?: OptionSpec) => {
      if (sessionIndex > days.length - 2) throw new Error(`Trade ${index}: a Position Change in session ${sessionIndex}, after the last but one`);
      // Within regular hours in both UTC offsets, and a different minute for most Trades: up to 300 minutes
      // after 14:30Z, but at least a minute before that session's own close (an early close is at 17:00Z or 18:00Z).
      const minutesToClose = Math.floor((sessionCloses[sessionIndex]! - days[sessionIndex]!) / MINUTE) - (14 * 60 + 30);
      const spread = Math.min(300, minutesToClose - 1);
      unsorted.push({ kind: 'PositionChange', time: days[sessionIndex]! + (14 * 60 + 30 + (index % spread)) * MINUTE, index, side, quantities, terminal, ...(option && { option }) });
    };
    if (isOption(index)) {
      // The option Trade: its kind, Exercise Intent, and (if Closed) how it ends, from its place among the option Trades.
      const c = optionsBefore(index);
      const k = c % 30;
      const kind = KIND_OF_THIRTY(k);
      const authorized = isLongOption(kind) && (20 * Math.floor(c / 30) + k) % 10 === 0;
      const entrySide = isLongOption(kind) ? 'Buy' : 'Sell';
      const exitSide = isLongOption(kind) ? 'Sell' : 'Buy';
      const spec = (expiration: string, expires = false, partial = 0): OptionSpec => ({ kind, contracts: planned, expiration, expires, partial, authorized });
      if (index < closedTrades) {
        const entries = Array.from({ length: PATTERN[index % PATTERN.length]! }, () => PATTERN[fillSequence++ % PATTERN.length]!);
        const bought = splitQuantity(planned, entries);
        const lastEntry = s + entries.length;
        if (c % 5 < 2) {
          // 40% of the Closed option Trades end by Expiration, 30% of those after selling a fifth of the contracts.
          const partial = (2 * Math.floor(c / 5) + (c % 5)) % 10 < 3 ? planned / 5 : 0;
          const x = weekEndFrom(lastEntry + GAPS[index % GAPS.length]! + (partial > 0 ? 1 : 0));
          const option = spec(dateOf(days[Math.min(x, lastDay)]!), true, partial);
          unsorted.push({ kind: 'Plan', time: planTime, index, option });
          bought.forEach((quantities, j) => change(s + 1 + j, entrySide, quantities, false, option));
          if (partial > 0) change(lastEntry + 1, exitSide, [partial], false, option);
          if (x > days.length - 2) throw new Error(`Trade ${index}: an Expiration in session ${x}, after the last but one`);
          unsorted.push({ kind: 'PositionChange', time: sessionCloses[x]!, index, side: exitSide, quantities: [planned - partial], terminal: true, expire: true, option });
          expirations++;
          if (partial > 0) expirationsAfterPartialExit++;
        } else {
          const exits = Array.from({ length: PATTERN[(index + 1) % PATTERN.length]! }, () => PATTERN[fillSequence++ % PATTERN.length]!);
          const sold = splitQuantity(planned, exits);
          const firstExit = lastEntry + GAPS[index % GAPS.length]!;
          // The contract expires at the close of the week of the last exit.
          const option = spec(dateOf(days[Math.min(weekEndFrom(firstExit + sold.length - 1), lastDay)]!));
          unsorted.push({ kind: 'Plan', time: planTime, index, option });
          bought.forEach((quantities, j) => change(s + 1 + j, entrySide, quantities, false, option));
          sold.forEach((quantities, j) => change(firstExit + j, exitSide, quantities, j === sold.length - 1, option));
        }
        continue;
      }
      // An Open option Trade: the first BENCH_SETTLEMENT_DUE expire on the as-of date, so they are Settlement Due then;
      // the rest, and the Planned ones, expire on a later Friday.
      const m = c - optionsBefore(closedTrades);
      const due = index < closedTrades + openTrades && m < BENCH_SETTLEMENT_DUE;
      const option = spec(dateOf(days[lastDay]! + (due ? 0 : 7 * (1 + (c % 4)) * 86_400_000)));
      unsorted.push({ kind: 'Plan', time: planTime, index, option });
      if (index >= closedTrades + openTrades) continue;
      const open = index - closedTrades;
      const fills = Array.from({ length: PATTERN[open % PATTERN.length]! }, () => PATTERN[fillSequence++ % PATTERN.length]!);
      splitQuantity((planned * FILL_TENTHS[open % FILL_TENTHS.length]!) / 10, fills).forEach((quantities, j) => change(s + 1 + j, entrySide, quantities, false, option));
      continue;
    }
    unsorted.push({ kind: 'Plan', time: planTime, index });
    if (index >= closedTrades + openTrades) continue;
    if (index < closedTrades) {
      const entries = Array.from({ length: PATTERN[index % PATTERN.length]! }, () => PATTERN[fillSequence++ % PATTERN.length]!);
      const exits = Array.from({ length: PATTERN[(index + 1) % PATTERN.length]! }, () => PATTERN[fillSequence++ % PATTERN.length]!);
      const bought = splitQuantity(planned, entries);
      const sold = splitQuantity(planned, exits);
      const firstExit = s + entries.length + GAPS[index % GAPS.length]!;
      bought.forEach((quantities, k) => change(s + 1 + k, 'Buy', quantities, false));
      sold.forEach((quantities, k) => change(firstExit + k, 'Sell', quantities, k === sold.length - 1));
      continue;
    }
    const open = index - closedTrades;
    const fills = Array.from({ length: PATTERN[open % PATTERN.length]! }, () => PATTERN[fillSequence++ % PATTERN.length]!);
    splitQuantity((planned * FILL_TENTHS[open % FILL_TENTHS.length]!) / 10, fills).forEach((quantities, k) => change(s + 1 + k, 'Buy', quantities, false));
  }
  unsorted.sort((a, b) => a.time - b.time);
  let positionChanges = 0;
  let closes = 0;
  let executions = 0;
  const events = unsorted.map((event): PlanEvent | ChangeEvent => {
    if (event.kind === 'Plan') return event;
    // An Expiration is a settlement fact, not an Execution.
    if (!event.expire) executions += event.quantities.length;
    return { ...event, number: positionChanges++, ...(event.terminal && { closeNumber: closes++ }) };
  });
  return { events, positionChanges, closes, executions, expirations, expirationsAfterPartialExit };
}

// A total over the section 1.4 outcomes as whole counts that sum exactly: each rounded down, and the
// remaining units to the largest remainders (ties to the earlier outcome).
export function splitCounts(total: number): Record<BenchDisposition, number> {
  const kinds = Object.keys(BENCH_DISPOSITION_PER_MILLE) as BenchDisposition[];
  const counts = Object.fromEntries(kinds.map((kind) => [kind, Math.floor((total * BENCH_DISPOSITION_PER_MILLE[kind]) / 1000)])) as Record<BenchDisposition, number>;
  const byRemainder = kinds
    .map((kind, order) => ({ kind, order, remainder: (total * BENCH_DISPOSITION_PER_MILLE[kind]) % 1000 }))
    .sort((a, b) => b.remainder - a.remainder || a.order - b.order);
  let left = total - kinds.reduce((sum, kind) => sum + counts[kind], 0);
  for (const { kind } of byRemainder) if (left-- > 0) counts[kind]++;
  return counts;
}

// The disposition of each Position Change (or each Close), by its number in the generated order. The last
// ones are deferred and never resolved, so they are still Outstanding (and due) at the as-of Review; the rest
// are spread by a seeded shuffle of the section 1.4 counts.
export function dispositionsFor(total: number, seed: number): { readonly dispositions: readonly BenchDisposition[]; readonly counts: Record<BenchDisposition, number> } {
  const counts = splitCounts(total);
  const kinds = (Object.keys(counts) as BenchDisposition[]).filter((kind) => kind !== 'outstanding');
  const pool = kinds.flatMap((kind) => Array.from({ length: counts[kind] }, () => kind));
  const random = seededRandom(seed);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return { dispositions: [...pool, ...Array.from({ length: counts.outstanding }, (): BenchDisposition => 'outstanding')], counts };
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

// The Position Change Reflection given at capture: a Decline, a Complete, or a Defer (every other
// disposition is answered or declined later, in a Review, or stays Outstanding).
function captureReflection(disposition: BenchDisposition, n: number, symbol: string, definitionId: string) {
  if (disposition === 'declined') {
    return { kind: 'Decline' as const, definitionId, ...(n % 2 === 0 && { reason: 'Filled during a fast open; no time to reflect.' }) };
  }
  if (disposition === 'complete') {
    return { kind: 'Complete' as const, form: { definitionId, answers: reflectionAnswers(n, symbol) } };
  }
  return { kind: 'Defer' as const };
}

// The Close Review's answers: given at the closing exit, or later in the Review where it falls due.
function closeReviewAnswers(n: number, symbol: string, later: boolean): Record<string, AnswerInput> {
  return {
    'prompt.close-review.take-again': {
      kind: 'Option',
      optionId: `option.close-review.take-again.${later ? 'yes-with-changes' : 'yes-as-planned'}`,
    },
    ...(n % 2 === 0 && {
      'prompt.close-review.what-worked': {
        kind: 'Text',
        text: later ? `Recalled at the Review: the ${symbol} exit was earlier than planned; trade ${n}.` : `The ${symbol} entry held its level and the stop was respected; trade ${n}.`,
      },
      ...(!later && { 'prompt.close-review.key-lesson': { kind: 'Text', text: 'Scale out into strength instead of waiting for the full target.' } }),
    }),
  };
}

// The Close Review given at the closing exit: a Decline, a Complete, or a Defer.
function captureCloseReview(disposition: BenchDisposition, n: number, symbol: string, definitionId: string) {
  if (disposition === 'declined') return { kind: 'Decline' as const, definitionId, ...(n % 2 === 0 && { reason: 'Nothing new to learn from this one.' }) };
  if (disposition === 'complete') return { kind: 'Complete' as const, form: { definitionId, answers: closeReviewAnswers(n, symbol, false) } };
  return { kind: 'Defer' as const };
}

// Shares for a stock Plan; contracts for an option Plan (20 or 40: enough that an Open Trade's partial fills, up to nine
// Executions of 60% of the Plan, are whole contracts).
function plannedQuantity(index: number): number {
  return isOption(index) ? 20 * (1 + (index % 2)) : 10 * (5 + (index % 15));
}
function intendedEntryCents(index: number): number {
  return 2_000 + ((index * 7_919) % 38_000);
}

// The Open book's distinct Instruments, by Instrument key (a contract and its Underlying's stock are
// two), and how many of them two or more Open Trades hold.
export function countHeld(openInstruments: readonly Instrument[]): { readonly open: number; readonly shared: number } {
  const held = new Map<string, number>();
  for (const instrument of openInstruments) {
    const key = instrumentKey(instrument);
    held.set(key, (held.get(key) ?? 0) + 1);
  }
  return { open: held.size, shared: [...held.values()].filter((n) => n > 1).length };
}

// Counts the stored Workspace's records directly, as provenance for `bench/dataset.json`.
type StoredCounts = Omit<BenchCounts, 'instrumentsPerSessionMean' | 'instrumentsPerSessionMax'>;
async function countStored(closeReasonLabels: Readonly<Record<string, string>> = {}): Promise<StoredCounts> {
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
  // The 25,000 Trades carry about 300,000 facts, so they are visited by a cursor and only tallied.
  const tradeCounts = { trades: 0, open: 0, planned: 0, closed: 0, positionChanges: 0, executions: 0 };
  const closeReasons: Record<string, number> = {};
  // D7: the option Trades by the Strategy their Planned Leg shows (Long Call, Long Put, or the short Put), the Plans'
  // Exercise Intents, the Expirations, and the Open book's contracts and stock Underlyings.
  const optionCounts = { trades: 0, longCalls: 0, longPuts: 0, cashSecuredPuts: 0, exerciseIntent: 0, authorized: 0, expirations: 0, afterPartial: 0, open: 0 };
  const openHeld: Instrument[] = [];
  const openContracts = new Set<string>();
  const openStock = new Set<string>();
  const openOptionUnderlyings = new Set<string>();
  await each(db, 'trades', (r) => {
    type Fact = { kind: string; versions?: { value: Record<string, unknown> }[] };
    const trade = r as { lifecycle: string; underlying: string; facts: Fact[]; closeReasonFacts?: { versions: { value: { closeReasonId: string } }[] }[] };
    tradeCounts.trades++;
    if (trade.lifecycle === 'Open') tradeCounts.open++;
    if (trade.lifecycle === 'Planned') tradeCounts.planned++;
    if (trade.lifecycle === 'Closed') tradeCounts.closed++;
    const valueOf = (fact: Fact) => fact.versions?.[fact.versions.length - 1]?.value;
    const leg = valueOf(trade.facts.find((fact) => fact.kind === 'PlannedLeg') ?? { kind: '' }) as { side: string; instrument: { kind: string } & Partial<OptionInstrument> } | undefined;
    const isOptionTrade = leg?.instrument.kind === 'Option';
    if (isOptionTrade) {
      optionCounts.trades++;
      if (leg.instrument.right === 'Call') optionCounts.longCalls++;
      else if (leg.side === 'Long') optionCounts.longPuts++;
      else optionCounts.cashSecuredPuts++;
      const intent = (valueOf(trade.facts.find((fact) => fact.kind === 'Plan') ?? { kind: '' }) as { exerciseIntent?: string } | undefined)?.exerciseIntent;
      if (intent !== undefined) optionCounts.exerciseIntent++;
      if (intent === 'Authorized') optionCounts.authorized++;
      const expired = trade.facts.some((fact) => fact.kind === 'Expiration');
      if (expired) optionCounts.expirations++;
      const executions = trade.facts.filter((fact) => fact.kind === 'Execution').map((fact) => (valueOf(fact) as { action: string }).action);
      if (expired && executions.includes('Buy') && executions.includes('Sell')) optionCounts.afterPartial++;
    }
    if (trade.lifecycle === 'Open') {
      if (leg) openHeld.push(leg.instrument as Instrument);
      if (isOptionTrade) {
        optionCounts.open++;
        openContracts.add(instrumentKey(leg.instrument as OptionInstrument));
        openOptionUnderlyings.add(trade.underlying);
      } else {
        openStock.add(trade.underlying);
      }
    }
    for (const fact of trade.facts) {
      if (fact.kind === 'PositionChange') tradeCounts.positionChanges++;
      if (fact.kind === 'Execution') tradeCounts.executions++;
    }
    for (const fact of trade.closeReasonFacts ?? []) {
      const id = fact.versions[fact.versions.length - 1]!.value.closeReasonId;
      const label = closeReasonLabels[id] ?? id;
      closeReasons[label] = (closeReasons[label] ?? 0) + 1;
    }
  });
  const declines = (await all(db, 'journalDeclines')) as { entryTypeKey: string }[];
  const catalog = (await all(db, 'catalog')) as { kind: string }[];
  const debts = (await all(db, 'journalDebts')) as { entryTypeKey: string; versions: { status: string }[] }[];
  db.close();
  const closeKey = 'entry-type.close-review';
  const closeDebts = debts.filter((d) => d.entryTypeKey === closeKey);
  const debtsWith = (list: typeof debts, status: string) => list.filter((d) => d.versions[d.versions.length - 1]?.status === status).length;
  const catalogOf = (kind: string) => catalog.filter((r) => r.kind === kind).length;
  const held = countHeld(openHeld);
  return {
    trades: tradeCounts.trades,
    openTrades: tradeCounts.open,
    plannedTrades: tradeCounts.planned,
    positionChanges: tradeCounts.positionChanges,
    executions: tradeCounts.executions,
    planReflectionEntries: entryCounts['entry-type.plan-reflection'] ?? 0,
    positionChangeReflectionEntries: entryCounts['entry-type.position-change-reflection'] ?? 0,
    positionChangeReflectionDeclines: declines.filter((d) => d.entryTypeKey === 'entry-type.position-change-reflection').length,
    institutions: catalogOf('Institution'),
    accounts: catalogOf('Account'),
    strategies: catalogOf('Strategy'),
    sessions: sessionDates.size,
    openInstruments: held.open,
    sharedInstruments: held.shared,
    marks,
    markCorrections,
    acknowledgments,
    actions: entryCounts['entry-type.daily-trade-review'] ?? 0,
    editedActions,
    debts: debts.length,
    debtsSettled: debtsWith(debts, 'Settled'),
    debtsDeclined: debtsWith(debts, 'Declined'),
    debtsOutstanding: debtsWith(debts, 'Outstanding'),
    closedTrades: tradeCounts.closed,
    closeReasons,
    closeReviewEntries: entryCounts[closeKey] ?? 0,
    closeReviewDeclines: declines.filter((d) => d.entryTypeKey === closeKey).length,
    closeReviewDebts: closeDebts.length,
    closeReviewDebtsSettled: debtsWith(closeDebts, 'Settled'),
    closeReviewDebtsDeclined: debtsWith(closeDebts, 'Declined'),
    closeReviewDebtsOutstanding: debtsWith(closeDebts, 'Outstanding'),
    optionTrades: optionCounts.trades,
    longCalls: optionCounts.longCalls,
    longPuts: optionCounts.longPuts,
    cashSecuredPuts: optionCounts.cashSecuredPuts,
    exerciseIntentPlans: optionCounts.exerciseIntent,
    authorizedPlans: optionCounts.authorized,
    expirations: optionCounts.expirations,
    expirationsAfterPartialExit: optionCounts.afterPartial,
    openOptionTrades: optionCounts.open,
    openContracts: openContracts.size,
    openStockInstruments: openStock.size,
    optionUnderlyingsHeldAsStock: [...openOptionUnderlyings].filter((symbol) => openStock.has(symbol)).length,
  };
}

// A deferred reflection or Close Review: what the Review will do when it falls due.
interface DeferredDebt extends BenchOutstandingDebt {
  readonly disposition: BenchDisposition;
}
const noTallies = (): Record<BenchDisposition, number> => ({ complete: 0, declined: 0, answered: 0, declinedLater: 0, outstanding: 0 });

// `sessions` limits the run to the first N real sessions, scaling every count (a smoke run); omitted, it is
// the full profile of plan section 1.4.
async function generate(options: { readonly sessions?: number } = {}) {
  let now = BENCH_CLOCK_START;
  const clock: Clock = { now: () => now };
  let generating = true;
  // Milliseconds spent in each phase and in each Review and Trade Workflows call, cumulative, logged with the
  // progress lines for projecting the run time.
  const timing: Record<string, number> = {};
  const timeCalls = <T extends object>(name: string, api: T): T =>
    new Proxy(api, {
      get(target, key, receiver) {
        const member: unknown = Reflect.get(target, key, receiver);
        if (typeof member !== 'function') return member;
        return async (...args: unknown[]) => {
          const started = performance.now();
          try {
            return await (member as (...a: unknown[]) => Promise<unknown>).apply(target, args);
          } finally {
            const label = `${name}.${String(key)}`;
            timing[label] = (timing[label] ?? 0) + performance.now() - started;
          }
        };
      },
    });
  const created = await createApplication({
    indexedDB: window.indexedDB,
    host: browserHost(),
    clock,
    ids: seededIds(BENCH_SEED),
    releaseId: RELEASE_ID,
    capacityRequirement: CAPACITY_REQUIREMENT,
    locks: createWebLocksLifecycleLock(navigator.locks),
    skipMutationRecheck: () => generating,
  });
  const app: Application = { ...created, DailyReview: timeCalls('review', created.DailyReview), TradeWorkflows: timeCalls('workflows', created.TradeWorkflows) };
  const stats = {
    marks: 0,
    corrections: 0,
    actions: 0,
    edited: 0,
    byChoice: {} as Record<string, number>,
    dispositions: noTallies(),
    closeReviews: noTallies(),
    closeReasons: {} as Record<string, number>,
  };
  const final: { asOf?: BenchAsOf } = {};
  let expectedTotals:
    | {
        readonly positionChanges: number;
        readonly executions: number;
        readonly profile: ReturnType<typeof benchScale>;
        readonly reflectionCounts: Record<BenchDisposition, number>;
        readonly closeCounts: Record<BenchDisposition, number>;
        readonly closeReasonLabels: Readonly<Record<string, string>>;
        readonly expirations: number;
        readonly expirationsAfterPartialExit: number;
      }
    | undefined;
  // The deferred reflections and Close Reviews by Debt identity: what the Review will do when each falls due.
  const deferred = new Map<string, DeferredDebt>();
  const talliesOf = (debt: { readonly kind: DeferredDebt['kind'] }) => (debt.kind === 'CloseReview' ? stats.closeReviews : stats.dispositions);

  // The option Trades held at the current cutoff, by Trade number, with the contract's key and expiration date.
  const held = new Map<number, { readonly key: string; readonly expiration: string }>();
  // How many Instruments were marked in each session.
  const markedPerSession: number[] = [];

  // The Marks of one session: each of the 90 stock Instruments, except that the as-of session leaves 10 of them
  // Missing (the disclosed fraction), and the contract of each option Trade held at the cutoff (at or before its
  // expiration date). Every 100th Mark is corrected once.
  async function saveMarks(session: Session, sessionNumber: number, last: boolean) {
    // Trades on the same contract share its Mark, so each contract is marked once.
    const contracts = new Map<string, { key: string; price: number; skip: boolean }>();
    for (const [k, { key, expiration }] of held) {
      if (session.date <= expiration && !contracts.has(key)) contracts.set(key, { key, price: 50 + ((k * 977 + sessionNumber * 131) % 900), skip: false });
    }
    const keys = [
      ...STOCK_INSTRUMENTS.map((key, k) => ({ key, price: 2_000 + ((k * 977) % 18_000) + ((sessionNumber * 131 + k * 17) % 301) - 150, skip: last && k % (BENCH_OPEN_STOCK_INSTRUMENTS / BENCH_PROFILE.missingAsOfInstruments) === 7 })),
      ...contracts.values(),
    ];
    let marked = 0;
    for (const { key: instrumentKey, price, skip } of keys) {
      if (skip) continue;
      const saved = await app.MarketData.save({
        intention: 'RecordInitialManualMark',
        instrumentKey,
        tradingDate: session.date,
        expectedResolutionRevision: 'None',
        price: cents(price),
      });
      if (saved.kind !== 'Saved') throw new Error(`mark ${instrumentKey} ${session.date}: ${saved.kind}`);
      marked++;
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
    markedPerSession.push(marked);
  }

  // Opens the Review and saves an Action for each eligible Trade: 85% Hold, 15% Exit, Roll or
  // Adjust with an Intent, and 2% of them edited once (a second save under the new binding).
  async function reviewSession(session: Session, last: boolean) {
    const openedAt = performance.now();
    const opened = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: now });
    timing['open'] = (timing['open'] ?? 0) + performance.now() - openedAt;
    // Before the first Trade opens there is nothing to review.
    if (opened.kind === 'Empty' && !last) return;
    if (opened.kind !== 'Ready' || opened.reviewDate !== session.date) throw new Error(`open ${session.date}: ${opened.kind}`);
    if (last) {
      const marks = opened.families.find((f) => f.family === 'Marks');
      const walk = opened.families.flatMap((f) => (f.family === 'Trades' ? f.trades : []));
      const due = walk.reduce((sum, t) => sum + dueNowOf(t), 0) + opened.owed.reduce((sum, t) => sum + t.owed.filter((o) => o.classification === 'Due').length, 0);
      final.asOf = {
        asOf: now,
        reviewDate: session.date,
        actionsByChoice: {},
        missingInstruments: (marks?.family === 'Marks' ? marks.today : []).filter((r) => r.task === 'Manual').map((r) => r.instrumentKey).sort(),
        asOfDueReflections: due,
        outstandingDebts: [],
        dispositions: stats.dispositions,
        closeReviewDispositions: stats.closeReviews,
        asOfReview: {
          settlement: opened.families.flatMap((f) =>
            f.family === 'Settlement'
              ? f.items.map((item) => ({
                  tradeId: item.tradeId,
                  underlying: item.instrument.symbol,
                  contract: instrumentKey(item.instrument),
                  expiration: item.expiration,
                  quantity: item.quantity.denominator === 1n ? String(item.quantity.numerator) : `${item.quantity.numerator}/${item.quantity.denominator}`,
                }))
              : [],
          ),
          walk: walk.map((t) => t.tradeId),
          owedGroup: opened.owed.map((t) => ({ tradeId: t.tradeId, underlying: t.underlying, debtIds: t.owed.map((o) => o.debtId) })),
        },
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
    // Answers or declines one owed reflection or Close Review by the Debt's planned outcome.
    const resolve = async (owed: OwedReflection) => {
      const plan = deferred.get(owed.debtId);
      if (!plan) throw new Error(`${session.date}: unknown Debt ${owed.debtId}`);
      const closeReview = plan.kind === 'CloseReview';
      const saved = await app.DailyReview.save({
        kind: 'ResolveReviewDebt',
        reviewDate: session.date,
        binding: owed.saveBinding,
        resolution:
          plan.disposition === 'answered'
            ? { kind: 'Answer', answers: closeReview ? closeReviewAnswers(plan.positionChange, plan.underlying, true) : reflectionAnswers(plan.positionChange, plan.underlying) }
            : {
                kind: 'Decline',
                ...(plan.positionChange % 2 === 0 && { reason: closeReview ? 'Cannot recall the Trade well enough to say.' : 'Could not recall the decision well enough to answer.' }),
              },
      });
      if (saved.kind !== 'DebtResolved') throw new Error(`debt ${session.date} ${plan.underlying} ${plan.kind} ${plan.positionChange}: ${saved.kind}`);
      talliesOf(plan)[plan.disposition]++;
      deferred.delete(owed.debtId);
      carried = undefined;
      await adopt(saved.review);
    };
    const resolvable = (r: OwedReflection) => r.classification === 'Due' && deferred.get(r.debtId)?.disposition !== 'outstanding';
    // The walked Trade's reflections that are due here: answered or declined by the Debt's planned outcome.
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
        const owed = trade.reflections.find(resolvable);
        if (!owed) return;
        await resolve(owed);
      }
    };
    // The same for a Trade of the owed-reflection group (a Trade closed before the cutoff), whose card has the
    // Reflections panel alone.
    // A card cannot be opened once its Trade has no Outstanding Debt, so it is opened once per Debt to resolve.
    const resolveOwedGroup = async (item: OwedReflectionsTrade) => {
      for (const { debtId, classification } of item.owed) {
        // A Debt not yet due, or one left Outstanding by plan, stays owed.
        if (classification !== 'Due' || deferred.get(debtId)?.disposition === 'outstanding') continue;
        const form = await app.DailyReview.getTrade({ reviewDate: session.date, tradeId: item.tradeId, binding });
        if (form.kind !== 'ReflectionsOwed') throw new Error(`getTrade ${session.date} owed: ${form.kind}`);
        const owed = form.card.reflections.find((r) => r.debtId === debtId);
        if (!owed) throw new Error(`${session.date}: Debt ${debtId} is not on the card of Trade ${item.tradeId}`);
        await resolve(owed);
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
        if (dueNowOf(item) > 0) await resolveDue(item);
        const n = stats.actions++;
        const choice = n % 20 < 3 ? ACTIONS[n % 3]! : 'Hold';
        await save(item, choice, n);
        stats.byChoice[choice] = (stats.byChoice[choice] ?? 0) + 1;
        if (n % BENCH_PROFILE.editedActionEvery !== 0) continue;
        await save(item, choice === 'Hold' ? 'Adjust' : 'Hold', n);
        stats.edited++;
      }
    }
    // After the walk, the owed-reflection group: Trades closed before the cutoff with a reflection or Close Review due.
    for (const item of opened.owed) {
      if (item.owed.some((o) => o.classification === 'Due' && deferred.get(o.debtId)?.disposition !== 'outstanding')) await resolveOwedGroup(item);
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
    const strategyOf = (productKey: string) => {
      const found = strategies.items.find((r) => r.kind === 'Strategy' && r.productKey === productKey);
      if (!found) throw new Error(`no Strategy ${productKey}`);
      return found;
    };
    const strategy = strategyOf('strategy.long-stock');
    const optionStrategies: Record<OptionKind, typeof strategy> = {
      LongCall: strategyOf('strategy.long-call'),
      LongPut: strategyOf('strategy.long-put'),
      CashSecuredPut: strategyOf('strategy.cash-secured-put'),
    };

    const closeReasonResult = await app.ReferenceCatalog.query({ family: 'CloseReason' });
    const closeReviewDefinition = await app.Journal.getDefinitions({ latestFor: 'entry-type.close-review' });
    if (closeReasonResult.kind !== 'Page' || closeReviewDefinition.kind !== 'Found') throw new Error('Close Reason or Close Review seed missing');
    const closeReasonIds = BENCH_CLOSE_REASONS.map((label) => {
      const found = closeReasonResult.items.find((r) => r.label === label);
      if (!found) throw new Error(`no Close Reason ${label}`);
      return found.id;
    });
    // Per 20 Closed Trades: 6 Target Reached, 7 Stop Triggered, 3 Thesis Invalidated, 4 Time-Based Exit.
    const REASON_OF_TWENTY = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3] as const;
    const closeReasonLabels = Object.fromEntries(BENCH_CLOSE_REASONS.map((label, k) => [closeReasonIds[k]!, label]));

    const tradeIds: string[] = [];
    const tradeState = new Map<number, { planLeg: string; factRevision: number }>();
    const allSessions = await realSessions(app);
    const sessions = options.sessions === undefined ? allSessions : allSessions.slice(0, options.sessions);
    const profile = benchScale(sessions.length, allSessions.length);
    const { events, positionChanges: positionChangeTotal, closes: closeTotal, executions: executionTotal, expirations, expirationsAfterPartialExit } = schedule(
      sessions.map((session) => Date.parse(session.date)),
      profile,
      sessions.map((session) => Date.parse(session.close)),
    );
    if (closeTotal !== profile.closedTrades) throw new Error(`${closeTotal} closes scheduled for ${profile.closedTrades} Closed Trades`);
    const reflectionPlan = dispositionsFor(positionChangeTotal, BENCH_SEED);
    const closePlan = dispositionsFor(closeTotal, BENCH_SEED + 1);
    const applyEvent = async (event: PlanEvent | ChangeEvent) => {
      // Authored five minutes after the event's Economic Time, so nothing is in the future.
      now = iso(event.time + 5 * MINUTE);
      const i = event.index;
      const symbol = symbolOf(i, profile.closedTrades, profile.openTrades);
      const entry = intendedEntryCents(i);
      if (event.kind === 'Plan') {
        const account = accounts[i % accounts.length]!;
        const option = event.option;
        // An option Plan names its contract, enters at a premium, and its Stop and Target are Underlying prices around the
        // Underlying's level `u`; Long Calls and Cash-Secured Puts rise to the Target, Long Puts fall to it.
        const u = 40 + (i % 160);
        const premium = option ? premiumOf(i, option.kind) : 0;
        const plan = option
          ? {
              underlying: symbol,
              legs: [
                isLongOption(option.kind)
                  ? { side: 'Long' as const, instrument: contractOf(i, symbol, option), quantity: String(option.contracts), intendedEntry: cents(premium) }
                  : { side: 'Short' as const, instrument: contractOf(i, symbol, option), quantity: String(-option.contracts), intendedEntry: cents(premium) },
              ],
              stops: [{ kind: 'UnderlyingPrice' as const, price: `${option.kind === 'LongCall' ? u - 3 : option.kind === 'LongPut' ? u + 3 : u - 6}.00` }],
              targets: [{ kind: 'UnderlyingPrice' as const, price: `${option.kind === 'LongCall' ? u + 12 : option.kind === 'LongPut' ? u - 12 : u + 5}.00` }],
              ...(isLongOption(option.kind) && { exerciseIntent: option.authorized ? ('Authorized' as const) : ('NotAuthorized' as const) }),
            }
          : {
              underlying: symbol,
              legs: [{ side: 'Long' as const, instrument: { kind: 'Stock' as const, symbol }, quantity: String(plannedQuantity(i)), intendedEntry: cents(entry) }],
              stops: [{ kind: 'UnderlyingPrice' as const, price: cents(entry - Math.round(entry * 0.05)) }],
              targets: [{ kind: 'UnderlyingPrice' as const, price: cents(entry + Math.round(entry * 0.12)) }],
            };
        const planStrategy = option ? optionStrategies[option.kind] : strategy;
        const result = await app.TradeWorkflows.confirmPlan({
          accountId: account.id,
          accountRevision: account.recordRevision,
          strategyId: planStrategy.id,
          strategyRevision: planStrategy.recordRevision,
          economicTime: iso(event.time),
          plan,
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
      const n = event.number;
      // The planned leg is read once; after that the receipt's Fact Revision is the next change's expectation.
      let state = tradeState.get(i);
      if (!state) {
        const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
        if (detail.kind !== 'Ready') throw new Error(`trade ${i}: ${detail.kind}`);
        state = { planLeg: detail.view.plan.legs[0]!.factId, factRevision: detail.view.factRevision };
      }
      const planLeg = state.planLeg;
      const option = event.option;
      const contract = option ? contractOf(i, symbol, option) : undefined;
      // An exit of a long option sells above the premium paid; the buy-back of a short one is below the credit.
      const exitMove = option && !isLongOption(option.kind) ? -40 : 60;
      const members = event.expire
        ? [{ kind: 'Expiration' as const, tradeId, instrument: contract!, quantity: String(event.quantities[0]), economicTime: iso(event.time) }]
        : event.quantities.map((quantity, j) => ({
            kind: 'Execution' as const,
            tradeId,
            action: event.side,
            instrument: contract ?? { kind: 'Stock' as const, symbol },
            intent: { kind: 'ServesPlannedLeg' as const, plannedLegId: planLeg },
            quantity: String(quantity),
            price: cents((option ? premiumOf(i, option.kind) : entry) + (event.side === (option && !isLongOption(option.kind) ? 'Buy' : 'Sell') ? exitMove : 0) + ((n + j) % 21) - 10),
            fee: (n + j) % 3 === 0 ? '0' : '0.65',
            economicTime: iso(event.time + j * MINUTE),
          }));
      const definitionId = changeDefinition.definition.id;
      const disposition = reflectionPlan.dispositions[n]!;
      const reflection = captureReflection(disposition, n, symbol, definitionId);
      const closeDisposition = event.closeNumber === undefined ? undefined : closePlan.dispositions[event.closeNumber]!;
      const reasonOf = REASON_OF_TWENTY[i % 20]!;
      const closeReview = closeDisposition === undefined ? undefined : captureCloseReview(closeDisposition, event.closeNumber!, symbol, closeReviewDefinition.definition.id);
      const recorded = await app.TradeWorkflows.recordPositionChange({
        originTradeId: tradeId,
        trades: [{ tradeId, expectedFactRevision: state.factRevision }],
        members,
        reflection,
        // An Expiration needs no Close Reason: the contract expired rather than being closed by the trader's decision.
        ...(closeReview && { ...(!event.expire && { closeReasonId: closeReasonIds[reasonOf]! }), closeReview }),
      });
      if (recorded.kind !== 'Recorded') throw new Error(`trade ${i} change ${n}: ${recorded.kind}`);
      if (contract) {
        if (event.terminal) held.delete(i);
        else held.set(i, { key: instrumentKey(contract), expiration: contract.expiration });
      }
      if (event.terminal) {
        if (!event.expire) {
          const label = BENCH_CLOSE_REASONS[reasonOf];
          stats.closeReasons[label] = (stats.closeReasons[label] ?? 0) + 1;
        }
        tradeState.delete(i);
      } else {
        tradeState.set(i, { planLeg, factRevision: recorded.receipt.factRevision });
      }
      const momentDate = iso(event.time).slice(0, 10);
      if (reflection.kind !== 'Defer') {
        stats.dispositions[disposition]++;
      } else {
        if (recorded.receipt.reflection.kind !== 'Debt') throw new Error(`trade ${i} change ${n}: deferred but recorded ${recorded.receipt.reflection.kind}`);
        const debtId = recorded.receipt.reflection.id;
        deferred.set(debtId, { debtId, tradeId, underlying: symbol, kind: 'PositionChange', positionChange: n, momentDate, disposition });
        if (disposition === 'outstanding') stats.dispositions.outstanding++;
      }
      if (closeReview === undefined || closeDisposition === undefined) return;
      if (closeReview.kind !== 'Defer') {
        stats.closeReviews[closeDisposition]++;
        return;
      }
      if (recorded.receipt.closeReview?.kind !== 'Debt') throw new Error(`trade ${i} close ${event.closeNumber}: deferred but recorded ${recorded.receipt.closeReview?.kind}`);
      const closeDebtId = recorded.receipt.closeReview.id;
      deferred.set(closeDebtId, { debtId: closeDebtId, tradeId, underlying: symbol, kind: 'CloseReview', positionChange: event.closeNumber!, momentDate, disposition: closeDisposition });
      if (closeDisposition === 'outstanding') stats.closeReviews.outstanding++;
    };

    // The trader, session by session: the day's Plans and Position Changes, then (after the
    // session's completion) its Marks, the Review, and an Action for each eligible Trade.
    const started = performance.now();
    let next = 0;
    for (const [n, session] of sessions.entries()) {
      const eventsAt = performance.now();
      while (events[next] && events[next]!.time < Date.parse(session.completion)) await applyEvent(events[next++]!);
      timing['events'] = (timing['events'] ?? 0) + performance.now() - eventsAt;
      const last = n === sessions.length - 1;
      // Five minutes after the session's completion: the pinned clock for the rest of the session. The full run's last
      // session is the as-of session, and its clock is the as-of instant, Friday 17:00 New York (D7 section 1.4).
      now = last && profile.full ? BENCH_AS_OF_INSTANT : iso(Date.parse(session.completion) + 5 * MINUTE);
      const marksAt = performance.now();
      await saveMarks(session, n, last);
      timing['marks'] = (timing['marks'] ?? 0) + performance.now() - marksAt;
      const reviewAt = performance.now();
      // The first session has no Trade to review, and since D6 the Review's frames also ask for the previous
      // session's close, which the session policy does not cover for the first covered date.
      if (n > 0) await reviewSession(session, last);
      timing['review'] = (timing['review'] ?? 0) + performance.now() - reviewAt;
      if ((n + 1) % 25 === 0 || (options.sessions !== undefined && options.sessions <= 100)) {
        const phases = JSON.stringify(Object.fromEntries(Object.entries(timing).map(([k, v]) => [k, Math.round(v / 1000)])));
        console.log(`bench: session ${n + 1} of ${sessions.length} (${session.date}), ${Math.round((performance.now() - started) / 1000)} s, ${stats.marks} Marks, ${stats.actions} Actions; seconds by phase ${phases}`);
      }
    }
    if (next !== events.length) throw new Error(`${events.length - next} events after the last session`);
    expectedTotals = { positionChanges: positionChangeTotal, executions: executionTotal, profile, reflectionCounts: reflectionPlan.counts, closeCounts: closePlan.counts, closeReasonLabels, expirations, expirationsAfterPartialExit };
  } finally {
    generating = false;
  }
  const open = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' });
  if (open.kind !== 'Ready') throw new Error(`browse Open: ${open.kind}`);
  if (!final.asOf || !expectedTotals) throw new Error('no session was simulated');
  const stored = await countStored(expectedTotals.closeReasonLabels);
  const perSession = markedPerSession.length === 0 ? 0 : markedPerSession.reduce((a, b) => a + b, 0) / markedPerSession.length;
  const counts: BenchCounts = { ...stored, instrumentsPerSessionMean: Math.round(perSession * 10) / 10, instrumentsPerSessionMax: Math.max(0, ...markedPerSession) };
  // The facade's own tallies must agree with what is stored.
  if (counts.marks !== stats.marks || counts.markCorrections !== stats.corrections || counts.actions !== stats.actions || counts.editedActions !== stats.edited) {
    throw new Error(`stored ${counts.marks}/${counts.markCorrections}/${counts.actions}/${counts.editedActions} Marks/corrections/Actions/edited, saved ${stats.marks}/${stats.corrections}/${stats.actions}/${stats.edited}`);
  }
  // Section 1.4 at D6: the Trades, Position Changes and Executions are the schedule's; every Position Change and
  // every Close got its disposition; and the stored Journal agrees with the facade's tallies.
  const expected = expectedTotals;
  const p = expected.profile;
  if (
    counts.trades !== p.trades ||
    counts.closedTrades !== p.closedTrades ||
    counts.openTrades !== p.openTrades ||
    counts.plannedTrades !== p.plannedTrades ||
    counts.positionChanges !== expected.positionChanges ||
    counts.executions !== expected.executions
  ) {
    throw new Error(`stored ${JSON.stringify(counts)} disagree with the profile ${JSON.stringify(p)}, ${expected.positionChanges} Position Changes, ${expected.executions} Executions`);
  }
  const d = stats.dispositions;
  const c = stats.closeReviews;
  for (const kind of Object.keys(BENCH_DISPOSITION_PER_MILLE) as BenchDisposition[]) {
    if (d[kind] !== expected.reflectionCounts[kind]) throw new Error(`reflection disposition ${kind}: ${d[kind]} applied, ${expected.reflectionCounts[kind]} planned`);
    if (c[kind] !== expected.closeCounts[kind]) throw new Error(`Close Review disposition ${kind}: ${c[kind]} applied, ${expected.closeCounts[kind]} planned`);
  }
  const outstandingDebts = [...deferred.values()].map(
    (debt): BenchOutstandingDebt => ({ debtId: debt.debtId, tradeId: debt.tradeId, underlying: debt.underlying, kind: debt.kind, positionChange: debt.positionChange, momentDate: debt.momentDate }),
  );
  const reasonsStored = JSON.stringify(Object.entries(counts.closeReasons).sort());
  const reasonsApplied = JSON.stringify(Object.entries(stats.closeReasons).sort());
  if (
    counts.positionChangeReflectionEntries !== d.complete + d.answered ||
    counts.positionChangeReflectionDeclines !== d.declined + d.declinedLater ||
    counts.closeReviewEntries !== c.complete + c.answered ||
    counts.closeReviewDeclines !== c.declined + c.declinedLater ||
    counts.closeReviewDebts !== c.answered + c.declinedLater + c.outstanding ||
    counts.closeReviewDebtsSettled !== c.answered ||
    counts.closeReviewDebtsDeclined !== c.declinedLater ||
    counts.closeReviewDebtsOutstanding !== c.outstanding ||
    counts.debts !== d.answered + d.declinedLater + d.outstanding + c.answered + c.declinedLater + c.outstanding ||
    counts.debtsSettled !== d.answered + c.answered ||
    counts.debtsDeclined !== d.declinedLater + c.declinedLater ||
    counts.debtsOutstanding !== d.outstanding + c.outstanding ||
    outstandingDebts.length !== d.outstanding + c.outstanding ||
    final.asOf.asOfDueReflections !== d.outstanding + c.outstanding ||
    reasonsStored !== reasonsApplied ||
    // An Expiration needs no Close Reason, so the Closed Trades with one are those that did not expire.
    Object.values(counts.closeReasons).reduce((a, b) => a + b, 0) !== p.closedTrades - expected.expirations ||
    counts.expirations !== expected.expirations ||
    counts.expirationsAfterPartialExit !== expected.expirationsAfterPartialExit
  ) {
    throw new Error(
      `stored ${JSON.stringify(counts)} disagree with dispositions ${JSON.stringify(d)} and Close Reviews ${JSON.stringify(c)}, ${outstandingDebts.length} Outstanding, ${final.asOf.asOfDueReflections} due at as-of`,
    );
  }
  // The as-of Review's settlement family is the Open option Trades whose contract expires on the as-of date.
  const settlementWanted = Math.min(BENCH_SETTLEMENT_DUE, counts.openOptionTrades);
  if (final.asOf.asOfReview.settlement.length !== settlementWanted) {
    throw new Error(`the as-of Review has ${final.asOf.asOfReview.settlement.length} Settlement Due items, expected ${settlementWanted}`);
  }
  // The full profile is exactly section 1.4's, by construction.
  if (p.full) {
    // D7: 30% options (Long Call 12%, Long Put 8%, Cash-Secured Put 10%), 5,000 long-option Plans of which 10% are
    // Authorized, 60 Open option Trades, and 40% of the 7,410 Closed option Trades expiring (2,964).
    const exact =
      counts.trades === 25_000 && counts.closedTrades === 24_700 && counts.openTrades === 200 && counts.plannedTrades === 100 &&
      counts.optionTrades === 7_500 && counts.longCalls === 3_000 && counts.longPuts === 2_000 && counts.cashSecuredPuts === 2_500 &&
      counts.exerciseIntentPlans === 5_000 && counts.authorizedPlans === 500 && counts.openOptionTrades === 60 && counts.expirations === 2_964 &&
      counts.closeReviewEntries + counts.closeReviewDeclines + counts.closeReviewDebtsOutstanding === 24_700;
    if (!exact) throw new Error(`the full profile misses section 1.4: ${JSON.stringify(counts)}`);
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
