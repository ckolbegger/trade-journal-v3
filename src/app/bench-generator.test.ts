import { describe, expect, it } from 'vitest';
import { countHeld, schedule } from './bench-generator.ts';
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

describe('bench generator marker', () => {
  it('should name the current generator version so a stale bench build fails the bundle check', () => {
    expect(BENCH_GENERATOR_MARKER).toBe(`tj-bench-generator-v${BENCH_GENERATOR_VERSION}`);
  });
});
