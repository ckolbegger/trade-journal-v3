// I8P.4 query count (AC-PERF-001, cumulative; A219): with O-C3 and O-S2 open, the store requests of getTradeDetail, then of replayTrade.
// Counted as D7's query-count proof does, with the real facade on fake-indexeddb wrapped in the disclosed request counter (D2 section 6.0).
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { countRequests, type CountedRequest } from '../../support/request-counter.ts';
import { openOs2, restart, saveSession, THURSDAY, TUESDAY, WEDNESDAY } from '../d7s/support.ts';
import { oc3, type Oc3 } from './support.ts';

type Tally = Record<string, number>;
const tallyOf = (requests: readonly CountedRequest[]): Tally => {
  const tally: Tally = {};
  for (const r of requests) tally[`${r.store}.${r.method}`] = (tally[`${r.store}.${r.method}`] ?? 0) + 1;
  return tally;
};

// D7's recorded count for the Detail of an Open option Trade with a Mark on the Expected Mark Date, which D7S's Detail still issues
// (tests/integration/d7/query-count.test.ts, PINNED: 20 requests).
const D7S_DETAIL = { 'catalog.getAll': 1, 'journalDebts.getAll': 1, 'journalDeclines.getAll': 1, 'journalDefinitions.getAll': 1, 'journalEntries.getAll': 1, 'journalTypes.getAll': 1, 'meta.get': 11, 'observations.getAll': 1, 'trades.get': 2 };

// replayTrade's requests for an option Trade of two Instruments (measured at schema 7 with D08P's replay): 17 requests, 3 fewer than
// the Detail's 20 (no Catalog read, one Trade read and 3 fewer `meta` reads), with 3 on `observations`.
const DATE_WIDE = { on: 'store', store: 'observations', method: 'getAll' };
const PER_INSTRUMENT = { on: 'index', store: 'observations', index: 'byInstrumentDate', method: 'getAll' };
const REPLAY = { 'journalDebts.getAll': 1, 'journalDeclines.getAll': 1, 'journalDefinitions.getAll': 1, 'journalEntries.getAll': 1, 'journalTypes.getAll': 1, 'meta.get': 8, 'observations.getAll': 3, 'trades.get': 1 };

// O-C3 as section 5 gives it, beside O-S2 (Marks Tuesday to Thursday for MNO and its put) and a Long Stock Trade, all open at Thu 10-15 17:00.
async function workspace(): Promise<Oc3 & { readonly os2: string }> {
  const built = await oc3();
  const os2 = await openOs2(built.app);
  await saveSession(built.app, TUESDAY, { mno: '44.00', put: '1.00' });
  await saveSession(built.app, WEDNESDAY, { mno: '43.00', put: '1.50' });
  await saveSession(built.app, THURSDAY, { mno: '42.00', put: '2.00' });
  return { ...built, os2 };
}

// Each read on a fresh launch over the same stores, so neither warms the other.
async function detailCounted(app: Application, d: Oc3['d'], tradeId: string) {
  const fresh = await restart(app, d);
  const counted = await countRequests(() => fresh.TradeViewsAndReporting.getTradeDetail({ tradeId }));
  if (counted.result.kind !== 'Ready') throw new Error(`getTradeDetail: ${counted.result.kind}`);
  return { app: fresh, tally: tallyOf(counted.requests), binding: counted.result.binding };
}

async function replayCounted(app: Application, d: Oc3['d'], tradeId: string) {
  const { binding } = await detailCounted(app, d, tradeId);
  const fresh = await restart(app, d);
  const counted = await countRequests(() => fresh.TradeViewsAndReporting.replayTrade({ tradeId, binding }));
  if (counted.result.kind !== 'Ready') throw new Error(`replayTrade: ${counted.result.kind}`);
  return { app: fresh, tally: tallyOf(counted.requests), requests: counted.requests };
}

describe('I8P.4 Query count (AC-PERF-001, cumulative)', () => {
  it('I8P.4 Query count (AC-PERF-001, cumulative)', { timeout: 120_000 }, async () => {
    const { d, app, tradeId, os2 } = await workspace();

    // The Detail's requests, before any replay has run: D7S's count for both Trades, whatever else the Workspace holds.
    const oc3Detail = await detailCounted(app, d, tradeId);
    const os2Detail = await detailCounted(oc3Detail.app, d, os2);
    expect(oc3Detail.tally).toEqual(D7S_DETAIL);
    expect(os2Detail.tally).toEqual(D7S_DETAIL);

    // The replay reads each of its two Instruments' observations once (one byInstrumentDate getAll each, no cursor and no per-session
    // read), beside the one date-wide read the Detail makes too. The same for O-C3's four sessions and O-S2's, so nothing is per session.
    const oc3Replay = await replayCounted(os2Detail.app, d, tradeId);
    const os2Replay = await replayCounted(oc3Replay.app, d, os2);
    for (const replay of [oc3Replay, os2Replay]) {
      expect(replay.requests.filter((r) => r.store === 'observations')).toEqual([DATE_WIDE, PER_INSTRUMENT, PER_INSTRUMENT]);
      expect(replay.tally).toEqual(REPLAY);
    }

    // A replay having run leaves the Detail's requests as they were.
    const after = await detailCounted(os2Replay.app, d, tradeId);
    expect(after.tally).toEqual(D7S_DETAIL);
  });
});
