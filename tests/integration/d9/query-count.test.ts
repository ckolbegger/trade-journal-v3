// I9.6 Query counts (AC-PERF-001, cumulative): R-BREN-U open at Mon 11-16 17:00 with Marks through that day. The store requests of
// replayTrade, DailyReview.getTrade and DailyReview.open, counted with the real facade on fake-indexeddb wrapped in the disclosed
// request counter, each read on a fresh launch so no read warms another.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { R_BREN_U } from '../../../src/domain/trade-analysis/option-trade.ts';
import { countRequests, type CountedRequest } from '../../support/request-counter.ts';
import { restart } from '../d7s/support.ts';
import { MON_1116_1700, seriesApp } from './support.ts';

type Tally = Record<string, number>;
const tallyOf = (requests: readonly CountedRequest[]): Tally => {
  const tally: Tally = {};
  for (const r of requests) tally[`${r.store}.${r.method}`] = (tally[`${r.store}.${r.method}`] ?? 0) + 1;
  return tally;
};
const observations = (requests: readonly CountedRequest[]) => requests.filter((r) => r.store === 'observations');

const DATE_WIDE = { on: 'store', store: 'observations', method: 'getAll' };
const SERIES = { on: 'index', store: 'observations', index: 'byInstrumentDate', method: 'getAll' };

// D8P's recorded count of replayTrade for a Trade of two Instruments (tests/integration/d8p/replay-query-count.test.ts): D9 adds no request.
const REPLAY = { 'journalDebts.getAll': 1, 'journalDeclines.getAll': 1, 'journalDefinitions.getAll': 1, 'journalEntries.getAll': 1, 'journalTypes.getAll': 1, 'meta.get': 8, 'observations.getAll': 3, 'trades.get': 1 };

// The Review's open for a Workspace holding the one Trade: no Journal narrative and no series read of the replay.
const OPEN = { 'journalDebts.getAll': 1, 'journalDefinitions.getAll': 1, 'journalObligations.getAll': 1, 'journalTypes.getAll': 1, 'meta.get': 14, 'observations.getAll': 4, 'trades.getAll': 2 };
// getTrade's card of that Trade: its own reads, with 'observations.getAll' 3 being the date-wide read plus one series read per Instrument
// of the Trade (the Underlying and the call), the replay's only addition; no Journal narrative read.
const CARD = { 'catalog.getAll': 1, 'journalDebts.getAll': 1, 'journalDefinitions.getAll': 2, 'journalObligations.getAll': 1, 'journalTypes.getAll': 1, 'meta.get': 17, 'observations.getAll': 3, 'trades.getAll': 2 };

describe('I9.6 Query counts (AC-PERF-001, cumulative)', () => {
  it('I9.6 should keep replayTrade at D8R requests, add one series read per Instrument to getTrade and leave open unchanged', { timeout: 120_000 }, async () => {
    const { d, app, tradeId } = await seriesApp(R_BREN_U, 'strategy.long-call', MON_1116_1700, { marksThrough: 10 });
    const fresh = async (current: Application) => restart(current, d);

    // replayTrade, with the binding of a Detail read on its own launch.
    const detailApp = await fresh(app);
    const detail = await detailApp.TradeViewsAndReporting.getTradeDetail({ tradeId });
    if (detail.kind !== 'Ready') throw new Error(`getTradeDetail: ${detail.kind}`);
    const replayApp = await fresh(detailApp);
    const replay = await countRequests(() => replayApp.TradeViewsAndReporting.replayTrade({ tradeId, binding: detail.binding }));
    if (replay.result.kind !== 'Ready') throw new Error(`replayTrade: ${replay.result.kind}`);
    expect(tallyOf(replay.requests)).toEqual(REPLAY);
    expect(observations(replay.requests)).toEqual([DATE_WIDE, SERIES, SERIES]);

    // open: no series read, and nothing for the card's replay.
    const openApp = await fresh(replayApp);
    const open = await countRequests(() => openApp.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MON_1116_1700 }));
    if (open.result.kind !== 'Ready') throw new Error(`open: ${open.result.kind}`);
    expect(tallyOf(open.requests)).toEqual(OPEN);
    // Its reads of observations are D6's, Monday's date-wide read and the recovery's gap scan of each of the Trade's Instruments, and one more
    // date's: the session before's date-wide read, for the meter's earlier result (T9.31, P133).
    expect(observations(open.requests)).toEqual([DATE_WIDE, DATE_WIDE, SERIES, SERIES]);

    // getTrade: the same requests as before the replay, plus one series read per Instrument (the Underlying and the call), and no
    // Journal narrative read for it: the card's replay places no Journal items.
    const cardApp = await fresh(openApp);
    const opened = await cardApp.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MON_1116_1700 });
    if (opened.kind !== 'Ready') throw new Error(`open: ${opened.kind}`);
    const card = await countRequests(() => cardApp.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding }));
    if (card.result.kind !== 'Ready') throw new Error(`getTrade: ${card.result.kind}`);
    expect(card.result.trade.replay).toBeTruthy();
    expect(observations(card.requests).filter((r) => r.on === 'index' && r.index === 'byInstrumentDate' && r.method === 'getAll')).toEqual([SERIES, SERIES]);
    expect(tallyOf(card.requests)).toEqual(CARD);
    expect(card.requests.some((r) => r.store === 'journalEntries' || r.store === 'journalDeclines')).toBe(false);
  });
});
