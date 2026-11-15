import { gunzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { backupFile, targetWorkspace } from '../coordinators/workspace/restore-test-support.ts';
import { nyseSessionPolicy } from '../domain/session-policy/index.ts';
import { restoreInNode } from '../../tools/bench/node-restore.ts';
import { openRowsOf } from '../ui/screens/TradeList.tsx';
import { BENCH_AS_OF_DATE, BENCH_SEED, BENCH_TIME_ZONE, benchScale } from './bench.ts';
import { BENCH_ROWS_WRITER, assertFullProfile, countHeld, rowsAreFromGenerator, dispositionsFor, generateBenchArtifact, schedule, viewsOfRestored, type BenchCalendar, type GeneratedBench } from './bench-generator.ts';
import { BENCH_GENERATOR_MARKER, BENCH_GENERATOR_VERSION } from './bench.ts';
import type { Instrument } from '../domain/instrument/index.ts';

const MINUTE = 60_000;
const DAY = 86_400_000;

// Weekdays 2024-06-17 to 2024-08-09 without 2024-07-04. 2024-07-03 closes early at 13:00 ET (17:00Z);
// every other day closes at 16:00 ET (20:00Z).
function calendar() {
  const days: number[] = [];
  const closes: number[] = [];
  for (let d = Date.UTC(2024, 5, 17); d <= Date.UTC(2024, 7, 9); d += DAY) {
    const weekday = new Date(d).getUTCDay();
    if (weekday === 0 || weekday === 6 || d === Date.UTC(2024, 6, 4)) continue;
    days.push(d);
    closes.push(d + (d === Date.UTC(2024, 6, 3) ? 17 : 20) * 60 * MINUTE);
  }
  return { days, closes };
}

// 300 weekdays from 2025-01-06, all closing at 16:00 ET (21:00Z).
function longCalendar() {
  const days: number[] = [];
  for (let d = Date.UTC(2025, 0, 6); days.length < 300; d += DAY) {
    const weekday = new Date(d).getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(d);
  }
  return { days, closes: days.map((d) => d + 21 * 60 * MINUTE) };
}

describe('bench generator option mix (D7 section 1.4)', () => {
  const { days, closes } = longCalendar();
  // 1,000 Trades: 970 Closed, 20 Open, 10 Planned.
  const profile = { sessions: days.length, full: false, trades: 1000, openTrades: 20, plannedTrades: 10, closedTrades: 970 };
  const { events, expirations, expirationsAfterPartialExit } = schedule(days, profile, closes);
  const plans = events.filter((event) => event.kind === 'Plan');

  it('should make 30 percent of the Trades options, 12 Long Calls, 8 Long Puts and 10 Cash-Secured Puts of every hundred', () => {
    const kinds = plans.map((plan) => plan.option?.kind);
    expect(kinds.filter((kind) => kind !== undefined)).toHaveLength(300);
    expect(kinds.filter((kind) => kind === 'LongCall')).toHaveLength(120);
    expect(kinds.filter((kind) => kind === 'LongPut')).toHaveLength(80);
    expect(kinds.filter((kind) => kind === 'CashSecuredPut')).toHaveLength(100);
  });

  it('should authorize 10 percent of the long-option Plans and no other', () => {
    const long = plans.filter((plan) => plan.option?.kind === 'LongCall' || plan.option?.kind === 'LongPut');
    expect(long).toHaveLength(200);
    expect(long.filter((plan) => plan.option?.authorized)).toHaveLength(20);
    expect(plans.filter((plan) => plan.option?.kind === 'CashSecuredPut' && plan.option.authorized)).toEqual([]);
  });

  it('should end 40 percent of the Closed option Trades by Expiration, 30 percent of those after a partial exit', () => {
    const closedOptions = plans.filter((plan) => plan.option && plan.index < profile.closedTrades);
    expect(closedOptions).toHaveLength(291);
    expect(closedOptions.filter((plan) => plan.option!.expires)).toHaveLength(expirations);
    expect(expirations).toBe(Math.floor(291 * 0.4) + 1);
    expect(expirationsAfterPartialExit).toBeGreaterThanOrEqual(Math.floor(expirations * 0.3) - 1);
    expect(expirationsAfterPartialExit).toBeLessThanOrEqual(Math.ceil(expirations * 0.3) + 1);
    const expiries = events.filter((event) => event.kind === 'PositionChange' && event.expire);
    expect(expiries).toHaveLength(expirations);
  });

  it('should record each Expiration at the close of the contract date, after the last other Position Change of its Trade', () => {
    const expiries = events.filter((event) => event.kind === 'PositionChange' && event.expire);
    for (const expiry of expiries) {
      if (expiry.kind !== 'PositionChange') continue;
      const date = new Date(expiry.time).toISOString().slice(0, 10);
      expect(expiry.option!.expiration).toBe(date);
      expect(expiry.time).toBe(closes[days.indexOf(Date.parse(date))]);
      // The last session of its week: the next session is on a later Monday.
      expect(new Date(days[days.indexOf(Date.parse(date)) + 1]!).getUTCDay()).toBe(1);
      const others = events.filter((event) => event.kind === 'PositionChange' && event.index === expiry.index && event !== expiry);
      expect(others.every((event) => event.time < expiry.time)).toBe(true);
    }
  });

  it('should not count an Expiration as an Execution', () => {
    const { events: all, executions } = schedule(days, profile, closes);
    const changes = all.filter((event) => event.kind === 'PositionChange');
    expect(executions).toBe(changes.filter((event) => !event.expire).reduce((sum, event) => sum + event.quantities.length, 0));
    expect(changes.filter((event) => event.expire).length).toBeGreaterThan(0);
  });

  it('should leave four Open option Trades expiring on the last session so they are Settlement Due at the as-of Review', () => {
    const open = plans.filter((plan) => plan.option && plan.index >= profile.closedTrades && plan.index < profile.closedTrades + profile.openTrades);
    expect(open).toHaveLength(6);
    const lastDate = new Date(days[days.length - 1]!).toISOString().slice(0, 10);
    expect(open.filter((plan) => plan.option!.expiration === lastDate)).toHaveLength(4);
    expect(open.filter((plan) => plan.option!.expiration > lastDate)).toHaveLength(2);
  });
});

describe('bench generator schedule', () => {
  it('should schedule every Position Change before its session close on early-close days', () => {
    const { days, closes } = calendar();
    // About 20 Trades planned a session, as at full scale (25,000 Trades over 1,245 planning sessions).
    const profile = { sessions: days.length, full: false, trades: 500, openTrades: 5, plannedTrades: 3, closedTrades: 492 };
    const { events } = schedule(days, profile, closes);
    const sessionOf = (time: number) => days.findIndex((day) => time >= day && time < day + DAY);
    // An Expiration is recorded at its contract's session close (D7 A113), so it is the one change not before it.
    const changes = events.filter((event) => event.kind === 'PositionChange' && !event.expire);
    const late = changes.filter((event) => event.time >= closes[sessionOf(event.time)]!);
    expect(changes.some((event) => sessionOf(event.time) === days.indexOf(Date.UTC(2024, 6, 3)))).toBe(true);
    expect(late).toEqual([]);
    // A Plan is also before its session close and before its Trade's first Position Change.
    const firstChange = new Map<number, number>();
    for (const event of changes) if (!firstChange.has(event.index)) firstChange.set(event.index, event.time);
    for (const event of events) {
      if (event.kind !== 'Plan') continue;
      expect(event.time).toBeLessThan(closes[sessionOf(event.time)]!);
      const first = firstChange.get(event.index);
      if (first !== undefined) expect(event.time).toBeLessThan(first);
    }
  });
});

describe('bench generator Open book instruments', () => {
  const stock = (symbol: string): Instrument => ({ kind: 'Stock', symbol });
  const call = (strike: string): Instrument => ({ kind: 'Option', symbol: 'AAA', root: 'AAA', expiration: '2024-09-20', strike, right: 'Call', multiplier: 100 });
  it('should count the Open book distinct Instruments by Instrument key, so a contract and its Underlying stock are two', () => {
    const counts = countHeld([
      stock('AAA'),
      call('100'),
      call('100'),
      stock('BBB'),
    ]);
    expect(counts).toEqual({ open: 3, shared: 1 });
  });
});

// The artifact of a short run (T8.18): 40 sessions scale every count, so a whole artifact is quick to make and read.
const SMOKE_SESSIONS = 40;
let smokePromise: Promise<GeneratedBench> | undefined;
const realCalendar = (): BenchCalendar => {
  const covered = nyseSessionPolicy.sessionsBetween('2024-01-02', BENCH_AS_OF_DATE);
  if (!covered.ok) throw new Error('no sessions');
  return { identity: nyseSessionPolicy.identity, sessions: covered.value };
};
const smoke = () => (smokePromise ??= generateBenchArtifact({ calendar: realCalendar(), sessions: SMOKE_SESSIONS }));
const gunzipped = (parts: readonly Uint8Array[]) => {
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return new TextDecoder().decode(gunzipSync(all));
};
const linesOf = (parts: readonly Uint8Array[]) => {
  const lines = gunzipped(parts).split('\n');
  lines.pop();
  return lines;
};

describe('bench generator artifact (D8 P35)', () => {
  it('should write the mix as a schema-7 format-1 artifact with a header, the five sections in order and a manifest, whose counts agree', async () => {
    const { artifact, storeCounts } = await smoke();
    const lines = linesOf(artifact.parts).map((line) => JSON.parse(line) as Record<string, unknown>);
    const header = lines[0]!;
    const manifest = lines.at(-1)!;
    expect(header).toMatchObject({ kind: 'header', formatVersion: 1, schemaVersion: 7, exportKind: 'Normal', sections: ['workspace', 'catalog', 'marketData', 'trades', 'journal'] });
    expect(manifest).toMatchObject({ kind: 'manifest', formatVersion: 1, schemaVersion: 7, fullDigest: artifact.fullDigest });
    expect(header['counts']).toEqual(storeCounts);
    expect(manifest['counts']).toEqual(storeCounts);
    expect(lines.filter((line) => line['kind'] === 'sectionEnd').map((line) => line['section'])).toEqual(['workspace', 'catalog', 'marketData', 'trades', 'journal']);
  });

  it('should stamp the artifact with generator version 8', async () => {
    const { artifact } = await smoke();
    const header = linesOf(artifact.parts).map((line) => JSON.parse(line) as Record<string, unknown>)[0]!;
    expect(BENCH_GENERATOR_VERSION).toBe(8);
    expect(header['releaseId']).toBe('tj-bench-generator-v8');
  });
});

// A stored record, with the fields these tests read from any store (the store a record is from says which are there).
interface Instr {
  kind: string;
  symbol: string;
  root: string;
  expiration: string;
  right: string;
  strike: string;
}
interface Fact {
  kind: string;
  versions: { value: { economicTime: string; instrument: Instr } }[];
}
interface Rec {
  id: string;
  tradeId: string;
  debtId: string;
  lifecycle: string;
  facts: Fact[];
  tradingDate: string;
  instrumentKey: string;
  resolutionRevision: number;
  effectiveMarkId: string;
  marks: { intention: string; revisionId: string; supersedes: string }[];
  entryTypeKey: string;
  obligationKey: string;
  anchorTradeId: string;
  settledDebtId: string;
  versions: { status: string; entryId: string; declineId: string; responses: { value: { optionId: string } }[] }[];
}

// The records of one store of the artifact, in file order.
const recordsOf = (parts: readonly Uint8Array[], store: string) =>
  linesOf(parts)
    .filter((line) => line.startsWith('{"r":'))
    .map((line) => JSON.parse(line) as { r: Rec; s: string; t: string })
    .filter((line) => line.t === store)
    .map((line) => line.r);

// The schedule of the smoke run, made independently of the generator's artifact.
function smokeSchedule() {
  const sessions = nyseSessionPolicy.sessionsBetween('2024-01-02', BENCH_AS_OF_DATE);
  if (!sessions.ok) throw new Error('no sessions');
  const run = sessions.value.slice(0, SMOKE_SESSIONS);
  const profile = benchScale(SMOKE_SESSIONS, sessions.value.length);
  return { profile, ...schedule(run.map((s) => Date.parse(s.date)), profile, run.map((s) => Date.parse(s.close))) };
}

describe('bench generator Trades', () => {
  it('should write each Trade as one document with the schedule lifecycles, Position Changes, Executions and Expirations counted from every fact, and the option share of the mix', async () => {
    const { artifact, storeCounts } = await smoke();
    const expected = smokeSchedule();
    const trades = recordsOf(artifact.parts, 'trades');
    expect(trades).toHaveLength(expected.profile.trades);
    expect(storeCounts['trades']).toBe(expected.profile.trades);
    const lifecycles = (name: string) => trades.filter((trade) => trade.lifecycle === name).length;
    expect(lifecycles('Closed')).toBe(expected.profile.closedTrades);
    expect(lifecycles('Open')).toBe(expected.profile.openTrades);
    expect(lifecycles('Planned')).toBe(expected.profile.plannedTrades);
    const facts = trades.flatMap((trade) => trade.facts);
    expect(facts.filter((fact) => fact.kind === 'PositionChange')).toHaveLength(expected.positionChanges);
    expect(facts.filter((fact) => fact.kind === 'Execution')).toHaveLength(expected.executions);
    expect(facts.filter((fact) => fact.kind === 'Expiration')).toHaveLength(expected.expirations);
    // 30 percent are option Trades: the first three of every ten.
    const optionTrades = trades.filter((trade) => trade.facts.some((fact) => fact.kind === 'PlannedLeg' && fact.versions[0]!.value.instrument.kind === 'Option'));
    const n = expected.profile.trades;
    expect(optionTrades).toHaveLength(3 * Math.floor(n / 10) + Math.min(n % 10, 3));
    // The per-record write stamp and the private index fields are not in the artifact (Q3, A125).
    for (const trade of trades) for (const name of ['revision', 'exposureStart', 'terminalTime', 'activityDesc', 'terminalDesc']) expect(trade).not.toHaveProperty(name);
  });
});

describe('bench generator Marks', () => {
  it('should save the 90 stock Instruments a Mark every session but the as-of one, which leaves 10 Missing, correct every 100th Mark once, and mark no contract after it expires', async () => {
    const { artifact, expected } = await smoke();
    const observations = recordsOf(artifact.parts, 'observations');
    const sessions = nyseSessionPolicy.sessionsBetween('2024-01-02', BENCH_AS_OF_DATE);
    if (!sessions.ok) throw new Error('no sessions');
    const dates = sessions.value.slice(0, SMOKE_SESSIONS).map((session) => session.date);
    expect([...new Set(observations.map((o) => o.tradingDate))]).toEqual(dates);
    // In primary-key order: trading date, then Instrument key.
    const keys = observations.map((o) => `${o.tradingDate} ${o.instrumentKey}`);
    expect(keys).toEqual([...keys].sort());
    const isStock = (key: string) => !/\d/.test(key);
    const stockOn = (date: string) => observations.filter((o) => o.tradingDate === date && isStock(o.instrumentKey));
    for (const date of dates.slice(0, -1)) expect(stockOn(date)).toHaveLength(90);
    expect(stockOn(dates.at(-1)!)).toHaveLength(80);
    expect(expected.missingInstruments).toHaveLength(10);
    expect(new Set([...stockOn(dates.at(-1)!).map((o) => o.instrumentKey), ...expected.missingInstruments]).size).toBe(90);
    const initial = observations.reduce((sum, o) => sum + o.marks.length - (o.marks.length > 1 ? 1 : 0), 0);
    const corrections = observations.filter((o) => o.marks.length > 1);
    expect(corrections).toHaveLength(Math.floor(initial / 100));
    for (const o of corrections) {
      expect(o.marks.map((m) => m.intention)).toEqual(['InitialManual', 'Correction']);
      expect(o.marks[1]!.supersedes).toBe(o.marks[0]!.revisionId);
      expect(o.effectiveMarkId).toBe(o.marks[1]!.revisionId);
      expect(o.resolutionRevision).toBe(2);
    }
    // A contract key is root, YYMMDD, right and strike; its expiration is not before the Mark's date.
    for (const o of observations.filter((o) => !isStock(o.instrumentKey))) {
      const key = o.instrumentKey;
      const [, yy, mm, dd] = /^[A-Z]+(\d\d)(\d\d)(\d\d)[CP]\d{8}$/.exec(key)!;
      expect(`20${yy}-${mm}-${dd}` >= o.tradingDate).toBe(true);
    }
    expect(observations.some((o) => !isStock(o.instrumentKey))).toBe(true);
  });
});

describe('bench generator Journal', () => {
  it('should give every Plan its reflection, every Position Change and Close its outcome by the section 1.4 dispositions, each deferred one a Debt settled, declined or still Outstanding, and every session an Action for each Trade open at its cutoff', async () => {
    const { artifact, expected } = await smoke();
    const plan = smokeSchedule();
    const reflections = dispositionsFor(plan.positionChanges, BENCH_SEED).counts;
    const closes = dispositionsFor(plan.closes, BENCH_SEED + 1).counts;
    const entries = recordsOf(artifact.parts, 'journalEntries');
    const declines = recordsOf(artifact.parts, 'journalDeclines');
    const debts = recordsOf(artifact.parts, 'journalDebts');
    const typeOf = (key: string) => entries.filter((entry) => entry.entryTypeKey === key);
    const declinesOf = (key: string) => declines.filter((decline) => decline.entryTypeKey === key);
    const debtsOf = (key: string) => debts.filter((debt) => debt.entryTypeKey === key);
    const status = (debt: Rec) => debt.versions.at(-1)!.status;
    expect(typeOf('entry-type.plan-reflection')).toHaveLength(plan.profile.trades);
    expect(typeOf('entry-type.position-change-reflection')).toHaveLength(reflections.complete + reflections.answered);
    expect(declinesOf('entry-type.position-change-reflection')).toHaveLength(reflections.declined + reflections.declinedLater);
    expect(debtsOf('entry-type.position-change-reflection')).toHaveLength(reflections.answered + reflections.declinedLater + reflections.outstanding);
    expect(typeOf('entry-type.close-review')).toHaveLength(closes.complete + closes.answered);
    expect(declinesOf('entry-type.close-review')).toHaveLength(closes.declined + closes.declinedLater);
    expect(debtsOf('entry-type.close-review')).toHaveLength(closes.answered + closes.declinedLater + closes.outstanding);
    expect(debts.filter((debt) => status(debt) === 'Settled')).toHaveLength(reflections.answered + closes.answered);
    expect(debts.filter((debt) => status(debt) === 'Declined')).toHaveLength(reflections.declinedLater + closes.declinedLater);
    const outstanding = debts.filter((debt) => status(debt) === 'Outstanding');
    expect(outstanding).toHaveLength(reflections.outstanding + closes.outstanding);
    expect(expected.asOfDueReflections).toBe(outstanding.length);
    expect(expected.outstandingDebts.map((debt) => debt.debtId).sort()).toEqual(outstanding.map((debt) => debt.debtId));
    // A resolved Debt and its outcome name each other.
    for (const debt of debts.filter((debt) => status(debt) !== 'Outstanding')) {
      const resolution = debt.versions.at(-1)!;
      const outcome = (resolution.status === 'Settled' ? entries : declines).find((record) => record.id === (resolution.entryId ?? resolution.declineId));
      expect(outcome?.settledDebtId).toBe(debt.debtId);
      expect(outcome?.obligationKey).toBe(debt.obligationKey);
    }
    // An Action for each Trade open at a session's cutoff, from the second session: the first Execution is before the
    // cutoff and the terminal Position Change is not.
    const sessions = nyseSessionPolicy.sessionsBetween('2024-01-02', BENCH_AS_OF_DATE);
    if (!sessions.ok) throw new Error('no sessions');
    const trades = recordsOf(artifact.parts, 'trades');
    const spans = trades.flatMap((trade) => {
      const { facts } = trade;
      const first = facts.filter((fact) => fact.kind === 'Execution').map((fact) => Date.parse(fact.versions[0]!.value.economicTime)).sort((a, b) => a - b)[0];
      if (first === undefined) return [];
      const last = trade.lifecycle === 'Closed' ? Math.max(...facts.filter((fact) => fact.kind === 'PositionChange').map((fact) => Date.parse(fact.versions[0]!.value.economicTime))) : Infinity;
      return [{ first, last }];
    });
    const actions = typeOf('entry-type.daily-trade-review');
    const walked = sessions.value.slice(1, SMOKE_SESSIONS).reduce((sum, session) => sum + spans.filter((span) => span.first < Date.parse(session.completion) && !(span.last < Date.parse(session.completion))).length, 0);
    expect(actions).toHaveLength(walked);
    expect(actions.length).toBeGreaterThan(0);
    // One in fifty is edited once; three of every twenty are not a Hold.
    expect(actions.filter((entry) => entry.versions.length > 1)).toHaveLength(Math.ceil(actions.length / 50));
    const choice = (entry: Rec) => entry.versions[0]!.responses[0]!.value.optionId.split('.').at(-1);
    expect(actions.filter((entry) => choice(entry) !== 'hold')).toHaveLength(Array.from({ length: actions.length }, (_, n) => n).filter((n) => n % 20 < 3).length);
  });
});

describe('bench generator restore', () => {
  it('should prepare the artifact through the production Restore with zero issues and zero repairs, and the preview counts equal the schedule', async () => {
    const { artifact } = await smoke();
    const plan = smokeSchedule();
    const target = await targetWorkspace();
    const bytes = new Uint8Array(artifact.parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const part of artifact.parts) {
      bytes.set(part, at);
      at += part.length;
    }
    const result = await target.workspace.prepareRestore({ file: backupFile(bytes) });
    if (result.kind !== 'Prepared') throw new Error(`expected Prepared, got ${JSON.stringify(result).slice(0, 600)}`);
    expect(result.preview.repairs).toEqual([]);
    expect(result.preview.migrations).toEqual({ steps: [], seedAdditions: [] });
    expect(result.preview.counts).toMatchObject({
      tradesByLifecycle: { Planned: plan.profile.plannedTrades, Open: plan.profile.openTrades, Closed: plan.profile.closedTrades },
      positionChanges: plan.positionChanges,
      executions: plan.executions,
      expirations: plan.expirations,
      institutions: 3,
      accounts: 6,
      strategies: 4,
      closeReasons: 4,
    });
  }, 300_000);
});

describe('bench generator expected values', () => {
  it('should count the dataset from the stored records and expect the as-of Review: the walk the Open Trades, the owed group the other Trades with an Outstanding Debt, and the Settlement Due contracts', async () => {
    const { artifact, expected } = await smoke();
    const plan = smokeSchedule();
    const trades = recordsOf(artifact.parts, 'trades');
    const entries = recordsOf(artifact.parts, 'journalEntries');
    const observations = recordsOf(artifact.parts, 'observations');
    const debts = recordsOf(artifact.parts, 'journalDebts');
    const { counts } = expected;
    expect(counts).toMatchObject({
      trades: plan.profile.trades,
      openTrades: plan.profile.openTrades,
      plannedTrades: plan.profile.plannedTrades,
      closedTrades: plan.profile.closedTrades,
      positionChanges: plan.positionChanges,
      executions: plan.executions,
      expirations: plan.expirations,
      expirationsAfterPartialExit: plan.expirationsAfterPartialExit,
      institutions: 3,
      accounts: 6,
      strategies: 4,
      planReflectionEntries: plan.profile.trades,
      acknowledgments: 0,
      debts: debts.length,
    });
    expect(counts.actions).toBe(entries.filter((entry) => entry.entryTypeKey === 'entry-type.daily-trade-review').length);
    expect(Object.values(expected.actionsByChoice).reduce((a, b) => a + b, 0)).toBe(counts.actions);
    expect(counts.marks).toBe(observations.length);
    expect(counts.markCorrections).toBe(observations.filter((o) => o.marks.length > 1).length);
    expect(counts.sessions).toBe(SMOKE_SESSIONS);
    expect(Object.values(counts.closeReasons).reduce((a, b) => a + b, 0)).toBe(plan.profile.closedTrades - plan.expirations);
    expect(counts.optionTrades).toBe(counts.longCalls + counts.longPuts + counts.cashSecuredPuts);
    expect(counts.exerciseIntentPlans).toBe(counts.longCalls + counts.longPuts);
    // The Open book's Instruments, counted from every Planned Leg of the Open Trades.
    const openLegs = trades.filter((trade) => trade.lifecycle === 'Open').flatMap((trade) => trade.facts.filter((fact) => fact.kind === 'PlannedLeg').map((fact) => fact.versions[0]!.value.instrument));
    expect(counts.openInstruments).toBe(new Set(openLegs.map((leg) => (leg.kind === 'Stock' ? leg.symbol : `${leg.root}${leg.expiration}${leg.right}${leg.strike}`))).size);

    const sessions = nyseSessionPolicy.sessionsBetween('2024-01-02', BENCH_AS_OF_DATE);
    if (!sessions.ok) throw new Error('no sessions');
    const last = sessions.value[SMOKE_SESSIONS - 1]!;
    expect(expected.reviewDate).toBe(last.date);
    expect(expected.asOf).toBe(new Date(Date.parse(last.completion) + 5 * 60_000).toISOString().replace('.000Z', 'Z'));
    const open = trades.filter((trade) => trade.lifecycle === 'Open').map((trade) => trade.tradeId).sort();
    expect(expected.asOfReview.walk).toEqual(open);
    const outstanding = debts.filter((debt) => debt.versions.at(-1)!.status === 'Outstanding');
    const owed = [...new Set(outstanding.map((debt) => debt.anchorTradeId).filter((id) => !open.includes(id)))].sort();
    expect(expected.asOfReview.owedGroup.map((group) => group.tradeId)).toEqual(owed);
    expect(expected.asOfReview.owedGroup.flatMap((group) => group.debtIds).sort()).toEqual(outstanding.filter((debt) => !open.includes(debt.anchorTradeId)).map((debt) => debt.debtId));
    // Settlement Due: Open option Trades whose contract expires on the as-of date.
    const due = trades.filter((trade) => trade.lifecycle === 'Open' && trade.facts.some((fact) => fact.kind === 'PlannedLeg' && fact.versions[0]!.value.instrument.kind === 'Option' && fact.versions[0]!.value.instrument.expiration === last.date));
    expect(expected.asOfReview.settlement.map((item) => item.tradeId).sort()).toEqual(due.map((trade) => trade.tradeId).sort());
    expect(due.length).toBeGreaterThan(0);
    for (const item of expected.asOfReview.settlement) expect(item.expiration).toBe(last.date);
  });
});

describe('bench generator full profile', () => {
  it('should accept counts that are exactly the section 1.4 profile and name the counts of a profile that misses it', async () => {
    const { expected } = await smoke();
    expect(() => assertFullProfile(expected.counts)).toThrow(/misses section 1\.4/);
    const exact = {
      ...expected.counts,
      trades: 25_000, closedTrades: 24_700, openTrades: 200, plannedTrades: 100,
      optionTrades: 7_500, longCalls: 3_000, longPuts: 2_000, cashSecuredPuts: 2_500,
      exerciseIntentPlans: 5_000, authorizedPlans: 500, openOptionTrades: 60, expirations: 2_964,
      closeReviewEntries: 20_000, closeReviewDeclines: 4_000, closeReviewDebtsOutstanding: 700,
    };
    expect(() => assertFullProfile(exact)).not.toThrow();
    expect(() => assertFullProfile({ ...exact, longPuts: 1_999 })).toThrow(/misses section 1\.4/);
    // Every Closed Trade has exactly one Close Review outcome, an Entry, a decline or a Debt left Outstanding.
    expect(() => assertFullProfile({ ...exact, closeReviewDeclines: 3_999 })).toThrow(/misses section 1\.4/);
  });
});

describe('bench generator determinism', () => {
  it('should produce identical digests, section digests, counts and expected values on a second run of the same generator version', async () => {
    const first = await smoke();
    const second = await generateBenchArtifact({ calendar: realCalendar(), sessions: SMOKE_SESSIONS });
    expect(second.artifact.fullDigest).toBe(first.artifact.fullDigest);
    expect(second.artifact.manifestDigest).toBe(first.artifact.manifestDigest);
    expect(second.artifact.sectionDigests).toEqual(first.artifact.sectionDigests);
    expect(Object.keys(first.artifact.sectionDigests)).toEqual(['workspace', 'catalog', 'marketData', 'trades', 'journal']);
    expect(second.storeCounts).toEqual(first.storeCounts);
    expect(second.expected).toEqual(first.expected);
    expect(second.bytes).toBe(first.bytes);
    // The file is the same bytes too: the gzip header's modification time (bytes 4 to 7) is zero, not the clock.
    expect([...first.artifact.parts[0]!.slice(4, 8)]).toEqual([0, 0, 0, 0]);
    expect(Buffer.compare(Buffer.from(second.artifact.parts[0]!), Buffer.from(first.artifact.parts[0]!))).toBe(0);
  }, 120_000);
});

// The smoke run again, with the expected Open rows and Review order taken from the application after a Node Restore (T8.18-F2).
const benchViewsPort = { restore: restoreInNode, openRowsOf };
let smokeViewsPromise: Promise<GeneratedBench> | undefined;
const smokeWithViews = () => (smokeViewsPromise ??= generateBenchArtifact({ calendar: realCalendar(), sessions: SMOKE_SESSIONS, views: benchViewsPort }));

describe('bench generator expected Open rows and Review order (D8 T8.18-F2)', () => {
  it('should write non-empty expected Open rows equal to the application browseTrades and row function after a Node Restore', async () => {
    const { artifact, expected } = await smokeWithViews();
    const app = await restoreInNode(artifact.parts[0]!, expected.asOf);
    const browsed = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' });
    if (browsed.kind !== 'Ready') throw new Error(`browseTrades: ${browsed.kind}`);
    const { headers, rows } = openRowsOf(browsed.view.items, BENCH_TIME_ZONE);
    expect(rows.length).toBeGreaterThan(0);
    expect(expected.openRows).toEqual({ headers, rows, items: browsed.view.items });
    expect(expected.openRows!.headers).toEqual(['Underlying', 'Trade', 'Net cost', 'P&L', 'Entry', 'Account']);
    expect(expected.openRows!.rows).toHaveLength(expected.counts.openTrades);
  }, 300_000);

  it('should write the Daily Review walk in the application attention order, not in Trade identity order', async () => {
    const { artifact, expected } = await smokeWithViews();
    const app = await restoreInNode(artifact.parts[0]!, expected.asOf);
    const review = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: expected.asOf });
    if (review.kind !== 'Ready') throw new Error(`DailyReview.open: ${review.kind}`);
    const order = review.families.flatMap((family) => (family.family === 'Trades' ? family.trades.map((trade) => trade.tradeId) : []));
    expect(expected.asOfReview.walk).toEqual(order);
    expect(expected.asOfReview.owedGroup.map((group) => group.tradeId)).toEqual(review.owed.map((group) => group.tradeId));
    // The order is the application's: the same Trades as the identity-sorted walk, but not in that order.
    expect(expected.asOfReview.walk).not.toEqual([...order].sort());
    expect(new Set(expected.asOfReview.walk)).toEqual(new Set(order));
  }, 300_000);

  it('should fail generation when the application membership differs from the membership the generator counted', async () => {
    const { artifact, expected } = await smokeWithViews();
    // The generator's own count lists the walk and the owed group by Trade identity.
    const independent = {
      asOf: expected.asOf,
      counts: expected.counts,
      asOfReview: { ...expected.asOfReview, walk: [...expected.asOfReview.walk].sort(), owedGroup: [...expected.asOfReview.owedGroup].sort((a, b) => (a.tradeId < b.tradeId ? -1 : 1)) },
    };
    const bytes = artifact.parts[0]!;
    await expect(viewsOfRestored(benchViewsPort, bytes, { ...independent, asOfReview: { ...independent.asOfReview, walk: independent.asOfReview.walk.slice(1) } })).rejects.toThrow(/Open list membership/);
    await expect(viewsOfRestored(benchViewsPort, bytes, { ...independent, asOfReview: { ...independent.asOfReview, owedGroup: independent.asOfReview.owedGroup.slice(1) } })).rejects.toThrow(/owed group membership/);
    await expect(viewsOfRestored(benchViewsPort, bytes, { ...independent, asOfReview: { ...independent.asOfReview, settlement: independent.asOfReview.settlement.slice(1) } })).rejects.toThrow(/Settlement Due items/);
  }, 300_000);
});

describe('bench expected rows provenance', () => {
  const rows = [['QAI']];
  it('should reuse rows this generator wrote for this artifact', () => {
    expect(rowsAreFromGenerator({ rows, writer: BENCH_ROWS_WRITER, artifactFileDigest: 'abc' }, 'abc')).toBe(true);
  });
  it('should refuse rows the browser path wrote', () => {
    expect(rowsAreFromGenerator({ rows, writer: 'bench:expected', artifactFileDigest: 'abc' }, 'abc')).toBe(false);
  });
  it('should refuse rows written for another artifact or with no provenance', () => {
    expect(rowsAreFromGenerator({ rows, writer: BENCH_ROWS_WRITER, artifactFileDigest: 'other' }, 'abc')).toBe(false);
    expect(rowsAreFromGenerator({ rows }, 'abc')).toBe(false);
    expect(rowsAreFromGenerator(undefined, 'abc')).toBe(false);
  });
});

describe('bench generator marker', () => {
  it('should name the current generator version so a stale bench build fails the bundle check', () => {
    expect(BENCH_GENERATOR_MARKER).toBe(`tj-bench-generator-v${BENCH_GENERATOR_VERSION}`);
  });
});
