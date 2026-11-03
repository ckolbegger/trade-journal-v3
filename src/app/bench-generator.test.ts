import { describe, expect, it } from 'vitest';
import { schedule } from './bench-generator.ts';

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

describe('bench generator schedule', () => {
  it('should schedule every Position Change before its session close on early-close days', () => {
    const { days, closes } = calendar();
    // About 20 Trades planned a session, as at full scale (25,000 Trades over 1,245 planning sessions).
    const profile = { sessions: days.length, full: false, trades: 500, openTrades: 5, plannedTrades: 3, closedTrades: 492 };
    const { events } = schedule(days, profile, closes);
    const sessionOf = (time: number) => days.findIndex((day) => time >= day && time < day + DAY);
    const changes = events.filter((event) => event.kind === 'PositionChange');
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
