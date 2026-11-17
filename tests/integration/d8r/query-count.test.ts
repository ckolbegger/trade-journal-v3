// I8R.7 query count (AC-PERF-001, cumulative; A234): with O-C3 and O-S2X open, the store requests of getTradeDetail.
// Counted as D8P's I8P.4 does, with the real facade on fake-indexeddb wrapped in the disclosed request counter (D2 section 6.0).
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { countRequests, type CountedRequest } from '../../support/request-counter.ts';
import { instrumentKey } from '../../../src/domain/instrument/index.ts';
import { confirmOption, MNO_PUT, OS_S1, recordOption, THURSDAY, TUESDAY, WEDNESDAY } from '../d7s/support.ts';
import { at, MONDAY_NOV_23_1800, oc3, restart, saveMark } from './support.ts';

type Tally = Record<string, number>;
const tallyOf = (requests: readonly CountedRequest[]): Tally => {
  const tally: Tally = {};
  for (const r of requests) tally[`${r.store}.${r.method}`] = (tally[`${r.store}.${r.method}`] ?? 0) + 1;
  return tally;
};

// D8's recorded count for the Detail of an Open option Trade with a Mark on the Expected Mark Date (20 requests;
// tests/integration/d8p/replay-query-count.test.ts, D7S_DETAIL, itself D7's PINNED count).
const D8_OPEN_DETAIL = { 'catalog.getAll': 1, 'journalDebts.getAll': 1, 'journalDeclines.getAll': 1, 'journalDefinitions.getAll': 1, 'journalEntries.getAll': 1, 'journalTypes.getAll': 1, 'meta.get': 11, 'observations.getAll': 1, 'trades.get': 2 };

// Each read on a fresh launch over the same stores, so no read warms another.
async function detailCounted(app: Application, d: Parameters<typeof restart>[1], tradeId: string) {
  const fresh = await restart(app, d);
  const counted = await countRequests(() => fresh.TradeViewsAndReporting.getTradeDetail({ tradeId }));
  if (counted.result.kind !== 'Ready') throw new Error(`getTradeDetail: ${counted.result.kind}`);
  return { app: fresh, tally: tallyOf(counted.requests), requests: counted.requests };
}

describe('I8R.7 Query count (AC-PERF-001, cumulative)', () => {
  it('I8R.7 Query count (AC-PERF-001, cumulative)', { timeout: 120_000 }, async () => {
    // O-C3 as D8P gives it (Thu 10-15 18:00), beside O-S2X, 2 short MNO 20 Nov 45 Puts, with its Underlying's Marks.
    const { d, app, tradeId: oc3Id } = await oc3({ thursdayHold: true });
    const os2xId = (await confirmOption(app, 'O-S')).receipt.tradeId;
    await recordOption(app, os2xId, 'Sell', OS_S1);
    // Marks Tuesday to Thursday for MNO and its put, as D8P's workspace has for O-S2, so the Open Detail reads no earlier session.
    for (const [date, mno, put] of [[TUESDAY, '44.00', '1.00'], [WEDNESDAY, '43.00', '1.50'], [THURSDAY, '42.00', '2.00']] as const) {
      await saveMark(app, 'MNO', date, mno);
      await saveMark(app, instrumentKey(MNO_PUT), date, put);
    }

    // Open: both Details' requests are D8's, whatever the Workspace holds.
    const oc3Open = await detailCounted(app, d, oc3Id);
    const os2xOpen = await detailCounted(oc3Open.app, d, os2xId);
    expect(oc3Open.tally).toEqual(D8_OPEN_DETAIL);
    expect(os2xOpen.tally).toEqual(D8_OPEN_DETAIL);

    // Settlement Due (Mon 11-23 18:00): the Underlying's series is the one read added.
    const monday = at(d, MONDAY_NOV_23_1800);
    const atMonday = await restart(os2xOpen.app, monday);
    await saveMark(atMonday, 'MNO', '2026-11-20', '45.50');
    await saveMark(atMonday, 'MNO', '2026-11-23', '44.25');
    const due = await detailCounted(atMonday, monday, os2xId);
    expect(due.tally).toEqual({ ...D8_OPEN_DETAIL, 'observations.getAll': 2 });
    expect(due.requests.filter((r) => r.store === 'observations')).toEqual([
      { on: 'store', store: 'observations', method: 'getAll' },
      { on: 'index', store: 'observations', index: 'byInstrumentDate', method: 'getAll' },
    ]);
  });
});
