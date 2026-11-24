// The bench build's generator (D2 T2.20, rewritten by D8 T8.18, plan P35). It writes the benchmark dataset of the
// plan's section 1.4 directly as a schema-7 backup artifact, with the production artifact writer, and records its
// own expected values: no domain command is driven and no browser is needed. The dataset is deterministic for its
// generator version: identities are formulas of a record's place, times come from the session policy, and every
// choice is a function of the seed and the Trade's place in the order.
// The mix is D7 section 1.4's: 25,000 Trades (200 Open, 100 Planned) planned over the sessions from 2024-01-02, 30% of
// them single-leg options, the Review Actions of every session, the Marks of the held Instruments, and the reflections,
// Close Reviews and Debts by the plan's dispositions.
import { runExport } from '../coordinators/workspace/backup-export.ts';
import { expiredOn, instrumentKey, type Instrument, type OptionInstrument } from '../domain/instrument/index.ts';
import { D6_JOURNAL_MANIFEST, prepareJournalSeed } from '../modules/journal/index.ts';
import { D7_CATALOG_MANIFEST, prepareSeed } from '../modules/reference-catalog/index.ts';
import { exportLayoutFor, SCHEMA_VERSION, type ExportReadResult, type SessionPolicyIdentity } from '../persistence/index.ts';
import { readArtifact, type ArtifactDigests } from '../backup/format/index.ts';
import { derive, type LifecycleState, type PlannedLegInput, type ConditionInput } from '../domain/trade-analysis/index.ts';
import { analysisInputOf, repairedDocument, type CloseReasonFact, type TradeDocument, type TradeFact } from '../modules/trade-record/index.ts';
import {
  type BenchAsOfReview,
  type BenchCounts,
  type BenchOutstandingDebt,
  BENCH_CLOSE_REASONS,
  BENCH_AS_OF_INSTANT,
  BENCH_TIME_ZONE,
  BENCH_GENERATOR_MARKER,
  BENCH_GENERATOR_VERSION,
  BENCH_OPEN_STOCK_INSTRUMENTS,
  BENCH_PROFILE,
  BENCH_DISPOSITION_PER_MILLE,
  BENCH_SEED,
  BENCH_SETTLEMENT_DUE,
  BENCH_TAIL_SESSIONS,
  benchScale,
  type BenchDisposition,
} from './bench.ts';
import type { AnswerInput } from '../modules/journal/index.ts';
import type { Application } from './compose.ts';
import type { IncoherentOpenTradeItem, OpenTradeItem } from './types.ts';

// mulberry32: a small seeded generator.
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

const MINUTE = 60_000;

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

// The Underlying Price Stop and Target beside the Plan's entry: offsets from the Underlying by option kind.
const underlyingStopOffset = (kind: OptionKind) => {
  if (kind === 'LongCall') return -3;
  if (kind === 'LongPut') return 3;
  return -6;
};
const underlyingTargetOffset = (kind: OptionKind) => {
  if (kind === 'LongCall') return 12;
  if (kind === 'LongPut') return -12;
  return 5;
};

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

// ---- The artifact (D8 T8.18, P35) ----------------------------------------------------------------------------------

const BENCH_DATABASE = 'tj-ws-bench';
const BENCH_RELEASE = `tj-bench-generator-v${BENCH_GENERATOR_VERSION}`;
// Records per batch, as the production export reads them.
const BATCH_SIZE = 500;
const pad = (n: number, width = 7) => String(n).padStart(width, '0');

type Row = Record<string, unknown>;

// The seeded Catalog and Journal, with the identities the generated records name.
function seedOf() {
  let catalogNumber = 0;
  const seeded = prepareSeed([], D7_CATALOG_MANIFEST, { next: () => `cat-${pad(++catalogNumber, 3)}` });
  if (seeded.kind !== 'Additions') throw new Error('the Catalog seed conflicts');
  const trader = (kind: 'Institution' | 'Account', label: string, number: number, extra: Row = {}): Row => ({
    id: `cat-${pad(number, 3)}`,
    kind,
    label,
    normalizedLabel: label.toLowerCase(),
    active: true,
    origin: 'Trader',
    recordRevision: 1,
    ...extra,
  });
  const institutions: Row[] = [];
  const accounts: Row[] = [];
  for (const [k, [institution, labels]] of ([
    ['Fidelity', ['Individual Brokerage', 'Roth IRA']],
    ['Charles Schwab', ['Joint Brokerage', 'Traditional IRA']],
    ['Interactive Brokers', ['Margin', 'Cash']],
  ] as const).entries()) {
    const institutionRow = trader('Institution', institution, 101 + k);
    institutions.push(institutionRow);
    labels.forEach((label, j) => accounts.push(trader('Account', label, 201 + 2 * k + j, { institutionId: institutionRow['id'] })));
  }
  const catalog: Row[] = [...seeded.records, ...institutions, ...accounts].map((row) => ({ ...row })).sort((a, b) => ((a['id'] as string) < (b['id'] as string) ? -1 : 1));
  let definitionNumber = 0;
  const journalSeed = prepareJournalSeed([], [], D6_JOURNAL_MANIFEST, { next: () => `jdef-${pad(++definitionNumber, 3)}` });
  if (journalSeed.kind !== 'Additions') throw new Error('the Journal seed conflicts');
  return {
    catalog,
    journalTypes: journalSeed.types.map((row): Row => ({ ...row })).sort((a, b) => ((a['id'] as string) < (b['id'] as string) ? -1 : 1)),
    journalDefinitions: journalSeed.definitions.map((row): Row => ({ ...row })),
    ids: {
      accounts: accounts.map((row) => row['id'] as string),
      strategies: Object.fromEntries(seeded.records.flatMap((row) => (row.kind === 'Strategy' ? [[row.productKey, row.id]] : []))),
      closeReasons: BENCH_CLOSE_REASONS.map((label) => seeded.records.find((row) => row.kind === 'CloseReason' && row.label === label)!.id),
    } satisfies CatalogIds,
  };
}

// One real session: its date, its close, and its completion (the close plus the policy's buffer).
export interface BenchSession {
  readonly date: string;
  readonly close: string;
  readonly completion: string;
}
// What the session policy says of the run, handed in by the caller (only Market Data and the composition root import the
// policy, D4 A39): its identity, which the Workspace section records, and every real session from the clock start through the
// as-of date (the plan's section 1.4).
export interface BenchCalendar {
  readonly identity: SessionPolicyIdentity;
  readonly sessions: readonly BenchSession[];
}

// The sessions the run covers: all of them, or the first `limit` of them.
function sessionsOf(calendar: BenchCalendar, limit?: number) {
  const all = calendar.sessions;
  const run = limit === undefined ? all : all.slice(0, limit);
  return { run, profile: benchScale(run.length, all.length) };
}

const iso = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z');
// A decimal as the Plan stores it: no trailing fractional zeros.
const normalized = (text: string) => (text.includes('.') ? text.replace(/\.?0+$/, '') : text);

// One Position Change as the Journal and the tallies need it, in the generated (time) order.
interface ChangeRef {
  readonly number: number;
  readonly index: number;
  readonly tradeId: string;
  readonly symbol: string;
  readonly time: number;
  readonly factId: string;
  readonly terminal: boolean;
  readonly closeNumber: number | undefined;
}

// A Trade being built from its events: the stored document without its lifecycle and Deviations, which the
// Trade Analysis fills in when the document is written.
interface TradeBuild {
  readonly index: number;
  readonly tradeId: string;
  readonly symbol: string;
  readonly planFactId: string;
  readonly planTime: number;
  readonly option: OptionSpec | undefined;
  readonly document: {
    tradeId: string;
    accountId: string;
    strategyId: string;
    lifecycle: LifecycleState;
    planTime: string;
    underlying: string;
    factRevision: number;
    facts: TradeFact[];
    recordedSequenceCounter: number;
    lastActivity: string;
    closeReasonFacts?: CloseReasonFact[];
  };
  // The first Execution and the terminal Position Change, for the Trade's presence in each session's Review.
  firstExposure: number | undefined;
  terminalTime: number | undefined;
  legs: readonly PlannedLegInput[];
}

interface CatalogIds {
  readonly accounts: readonly string[];
  readonly strategies: Readonly<Record<string, string>>;
  readonly closeReasons: readonly string[];
}

// Walks the schedule once, building every Trade's facts in the order they were recorded: the Plan, its Planned Leg, Stops
// and Targets, then each Position Change with its members, and a terminal one's Close Reason.
function buildTrades(events: readonly (PlanEvent | ChangeEvent)[], profile: ReturnType<typeof benchScale>, ids: CatalogIds) {
  const builds: TradeBuild[] = [];
  const changes: ChangeRef[] = [];
  const REASON_OF_TWENTY = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3] as const;
  for (const event of events) {
    const i = event.index;
    const symbol = symbolOf(i, profile.closedTrades, profile.openTrades);
    if (event.kind === 'Plan') {
      const tradeId = `tr-${pad(i, 5)}`;
      const option = event.option;
      const entry = intendedEntryCents(i);
      // An option Plan names its contract, enters at a premium, and its Stop and Target are Underlying prices around the
      // Underlying's level `u`; Long Calls and Cash-Secured Puts rise to the Target, Long Puts fall to it.
      const u = 40 + (i % 160);
      const premium = option ? premiumOf(i, option.kind) : 0;
      // A203's option-price mix, by the Trade's place among the option Trades: 10% hold only option-price conditions,
      // 30% an option-price Stop beside the Underlying Stop. A long option's Stop is below the entry and its Target above; the short Put reverses both.
      const mix = option ? optionsBefore(i) % 10 : -1;
      const optionOnly = mix === 0;
      const optionStop = mix >= 1 && mix <= 3;
      const optionLong = option !== undefined && isLongOption(option.kind);
      const optionStopPrice: ConditionInput = { kind: 'StructureValue', price: normalized(cents(optionLong ? premium - 100 : premium + 100)) };
      const optionTargetPrice: ConditionInput = { kind: 'StructureValue', price: normalized(cents(optionLong ? premium + 300 : premium - 50)) };
      let leg: PlannedLegInput;
      let stops: ConditionInput[];
      let targets: ConditionInput[];
      if (option) {
        const intendedEntry = normalized(cents(premium));
        leg = optionLong
          ? { side: 'Long', instrument: contractOf(i, symbol, option), quantity: String(option.contracts), intendedEntry }
          : { side: 'Short', instrument: contractOf(i, symbol, option), quantity: String(-option.contracts), intendedEntry };
        stops = [];
        if (!optionOnly) stops.push({ kind: 'UnderlyingPrice', price: `${u + underlyingStopOffset(option.kind)}` });
        if (optionOnly || optionStop) stops.push(optionStopPrice);
        targets = optionOnly ? [optionTargetPrice] : [{ kind: 'UnderlyingPrice', price: `${u + underlyingTargetOffset(option.kind)}` }];
      } else {
        leg = { side: 'Long', instrument: { kind: 'Stock', symbol }, quantity: String(plannedQuantity(i)), intendedEntry: normalized(cents(entry)) };
        stops = [{ kind: 'UnderlyingPrice', price: normalized(cents(entry - Math.round(entry * 0.05))) }];
        targets = [{ kind: 'UnderlyingPrice', price: normalized(cents(entry + Math.round(entry * 0.12))) }];
      }
      let k = 0;
      const next = () => ({ factId: `${tradeId}-f${pad(++k, 3)}`, recordedSequence: k });
      const planFact = next();
      const legFact = next();
      const facts: TradeFact[] = [
        { ...planFact, kind: 'Plan', versions: [{ versionNumber: 1, value: { economicTime: iso(event.time), underlying: symbol, thesis: `${symbol} reclaimed its 50-day average on rising volume after a tight base; plan ${i}.`, invalidation: `A daily close back inside the base, below ${cents(entry - Math.round(entry * 0.05))}.`, ...(option && isLongOption(option.kind) && { exerciseIntent: option.authorized ? ('Authorized' as const) : ('NotAuthorized' as const) }) } }] },
        { ...legFact, kind: 'PlannedLeg', versions: [{ versionNumber: 1, value: leg }] },
        ...stops.map((value): TradeFact => ({ ...next(), kind: 'Stop', versions: [{ versionNumber: 1, value }] })),
        ...targets.map((value): TradeFact => ({ ...next(), kind: 'Target', versions: [{ versionNumber: 1, value }] })),
      ];
      builds[i] = {
        index: i,
        tradeId,
        symbol,
        planFactId: planFact.factId,
        planTime: event.time,
        option,
        document: {
          tradeId,
          accountId: ids.accounts[i % ids.accounts.length]!,
          strategyId: ids.strategies[option ? STRATEGY_OF[option.kind] : 'strategy.long-stock']!,
          lifecycle: 'Planned',
          planTime: iso(event.time),
          underlying: symbol,
          factRevision: 1,
          facts,
          recordedSequenceCounter: k,
          lastActivity: iso(event.time),
        },
        firstExposure: undefined,
        terminalTime: undefined,
        legs: [leg],
      };
      continue;
    }
    const build = builds[i]!;
    const { document } = build;
    let k = document.recordedSequenceCounter;
    const next = () => ({ factId: `${build.tradeId}-f${pad(++k, 3)}`, recordedSequence: k });
    const legId = document.facts[1]!.factId;
    const option = event.option;
    const contract = option ? contractOf(i, symbol, option) : undefined;
    const entry = intendedEntryCents(i);
    // An exit of a long option sells above the premium paid; the buy-back of a short one is below the credit.
    const shortOption = option !== undefined && !isLongOption(option.kind);
    const exitMove = shortOption ? -40 : 60;
    const change = next();
    const members: TradeFact[] = event.expire
      ? [{ ...next(), kind: 'Expiration', versions: [{ versionNumber: 1, value: { economicTime: iso(event.time), instrument: contract!, quantity: String(event.quantities[0]) } }] }]
      : event.quantities.map((quantity, j): TradeFact => ({
          ...next(),
          kind: 'Execution',
          versions: [
            {
              versionNumber: 1,
              value: {
                economicTime: iso(event.time + j * MINUTE),
                action: event.side,
                instrument: contract ?? { kind: 'Stock', symbol },
                intent: { kind: 'ServesPlannedLeg', plannedLegId: legId },
                quantity: String(quantity),
                price: cents((option ? premiumOf(i, option.kind) : entry) + (event.side === (shortOption ? 'Buy' : 'Sell') ? exitMove : 0) + ((event.number + j) % 21) - 10),
                fee: (event.number + j) % 3 === 0 ? '0' : '0.65',
              },
            },
          ],
        }));
    document.facts.push(
      { ...change, kind: 'PositionChange', versions: [{ versionNumber: 1, value: { economicTime: iso(event.time), originTradeId: build.tradeId, participatingTradeIds: [build.tradeId], memberIds: members.map((member) => member.factId) } }] },
      ...members,
    );
    if (event.terminal && !event.expire) {
      document.closeReasonFacts = [{ ...next(), kind: 'CloseReason', versions: [{ versionNumber: 1, value: { closeReasonId: ids.closeReasons[REASON_OF_TWENTY[i % 20]!]!, terminalPositionChangeId: change.factId } }] }];
    }
    document.recordedSequenceCounter = k;
    document.factRevision += 1;
    document.lastActivity = iso(event.time);
    if (!event.expire && build.firstExposure === undefined) build.firstExposure = event.time;
    if (event.terminal) build.terminalTime = event.time;
    changes[event.number] = { number: event.number, index: i, tradeId: build.tradeId, symbol, time: event.time, factId: change.factId, terminal: event.terminal, closeNumber: event.closeNumber };
  }
  return { builds, changes };
}

const STRATEGY_OF: Readonly<Record<OptionKind, string>> = { LongCall: 'strategy.long-call', LongPut: 'strategy.long-put', CashSecuredPut: 'strategy.cash-secured-put' };

// The stored Trade: its lifecycle and recorded Deviations are what Trade Analysis expects of its facts, written the way a
// Restore repair would write them, so a Restore finds nothing to repair.
function stored(build: TradeBuild): TradeDocument {
  const record = analysisInputOf(build.document);
  const derived = derive({ record, candidate: { digest: build.tradeId, before: record } });
  if (derived.kind !== 'Derived') throw new Error(`Trade ${build.tradeId}: its facts cannot be replayed`);
  let occurrence = 0;
  return repairedDocument(build.document, { expectedLifecycle: derived.expectedLifecycle, deviationActions: derived.reconciliation!.deviationActions }, { next: () => `${build.tradeId}-d${++occurrence}` });
}

const COMPLETION_NOTE = 5 * MINUTE;

// The instant the work of session `n` is saved: five minutes after its completion; the full run's last session is the
// as-of session, and its clock is the as-of instant, Friday 17:00 New York (D7 section 1.4).
// Even Trade numbers decline; the wording differs by when the decline is recorded.
const declineWording = (n: number, later: boolean, whenLater: string, whenNow: string) => {
  if (n % 2 !== 0) return undefined;
  return later ? whenLater : whenNow;
};
// Settlement list order: expiration, then trade.
const bySettlementOrder = (a: { expiration: string; tradeId: string }, b: { expiration: string; tradeId: string }) => {
  if (a.expiration !== b.expiration) return a.expiration < b.expiration ? -1 : 1;
  return a.tradeId < b.tradeId ? -1 : 1;
};
const savedAtOf = (completion: string, last: boolean, full: boolean) => (last && full ? BENCH_AS_OF_INSTANT : iso(Date.parse(completion) + COMPLETION_NOTE));

// The Marks of every session: each of the 90 stock Instruments, except that the as-of session leaves 10 of them Missing
// (the disclosed fraction), and the contract of each option Trade held at the session's cutoff (at or before its
// expiration date). Every 100th Mark is corrected once. Trades on the same contract share its Mark.
function observationsOf(sessions: readonly BenchSession[], profile: ReturnType<typeof benchScale>, builds: readonly TradeBuild[]) {
  const optionBuilds = builds.filter((build) => build.option !== undefined);
  function* rows(visit: (summary: { marked: number; missing: readonly string[] }) => void = () => {}): Generator<Row> {
    let markNumber = 0;
    for (const [n, session] of sessions.entries()) {
      const last = n === sessions.length - 1;
      const completion = Date.parse(session.completion);
      const savedAt = savedAtOf(session.completion, last, profile.full);
      const contracts = new Map<string, number>();
      for (const build of optionBuilds) {
        const held = build.firstExposure !== undefined && build.firstExposure < completion && !(build.terminalTime !== undefined && build.terminalTime < completion);
        if (!held) continue;
        const contract = contractOf(build.index, build.symbol, build.option!);
        if (expiredOn(contract, session.date)) continue;
        const key = instrumentKey(contract);
        if (!contracts.has(key)) contracts.set(key, 50 + ((build.index * 977 + n * 131) % 900));
      }
      const keys = [
        ...STOCK_INSTRUMENTS.map((key, k) => ({ key, price: 2_000 + ((k * 977) % 18_000) + ((n * 131 + k * 17) % 301) - 150, skip: last && k % (BENCH_OPEN_STOCK_INSTRUMENTS / BENCH_PROFILE.missingAsOfInstruments) === 7 })),
        ...[...contracts].map(([key, price]) => ({ key, price, skip: false })),
      ];
      const made: Row[] = [];
      let marked = 0;
      for (const [position, { key, price, skip }] of keys.entries()) {
        if (skip) continue;
        marked++;
        const id = `mk-${pad(n, 4)}-${pad(position, 3)}`;
        const initial = { revisionId: `${id}-1`, revisionNumber: 1, price: normalized(cents(price)), source: 'Manual', intention: 'InitialManual', observedAt: savedAt, savedAt };
        const corrected = ++markNumber % BENCH_PROFILE.correctedMarkEvery === 0;
        made.push({
          instrumentKey: key,
          tradingDate: session.date,
          resolutionRevision: corrected ? 2 : 1,
          marks: corrected
            ? [
                initial,
                {
                  revisionId: `${id}-2`,
                  revisionNumber: 2,
                  price: normalized(cents(price + 1)),
                  source: 'Manual',
                  intention: 'Correction',
                  reason: 'Keyed the wrong digit from the broker statement.',
                  supersedes: initial.revisionId,
                  correctionFootprint: { key: { instrumentKey: key, tradingDate: session.date }, effectDate: session.date, savedAt, domains: ['Valuation', 'ConditionStatus', 'Replay'], replayInterval: { from: session.date, to: session.date } },
                  observedAt: savedAt,
                  savedAt,
                },
              ]
            : [initial],
          effectiveMarkId: corrected ? `${id}-2` : `${id}-1`,
          acknowledgments: [],
          effectiveAcknowledgmentId: null,
        });
      }
      visit({ marked, missing: keys.filter((entry) => entry.skip).map((entry) => entry.key) });
      // Primary-key order within the session: the Instrument key.
      yield* made.sort((a, b) => ((a['instrumentKey'] as string) < (b['instrumentKey'] as string) ? -1 : 1));
    }
  }
  // One pass for the counts the header states and the expected values.
  const summary = { count: 0, marks: 0, corrections: 0, perSession: [] as number[], missing: [] as string[] };
  for (const row of rows((session) => {
    summary.perSession.push(session.marked);
    if (session.missing.length > 0) summary.missing = [...session.missing];
  })) {
    summary.count++;
    summary.marks++;
    if ((row['marks'] as unknown[]).length > 1) summary.corrections++;
  }
  return { ...summary, rows: () => rows() };
}

const ACTIONS = ['Exit', 'Roll', 'Adjust'] as const;
type ActionChoice = 'Hold' | (typeof ACTIONS)[number];

// The Daily Trade Review Action of every Trade open at the cutoff of each session after the first: 85% Hold, 15% Exit,
// Roll or Adjust with an Intent, and 2% of them edited once (a second version). A Trade is open at a cutoff when its first
// Execution is before it and its terminal Position Change is not.
function actionsOf(sessions: readonly BenchSession[], profile: ReturnType<typeof benchScale>, builds: readonly TradeBuild[], definition: Definition) {
  const byChoice: Record<string, number> = {};
  function* rows(): Generator<Row> {
    let n = 0;
    for (const [s, session] of sessions.entries()) {
      if (s === 0) continue;
      const completion = Date.parse(session.completion);
      const last = s === sessions.length - 1;
      const savedAt = savedAtOf(session.completion, last, profile.full);
      const walk = builds.filter((build) => build.firstExposure !== undefined && build.firstExposure < completion && !(build.terminalTime !== undefined && build.terminalTime < completion));
      for (const build of walk) {
        const choice: ActionChoice = n % 20 < 3 ? ACTIONS[n % 3]! : 'Hold';
        const responses = (action: ActionChoice) =>
          definition.respond({
            'prompt.daily-trade-review.action': { kind: 'Option', optionId: `option.daily-trade-review.action.${action.toLowerCase()}` },
            ...(action !== 'Hold' && { 'prompt.daily-trade-review.intent': { kind: 'Text', text: `Cut the ${build.symbol} exposure if the next close is below the stop; action ${n}.` } }),
          });
        const versions = [{ versionNumber: 1, definitionId: definition.id, responses: responses(choice), savedAt }];
        if (n % BENCH_PROFILE.editedActionEvery === 0) versions.push({ versionNumber: 2, definitionId: definition.id, responses: responses(choice === 'Hold' ? 'Adjust' : 'Hold'), savedAt });
        byChoice[choice] = (byChoice[choice] ?? 0) + 1;
        yield {
          id: `je-d-${pad(n)}`,
          entryTypeKey: 'entry-type.daily-trade-review',
          sourceKey: 'source.daily-review',
          anchor: { kind: 'Trade', tradeId: build.tradeId },
          origin: { kind: 'DailyReview', factId: build.tradeId, reviewDate: session.date },
          momentTime: iso(Date.parse(session.close)),
          authoredTime: savedAt,
          obligationKey: ['DailyTradeReview', session.date, build.tradeId],
          anchorTradeId: build.tradeId,
          versions,
        };
        n++;
      }
    }
  }
  let count = 0;
  let edited = 0;
  for (const row of rows()) {
    count++;
    if ((row['versions'] as unknown[]).length > 1) edited++;
  }
  const choices = { ...byChoice };
  return { count, edited, byChoice: choices, rows };
}

// A seeded Entry definition: its identity and the form of its responses, each prompt answered or Unanswered.
interface Definition {
  readonly id: string;
  respond(answers: Readonly<Record<string, AnswerInput>>): Row[];
}
function definitionOf(rows: readonly Row[], entryTypeKey: string): Definition {
  const found = rows.find((row) => row['entryTypeKey'] === entryTypeKey);
  if (!found) throw new Error(`no definition of ${entryTypeKey}`);
  const prompts = found['prompts'] as readonly { id: string }[];
  return { id: found['id'] as string, respond: (answers) => prompts.map(({ id }): Row => ({ promptId: id, value: answers[id] ?? { kind: 'Unanswered' } })) };
}

// The Journal outcome of every Position Change and Close, by the plan's dispositions (decision of D5 and D6): completed
// or declined at capture, deferred and answered or declined in the next Review (the Debt is then Settled or Declined), or
// deferred and still Outstanding. Plus each Plan's reflection and the Actions.
function journalOf(args: {
  readonly sessions: readonly BenchSession[];
  readonly profile: ReturnType<typeof benchScale>;
  readonly builds: readonly TradeBuild[];
  readonly changes: readonly ChangeRef[];
  readonly definitions: readonly Row[];
  readonly reflectionPlan: ReturnType<typeof dispositionsFor>;
  readonly closePlan: ReturnType<typeof dispositionsFor>;
}) {
  const { sessions, profile, builds, changes, definitions } = args;
  const plan = definitionOf(definitions, 'entry-type.plan-reflection');
  const reflection = definitionOf(definitions, 'entry-type.position-change-reflection');
  const closeReview = definitionOf(definitions, 'entry-type.close-review');
  const actions = actionsOf(sessions, profile, builds, definitionOf(definitions, 'entry-type.daily-trade-review'));
  const completions = sessions.map((session) => Date.parse(session.completion));
  // The Review that resolves a deferred outcome is the next session's.
  const resolvedAt = (time: number) => {
    const placed = completions.findIndex((completion) => completion > time);
    return savedAtOf(sessions[placed + 1]!.completion, placed + 1 === sessions.length - 1, profile.full);
  };
  // What each outcome of one kind carries.
  interface Kind {
    readonly store: 'b' | 'c';
    readonly definition: Definition;
    readonly entryTypeKey: string;
    readonly captureSource: string;
    readonly obligationKey: (change: ChangeRef) => string;
    readonly answers: (number: number, symbol: string, later: boolean) => Record<string, AnswerInput>;
    readonly declineReason: (number: number, later: boolean) => string | undefined;
  }
  const kinds: Record<'pc' | 'close', Kind> = {
    pc: {
      store: 'b',
      definition: reflection,
      entryTypeKey: 'entry-type.position-change-reflection',
      captureSource: 'source.position-change',
      obligationKey: (change) => `PositionChangeReflection:${change.factId}`,
      answers: (n, symbol) => reflectionAnswers(n, symbol),
      declineReason: (n, later) => declineWording(n, later, 'Could not recall the decision well enough to answer.', 'Filled during a fast open; no time to reflect.'),
    },
    close: {
      store: 'c',
      definition: closeReview,
      entryTypeKey: 'entry-type.close-review',
      captureSource: 'source.trade-close',
      obligationKey: (change) => `CloseReview:${change.tradeId}`,
      answers: closeReviewAnswers,
      declineReason: (n, later) => declineWording(n, later, 'Cannot recall the Trade well enough to say.', 'Nothing new to learn from this one.'),
    },
  };
  // Every outcome in the generated order: its kind, its number, the Position Change it follows, and its disposition.
  const outcomes = changes.flatMap((change) => [
    { kind: kinds.pc, number: change.number, change, disposition: args.reflectionPlan.dispositions[change.number]! },
    ...(change.closeNumber === undefined ? [] : [{ kind: kinds.close, number: change.closeNumber, change, disposition: args.closePlan.dispositions[change.closeNumber]! }]),
  ]);
  type Outcome = (typeof outcomes)[number];
  const idOf = (prefix: string, outcome: Outcome) => `${prefix}-${outcome.kind.store}-${pad(outcome.number)}`;
  const basis = (outcome: Outcome, source: string) => ({
    entryTypeKey: outcome.kind.entryTypeKey,
    sourceKey: source,
    anchor: { kind: 'Trade', tradeId: outcome.change.tradeId },
    origin: { kind: 'PositionChange', factId: outcome.change.factId },
    momentTime: iso(outcome.change.time),
    obligationKey: outcome.kind.obligationKey(outcome.change),
    anchorTradeId: outcome.change.tradeId,
  });
  const created = (outcome: Outcome) => iso(outcome.change.time + COMPLETION_NOTE);
  const entryOf = (outcome: Outcome, later: boolean): Row => {
    const savedAt = later ? resolvedAt(outcome.change.time) : created(outcome);
    return {
      id: idOf('je', outcome),
      ...basis(outcome, later ? 'source.daily-review' : outcome.kind.captureSource),
      authoredTime: savedAt,
      ...(later && { settledDebtId: idOf('jd', outcome) }),
      versions: [{ versionNumber: 1, definitionId: outcome.kind.definition.id, responses: outcome.kind.definition.respond(outcome.kind.answers(outcome.number, outcome.change.symbol, later)), savedAt }],
    };
  };
  const declineOf = (outcome: Outcome, later: boolean): Row => {
    const reason = outcome.kind.declineReason(outcome.number, later);
    return {
      id: idOf('jx', outcome),
      ...basis(outcome, later ? 'source.daily-review' : outcome.kind.captureSource),
      definitionId: outcome.kind.definition.id,
      ...(reason !== undefined && { reason }),
      authoredTime: later ? resolvedAt(outcome.change.time) : created(outcome),
      ...(later && { settledDebtId: idOf('jd', outcome) }),
    };
  };
  const debtOf = (outcome: Outcome): Row => {
    const debtId = idOf('jd', outcome);
    const { disposition } = outcome;
    const outstanding = disposition === 'outstanding';
    let resolution: { status: string; entryId?: string; declineId?: string } | undefined;
    if (disposition === 'answered') resolution = { status: 'Settled', entryId: idOf('je', outcome) };
    else if (disposition === 'declinedLater') resolution = { status: 'Declined', declineId: idOf('jx', outcome) };
    return {
      debtId,
      ...basis(outcome, outcome.kind.captureSource),
      definitionId: outcome.kind.definition.id,
      dueAnchor: iso(outcome.change.time),
      dueRule: 'OneSessionGrace',
      route: 'JournalOnly',
      ...(outstanding && { outstandingDue: iso(outcome.change.time) }),
      versions: [
        { versionId: `${debtId}-v1`, status: 'Outstanding', savedAt: created(outcome) },
        ...(resolution ? [{ versionId: `${debtId}-v2`, ...resolution, savedAt: resolvedAt(outcome.change.time) }] : []),
      ],
    };
  };
  const planEntries = function* (): Generator<Row> {
    for (const build of builds) {
      const i = build.index;
      yield {
        id: `je-a-${pad(i)}`,
        entryTypeKey: 'entry-type.plan-reflection',
        sourceKey: 'source.plan-confirmation',
        anchor: { kind: 'Trade', tradeId: build.tradeId },
        origin: { kind: 'Plan', factId: build.planFactId },
        momentTime: iso(build.planTime),
        authoredTime: iso(build.planTime + COMPLETION_NOTE),
        obligationKey: `PlanReflection:${build.tradeId}`,
        anchorTradeId: build.tradeId,
        versions: [
          {
            versionNumber: 1,
            definitionId: plan.id,
            responses: plan.respond({
              'prompt.plan-reflection.thesis': { kind: 'Text', text: `${build.symbol} reclaimed its 50-day average on rising volume after a tight base; plan ${i}.` },
              'prompt.plan-reflection.invalidation': { kind: 'Text', text: `A daily close back inside the base, below ${cents(intendedEntryCents(i) - Math.round(intendedEntryCents(i) * 0.05))}.` },
              'prompt.plan-reflection.conviction': { kind: 'Scale', value: 1 + (i % 5) },
              'prompt.plan-reflection.primary-emotion': { kind: 'Option', optionId: `option.plan-reflection.primary-emotion.${PLAN_EMOTIONS[i % PLAN_EMOTIONS.length]}` },
            }),
            savedAt: iso(build.planTime + COMPLETION_NOTE),
          },
        ],
      };
    }
  };
  const ofDisposition = (...wanted: readonly BenchDisposition[]) => outcomes.filter((outcome) => wanted.includes(outcome.disposition));
  // Stores are in key order: the Plan reflections, then the Position Change ones, the Close Reviews, the Actions.
  const entriesOf = function* (): Generator<Row> {
    yield* planEntries();
    for (const store of ['pc', 'close'] as const) {
      for (const outcome of ofDisposition('complete', 'answered')) if (outcome.kind === kinds[store]) yield entryOf(outcome, outcome.disposition === 'answered');
    }
    yield* actions.rows();
  };
  const declinesOf = function* (): Generator<Row> {
    for (const store of ['pc', 'close'] as const) {
      for (const outcome of ofDisposition('declined', 'declinedLater')) if (outcome.kind === kinds[store]) yield declineOf(outcome, outcome.disposition === 'declinedLater');
    }
  };
  const debtsOf = function* (): Generator<Row> {
    for (const store of ['pc', 'close'] as const) {
      for (const outcome of ofDisposition('answered', 'declinedLater', 'outstanding')) if (outcome.kind === kinds[store]) yield debtOf(outcome);
    }
  };
  const entryTotal = (kind: Kind) => ofDisposition('complete', 'answered').filter((outcome) => outcome.kind === kind).length;
  const debtsOutstanding = ofDisposition('outstanding').map((outcome) => ({
    debtId: idOf('jd', outcome),
    tradeId: outcome.change.tradeId,
    underlying: outcome.change.symbol,
    kind: outcome.kind === kinds.pc ? ('PositionChange' as const) : ('CloseReview' as const),
    positionChange: outcome.number,
    momentDate: iso(outcome.change.time).slice(0, 10),
  }));
  return {
    entries: { count: builds.length + entryTotal(kinds.pc) + entryTotal(kinds.close) + actions.count, rows: entriesOf },
    declines: { count: ofDisposition('declined', 'declinedLater').length, rows: declinesOf },
    debts: { count: ofDisposition('answered', 'declinedLater', 'outstanding').length, rows: debtsOf },
    actions,
    outstandingDebts: debtsOutstanding,
  };
}

// What the application itself shows of the restored dataset (D8 T8.18-F2, Q24 and Q25): the Open list's rows and the
// Daily Review's order. The generator cannot render the screen in Node, so the caller supplies the two seams: a Restore
// of the artifact into a Node Workspace (the production Restore on fake-indexeddb), and the screen's pure row function.
export interface BenchViewsPort {
  readonly restore: (bytes: Uint8Array, asOf: string) => Promise<Pick<Application, 'TradeViewsAndReporting' | 'DailyReview'>>;
  readonly openRowsOf: (items: readonly (OpenTradeItem | IncoherentOpenTradeItem)[], timeZone: string, asOf: string) => { readonly headers: readonly string[]; readonly rows: readonly (readonly string[])[] };
}

// Who wrote the recorded expected Open rows. `bench:generate` stamps them with this and the digest of the artifact file
// it restored; `bench:expected` (the browser path) stamps its own writer, so its rows are never taken for the Node ones.
export const BENCH_ROWS_WRITER = 'bench:generate';

// True only when the recorded rows are the ones this Node generator wrote for the artifact with this file digest (B2).
export function rowsAreFromGenerator(recorded: { readonly rows?: readonly unknown[]; readonly writer?: string; readonly artifactFileDigest?: string } | undefined, artifactFileDigest: string): boolean {
  return (recorded?.rows?.length ?? 0) > 0 && recorded?.writer === BENCH_ROWS_WRITER && recorded.artifactFileDigest === artifactFileDigest;
}

export interface BenchOpenRows {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
  // `browseTrades({ lifecycle: 'Open' })` items, in order.
  readonly items: readonly unknown[];
}

const sameList = (what: string, got: readonly string[], want: readonly string[]) => {
  if (got.length !== want.length || got.some((id, n) => id !== want[n])) {
    throw new Error(`${what}: the application gives ${got.length} (${got.slice(0, 5).join(', ')}...) but the generator expects ${want.length} (${want.slice(0, 5).join(', ')}...)`);
  }
};

// Restores the artifact in Node, reads the Open list and the as-of Review through the application, and checks them
// against the membership the generator computed from the records it wrote. Throws on any disagreement. The Review's
// walk, owed group and settlement family come back in the application's own order.
export async function viewsOfRestored(port: BenchViewsPort, bytes: Uint8Array, expected: Pick<GeneratedBench['expected'], 'asOf' | 'counts' | 'asOfReview'>): Promise<{ readonly openRows: BenchOpenRows; readonly asOfReview: BenchAsOfReview }> {
  return viewsOfApp(port, await port.restore(bytes, expected.asOf), expected);
}

// The same reading and checks over an application that is already restored (read-only), so a caller holding one need not restore again.
export async function viewsOfApp(port: BenchViewsPort, app: Awaited<ReturnType<BenchViewsPort['restore']>>, expected: Pick<GeneratedBench['expected'], 'asOf' | 'counts' | 'asOfReview'>): Promise<{ readonly openRows: BenchOpenRows; readonly asOfReview: BenchAsOfReview }> {
  const browsed = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' });
  if (browsed.kind !== 'Ready') throw new Error(`browseTrades Open: ${browsed.kind}`);
  const items = browsed.view.items;
  sameList('Open list membership', items.map((item) => item.tradeId).sort(), expected.asOfReview.walk);
  if (items.length !== expected.counts.openTrades) throw new Error(`Open list: ${items.length} rows but ${expected.counts.openTrades} Open Trades counted`);
  const { headers, rows } = port.openRowsOf(items, BENCH_TIME_ZONE, expected.asOf);
  if (rows.length !== items.length) throw new Error(`the row function gives ${rows.length} rows for ${items.length} items`);

  const review = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: expected.asOf });
  if (review.kind !== 'Ready') throw new Error(`DailyReview.open at the as-of instant: ${review.kind}`);
  const walk = review.families.flatMap((family) => (family.family === 'Trades' ? family.trades.map((trade) => trade.tradeId) : []));
  sameList('Review walk membership', [...walk].sort(), expected.asOfReview.walk);
  const owed = review.owed.map((group) => ({ tradeId: group.tradeId, debtIds: group.owed.map((debt) => debt.debtId) }));
  sameList('Review owed group membership', owed.map((group) => group.tradeId).sort(), expected.asOfReview.owedGroup.map((group) => group.tradeId));
  const owedGroup = owed.map((group) => {
    const independent = expected.asOfReview.owedGroup.find((candidate) => candidate.tradeId === group.tradeId)!;
    sameList(`Review owed debts of ${group.tradeId}`, [...group.debtIds].sort(), [...independent.debtIds].sort());
    return { ...independent, debtIds: group.debtIds };
  });
  const due = review.families.flatMap((family) => (family.family === 'Settlement' ? family.items : []));
  const settlementKey = (item: { tradeId: string; contract: string; expiration: string }) => `${item.tradeId} ${item.contract} ${item.expiration}`;
  const appDue = due.map((item) => ({ tradeId: item.tradeId, contract: instrumentKey(item.instrument), expiration: item.expiration }));
  sameList('Settlement Due items', appDue.map(settlementKey).sort(), expected.asOfReview.settlement.map(settlementKey).sort());
  const settlement = appDue.map((item) => expected.asOfReview.settlement.find((candidate) => settlementKey(candidate) === settlementKey(item))!);
  return { openRows: { headers, rows, items }, asOfReview: { walk, owedGroup, settlement } };
}

export interface GeneratedBench {
  readonly artifact: ArtifactDigests & { readonly parts: readonly Uint8Array[]; readonly lineCount: number };
  // The values the benchmark expects of the restored Workspace.
  readonly expected: {
    // The pinned as-of instant, the date of the as-of Review, and the Instruments without that date's Mark.
    readonly asOf: string;
    readonly reviewDate: string;
    readonly missingInstruments: readonly string[];
    readonly counts: BenchCounts;
    // Actions saved first time, by choice (an edit does not add one), and the dispositions applied.
    readonly actionsByChoice: Readonly<Record<string, number>>;
    readonly dispositions: Readonly<Record<BenchDisposition, number>>;
    readonly closeReviewDispositions: Readonly<Record<BenchDisposition, number>>;
    readonly asOfDueReflections: number;
    readonly outstandingDebts: readonly BenchOutstandingDebt[];
    // The as-of Review's walk, owed group and settlement family. With `views`, their order is the application's
    // (attention-ranked), taken from a Node Restore; without, the walk and owed group are sorted by Trade identity.
    readonly asOfReview: BenchAsOfReview;
    // The Open list's rows as the application gives them; present only with `views`.
    readonly openRows?: BenchOpenRows;
  };
  // Compressed size of the artifact file.
  readonly bytes: number;
  // The artifact's lines, decompressed, as the reader counts them.
  readonly uncompressedBytes: number;
  // Records per store, as the header and the manifest state them.
  readonly storeCounts: Readonly<Record<string, number>>;
}

// Counts what is written, record by record as the export reads it, so the expected values are the stored records' and
// every Trade's legs, fills and settlements are counted from its facts, never assumed to be one.
function tallyOf(seed: ReturnType<typeof seedOf>, reviewDate: string) {
  const productKeyOf = new Map(seed.catalog.flatMap((row) => (row['kind'] === 'Strategy' ? [[row['id'] as string, row['productKey'] as string] as const] : [])));
  const closeReasonOf = new Map(seed.catalog.flatMap((row) => (row['kind'] === 'CloseReason' ? [[row['id'] as string, row['label'] as string] as const] : [])));
  const tally = {
    trades: 0, openTrades: 0, plannedTrades: 0, closedTrades: 0, positionChanges: 0, executions: 0,
    institutions: 0, accounts: 0, strategies: 0, marks: 0, markCorrections: 0, acknowledgments: 0,
    planReflectionEntries: 0, positionChangeReflectionEntries: 0, positionChangeReflectionDeclines: 0,
    actions: 0, editedActions: 0, debts: 0, debtsSettled: 0, debtsDeclined: 0, debtsOutstanding: 0,
    closeReviewEntries: 0, closeReviewDeclines: 0, closeReviewDebts: 0, closeReviewDebtsSettled: 0, closeReviewDebtsDeclined: 0, closeReviewDebtsOutstanding: 0,
    optionTrades: 0, longCalls: 0, longPuts: 0, cashSecuredPuts: 0, exerciseIntentPlans: 0, authorizedPlans: 0,
    expirations: 0, expirationsAfterPartialExit: 0, openOptionTrades: 0,
  };
  const closeReasons: Record<string, number> = {};
  const sessionDates = new Set<string>();
  const openHeld: Instrument[] = [];
  const openContracts = new Set<string>();
  const openStock = new Set<string>();
  const openOptionUnderlyings = new Set<string>();
  const walk: string[] = [];
  const settlement: { tradeId: string; underlying: string; contract: string; expiration: string; quantity: string }[] = [];
  const openTradeIds = new Set<string>();
  const effective = <V>(fact: { readonly versions: readonly { readonly value: V }[] }): V => fact.versions[fact.versions.length - 1]!.value;
  const add = (store: string, row: Row) => {
    switch (store) {
      case 'catalog':
        if (row['kind'] === 'Institution') tally.institutions++;
        else if (row['kind'] === 'Account') tally.accounts++;
        else if (row['kind'] === 'Strategy') tally.strategies++;
        return;
      case 'observations': {
        sessionDates.add(row['tradingDate'] as string);
        tally.marks += (row['marks'] as { intention: string }[]).filter((mark) => mark.intention === 'InitialManual').length;
        tally.markCorrections += (row['marks'] as { intention: string }[]).filter((mark) => mark.intention === 'Correction').length;
        tally.acknowledgments += (row['acknowledgments'] as unknown[]).length;
        return;
      }
      case 'trades': {
        const doc = row as unknown as TradeDocument;
        tally.trades++;
        if (doc.lifecycle === 'Open') tally.openTrades++;
        else if (doc.lifecycle === 'Planned') tally.plannedTrades++;
        else tally.closedTrades++;
        const legs = doc.facts.flatMap((fact) => (fact.kind === 'PlannedLeg' ? [effective(fact).instrument] : []));
        const executions = doc.facts.flatMap((fact) => (fact.kind === 'Execution' ? [effective(fact)] : []));
        tally.positionChanges += doc.facts.filter((fact) => fact.kind === 'PositionChange').length;
        tally.executions += executions.length;
        const productKey = productKeyOf.get(doc.strategyId);
        const isOptionTrade = productKey !== 'strategy.long-stock';
        const plan = doc.facts.flatMap((fact) => (fact.kind === 'Plan' ? [effective(fact)] : []))[0]!;
        if (isOptionTrade) {
          tally.optionTrades++;
          if (productKey === 'strategy.long-call') tally.longCalls++;
          else if (productKey === 'strategy.long-put') tally.longPuts++;
          else tally.cashSecuredPuts++;
          if (plan.exerciseIntent !== undefined) tally.exerciseIntentPlans++;
          if (plan.exerciseIntent === 'Authorized') tally.authorizedPlans++;
          const expired = doc.facts.some((fact) => fact.kind === 'Expiration');
          if (expired) tally.expirations++;
          if (expired && executions.some((e) => e.action === 'Buy') && executions.some((e) => e.action === 'Sell')) tally.expirationsAfterPartialExit++;
        }
        if (doc.lifecycle === 'Open') {
          openTradeIds.add(doc.tradeId);
          walk.push(doc.tradeId);
          openHeld.push(...legs);
          if (isOptionTrade) {
            tally.openOptionTrades++;
            for (const leg of legs) if (leg.kind === 'Option') openContracts.add(instrumentKey(leg));
            openOptionUnderlyings.add(doc.underlying);
            const net = executions.reduce((sum, e) => sum + (e.action === 'Buy' ? 1 : -1) * Number(e.quantity), 0);
            for (const leg of legs) {
              if (leg.kind === 'Option' && leg.expiration === reviewDate) settlement.push({ tradeId: doc.tradeId, underlying: doc.underlying, contract: instrumentKey(leg), expiration: leg.expiration, quantity: String(net) });
            }
          } else {
            openStock.add(doc.underlying);
          }
        }
        for (const fact of doc.closeReasonFacts ?? []) {
          const label = closeReasonOf.get(effective(fact).closeReasonId)!;
          closeReasons[label] = (closeReasons[label] ?? 0) + 1;
        }
        return;
      }
      case 'journalEntries': {
        const type = row['entryTypeKey'];
        if (type === 'entry-type.plan-reflection') tally.planReflectionEntries++;
        else if (type === 'entry-type.position-change-reflection') tally.positionChangeReflectionEntries++;
        else if (type === 'entry-type.close-review') tally.closeReviewEntries++;
        else if (type === 'entry-type.daily-trade-review') {
          tally.actions++;
          if ((row['versions'] as unknown[]).length > 1) tally.editedActions++;
        }
        return;
      }
      case 'journalDeclines':
        if (row['entryTypeKey'] === 'entry-type.position-change-reflection') tally.positionChangeReflectionDeclines++;
        else tally.closeReviewDeclines++;
        return;
      case 'journalDebts': {
        const status = (row['versions'] as { status: string }[]).at(-1)!.status;
        const close = row['entryTypeKey'] === 'entry-type.close-review';
        tally.debts++;
        if (close) tally.closeReviewDebts++;
        if (status === 'Settled') {
          tally.debtsSettled++;
          if (close) tally.closeReviewDebtsSettled++;
        } else if (status === 'Declined') {
          tally.debtsDeclined++;
          if (close) tally.closeReviewDebtsDeclined++;
        } else {
          tally.debtsOutstanding++;
          if (close) tally.closeReviewDebtsOutstanding++;
        }
      }
    }
  };
  const result = (perSession: readonly number[]): BenchCounts => {
    const held = countHeld(openHeld);
    return {
      ...tally,
      sessions: sessionDates.size,
      openInstruments: held.open,
      sharedInstruments: held.shared,
      closeReasons: { ...closeReasons },
      openContracts: openContracts.size,
      openStockInstruments: openStock.size,
      optionUnderlyingsHeldAsStock: [...openOptionUnderlyings].filter((symbol) => openStock.has(symbol)).length,
      instrumentsPerSessionMean: perSession.length === 0 ? 0 : Math.round((perSession.reduce((a, b) => a + b, 0) / perSession.length) * 10) / 10,
      instrumentsPerSessionMax: Math.max(0, ...perSession),
    };
  };
  return { add, result, walk, settlement, openTradeIds };
}

// The full profile is exactly section 1.4's: 30% options (Long Call 12%, Long Put 8%, Cash-Secured Put 10%), 5,000
// long-option Plans of which 10% are Authorized, 60 Open option Trades, 40% of the 7,410 Closed option Trades expiring
// (2,964), and one Close Review outcome for each of the 24,700 Closed Trades.
export function assertFullProfile(counts: BenchCounts): void {
  const exact =
    counts.trades === 25_000 && counts.closedTrades === 24_700 && counts.openTrades === 200 && counts.plannedTrades === 100 &&
    counts.optionTrades === 7_500 && counts.longCalls === 3_000 && counts.longPuts === 2_000 && counts.cashSecuredPuts === 2_500 &&
    counts.exerciseIntentPlans === 5_000 && counts.authorizedPlans === 500 && counts.openOptionTrades === 60 && counts.expirations === 2_964 &&
    counts.closeReviewEntries + counts.closeReviewDeclines + counts.closeReviewDebtsOutstanding === 24_700;
  if (!exact) throw new Error(`the full profile misses section 1.4: ${JSON.stringify(counts)}`);
}

// Writes the dataset as a schema-7 backup artifact through the production export pipeline and its artifact writer,
// feeding it the records a snapshot read would give. `sessions` limits the run to the first N real sessions and scales
// every count (a smoke run); omitted, it is the full profile of plan section 1.4.
export async function generateBenchArtifact(options: { readonly calendar: BenchCalendar; readonly sessions?: number; readonly views?: BenchViewsPort }): Promise<GeneratedBench> {
  const seed = seedOf();
  const { run: sessions, profile } = sessionsOf(options.calendar, options.sessions);
  const { events } = schedule(sessions.map((session) => Date.parse(session.date)), profile, sessions.map((session) => Date.parse(session.close)));
  const reviewDate = sessions.at(-1)!.date;
  const tally = tallyOf(seed, reviewDate);
  const { builds, changes } = buildTrades(events, profile, seed.ids);
  const observations = observationsOf(sessions, profile, builds);
  const reflectionPlan = dispositionsFor(changes.length, BENCH_SEED);
  const closePlan = dispositionsFor(changes.filter((change) => change.terminal).length, BENCH_SEED + 1);
  const journal = journalOf({ sessions, profile, builds, changes, definitions: seed.journalDefinitions, reflectionPlan, closePlan });
  // Each store: how many records it holds, and the records in key order. A store's records are made when the snapshot
  // read reaches it, so a mature dataset is never held whole.
  const stores: Readonly<Record<string, { readonly count: number; readonly rows: () => Iterable<Row> }>> = {
    catalog: { count: seed.catalog.length, rows: () => seed.catalog },
    observations: { count: observations.count, rows: observations.rows },
    trades: { count: builds.length, rows: () => builds.map((build): Row => ({ ...stored(build) })) },
    journalTypes: { count: seed.journalTypes.length, rows: () => seed.journalTypes },
    journalDefinitions: { count: seed.journalDefinitions.length, rows: () => seed.journalDefinitions },
    journalEntries: journal.entries,
    journalDeclines: journal.declines,
    journalDebts: journal.debts,
  };
  const layout = exportLayoutFor(SCHEMA_VERSION)!;
  const counts = Object.fromEntries(layout.stores.map((store) => [store, stores[store]!.count]));
  const binding = { databaseName: BENCH_DATABASE, contentRevision: 1 };
  const meta: Row[] = [
    { key: 'schema', schemaVersion: SCHEMA_VERSION },
    { key: 'settings', timeZone: BENCH_TIME_ZONE, settingsRevision: 1 },
    { key: 'sessionPolicy', policy: options.calendar.identity },
  ];
  const run = await runExport(
    (_database, _layout, onBatch, onStart) =>
      Promise.resolve().then((): ExportReadResult => {
        onStart({ binding, meta, counts });
        for (const store of layout.stores) {
          let batch: Row[] = [];
          let written = 0;
          for (const row of stores[store]!.rows()) {
            tally.add(store, row);
            written++;
            batch.push(row);
            if (batch.length < BATCH_SIZE) continue;
            onBatch({ store, records: batch });
            batch = [];
          }
          if (batch.length > 0) onBatch({ store, records: batch });
          // The header stated the count before the records were made.
          if (written !== counts[store]) throw new Error(`${store}: ${written} records written, ${counts[store]} announced`);
        }
        return { kind: 'Read', binding, schemaVersion: SCHEMA_VERSION, meta, counts };
      }),
    {
      databaseName: BENCH_DATABASE,
      layout,
      exportKind: 'Normal',
      createdAt: BENCH_AS_OF_INSTANT,
      releaseId: BENCH_RELEASE,
      seedManifestVersions: { catalog: D7_CATALOG_MANIFEST.version, journal: D6_JOURNAL_MANIFEST.version },
    },
  );
  if (run.kind !== 'Built') throw new Error(`the artifact was not built: ${JSON.stringify(run)}`);
  if (profile.full) assertFullProfile(tally.result(observations.perSession));
  const parts = new Uint8Array(await run.blob.arrayBuffer());
  // The gzip header holds the clock's time (bytes 4 to 7), which no digest covers: zero it so the same dataset is the same file.
  parts.fill(0, 4, 8);
  // The production reader streams the file back, recomputing every digest: the section digests and the sizes come from it.
  let lineCount = 0;
  let uncompressedBytes = 0;
  let sectionDigests: Record<string, string> = {};
  const encoder = new TextEncoder();
  for await (const line of readArtifact(run.blob)) {
    lineCount++;
    uncompressedBytes += encoder.encode(line.text).length + 1;
    if (line.kind !== 'manifest') continue;
    if (line.computedFullDigest !== run.fullDigest) throw new Error('the artifact reads back with another full digest');
    sectionDigests = line.computedSectionDigests;
  }
  const counted = tally.result(observations.perSession);
  const independentReview: BenchAsOfReview = {
    settlement: [...tally.settlement].sort(bySettlementOrder),
    walk: [...tally.walk].sort(),
    owedGroup: [...new Set(journal.outstandingDebts.map((debt) => debt.tradeId))]
      .filter((tradeId) => !tally.openTradeIds.has(tradeId))
      .sort()
      .map((tradeId) => {
        const owed = journal.outstandingDebts.filter((debt) => debt.tradeId === tradeId);
        return { tradeId, underlying: owed[0]!.underlying, debtIds: owed.map((debt) => debt.debtId) };
      }),
  };
  const asOf = savedAtOf(sessions.at(-1)!.completion, true, profile.full);
  // The application's own Open rows and Review order, checked against the membership counted above.
  const views = options.views ? await viewsOfRestored(options.views, parts, { asOf, counts: counted, asOfReview: independentReview }) : undefined;
  return {
    artifact: { parts: [parts], lineCount, sectionDigests, fullDigest: run.fullDigest, manifestDigest: run.manifestDigest },
    bytes: parts.length,
    uncompressedBytes,
    storeCounts: run.counts,
    expected: {
      asOf,
      reviewDate,
      missingInstruments: [...observations.missing].sort(),
      counts: counted,
      actionsByChoice: journal.actions.byChoice,
      dispositions: reflectionPlan.counts,
      closeReviewDispositions: closePlan.counts,
      // The Outstanding Debts are due at the as-of Review: nothing is recorded in its session, and a Debt is due one session after its Position Change.
      asOfDueReflections: journal.outstandingDebts.length,
      outstandingDebts: journal.outstandingDebts,
      asOfReview: views?.asOfReview ?? independentReview,
      ...(views && { openRows: views.openRows }),
    },
  };
}

declare global {
  interface Window {
    __tjBench?: { readonly marker: string };
  }
}

export function installBenchGenerator(): void {
  window.__tjBench = { marker: BENCH_GENERATOR_MARKER };
}
