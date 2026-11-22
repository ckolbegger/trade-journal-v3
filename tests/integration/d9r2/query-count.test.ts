// I9R2.4 Query count (AC-PERF-001, cumulative): the Review open's store requests are D9's (tests/integration/d9/query-count.test.ts I9.6), the
// earlier Marks adding none (A289). R-BREN-U open at Mon 11-16 17:00 with Marks through that day, on a fresh launch.
import { describe, expect, it } from 'vitest';
import { R_BREN_U } from '../../../src/domain/trade-analysis/option-trade.ts';
import { countRequests, type CountedRequest } from '../../support/request-counter.ts';
import { restart } from '../d7s/support.ts';
import { MON_1116_1700, marksFamily, seriesApp } from './support.ts';

const tallyOf = (requests: readonly CountedRequest[]) => {
  const tally: Record<string, number> = {};
  for (const r of requests) tally[`${r.store}.${r.method}`] = (tally[`${r.store}.${r.method}`] ?? 0) + 1;
  return tally;
};
const DATE_WIDE = { on: 'store', store: 'observations', method: 'getAll' };
const SERIES = { on: 'index', store: 'observations', index: 'byInstrumentDate', method: 'getAll' };

// D9's recorded count of the open for a Workspace holding the one Trade (I9.6).
const OPEN = { 'journalDebts.getAll': 1, 'journalDefinitions.getAll': 1, 'journalEntries.getAll': 1, 'journalObligations.getAll': 1, 'journalTypes.getAll': 1, 'meta.get': 14, 'observations.getAll': 4, 'trades.getAll': 2 };

describe('I9R2.4 Query counts (AC-PERF-001, cumulative)', () => {
  it('I9R2.4 should issue the same store requests for the open as D9 while listing earlier Marks', { timeout: 120_000 }, async () => {
    const { d, app } = await seriesApp(R_BREN_U, 'strategy.long-call', MON_1116_1700, { marksThrough: 10 });

    const openApp = await restart(app, d);

    const open = await countRequests(() => openApp.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MON_1116_1700 }));
    if (open.result.kind !== 'Ready') throw new Error(`open: ${open.result.kind}`);

    // Catches an open that lists no earlier Marks, which would make the count below prove nothing.
    expect(marksFamily(open.result).earlierMarks.length).toBeGreaterThan(0);
    // Catches any added request: a new store read, a series read of its own, or a repeated date read.
    expect(tallyOf(open.requests)).toEqual(OPEN);
    expect(open.requests.filter((r) => r.store === 'observations')).toEqual([DATE_WIDE, DATE_WIDE, SERIES, SERIES]);
  });
});
