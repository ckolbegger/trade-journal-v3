// I9AR.4 Query counts (AC-PERF-001, cumulative): R-BREN-U open at Mon 11-16 17:00 with Marks through that day. The store requests of
// replayTrade, DailyReview.getTrade and DailyReview.open each equal I9.6's count: the new figures (the odds, the Plan's terms, each fill's
// line, the crossings) read nothing. Counted with the real facade on fake-indexeddb wrapped in the disclosed request counter, each read on
// a fresh launch so no read warms another.
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

// I9.6's counts (tests/integration/d9/query-count.test.ts), unchanged by D9A-R.
const REPLAY = { 'journalDebts.getAll': 1, 'journalDeclines.getAll': 1, 'journalDefinitions.getAll': 1, 'journalEntries.getAll': 1, 'journalTypes.getAll': 1, 'meta.get': 8, 'observations.getAll': 3, 'trades.get': 1 };
const OPEN = { 'journalDebts.getAll': 1, 'journalDefinitions.getAll': 1, 'journalEntries.getAll': 1, 'journalObligations.getAll': 1, 'journalTypes.getAll': 1, 'meta.get': 14, 'observations.getAll': 4, 'trades.getAll': 2 };
const CARD = { 'catalog.getAll': 1, 'journalDebts.getAll': 1, 'journalDefinitions.getAll': 2, 'journalObligations.getAll': 1, 'journalTypes.getAll': 1, 'meta.get': 17, 'observations.getAll': 3, 'trades.getAll': 2 };

describe('I9AR.4 Query counts (AC-PERF-001, cumulative)', () => {
  it('I9AR.4 should keep replayTrade, getTrade and open at the counts of I9.6', { timeout: 120_000 }, async () => {
    const { d, app, tradeId } = await seriesApp(R_BREN_U, 'strategy.long-call', MON_1116_1700, { marksThrough: 10 });
    const fresh = async (current: Application) => restart(current, d);

    const detailApp = await fresh(app);
    const detail = await detailApp.TradeViewsAndReporting.getTradeDetail({ tradeId });
    if (detail.kind !== 'Ready') throw new Error(`getTradeDetail: ${detail.kind}`);
    const replayApp = await fresh(detailApp);
    const replay = await countRequests(() => replayApp.TradeViewsAndReporting.replayTrade({ tradeId, binding: detail.binding }));
    if (replay.result.kind !== 'Ready' || !('sessions' in replay.result.view)) throw new Error(`replayTrade: ${replay.result.kind}`);
    // The new fields are there, and they cost no request.
    expect(replay.result.view.planColumn?.terms).toBeDefined();
    expect(replay.result.view.planColumn?.odds).toBeDefined();
    expect(replay.result.view.sessions.at(-1)?.crossings).toBeDefined();
    expect(tallyOf(replay.requests)).toEqual(REPLAY);

    const openApp = await fresh(replayApp);
    const open = await countRequests(() => openApp.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MON_1116_1700 }));
    if (open.result.kind !== 'Ready') throw new Error(`open: ${open.result.kind}`);
    expect(tallyOf(open.requests)).toEqual(OPEN);

    const cardApp = await fresh(openApp);
    const opened = await cardApp.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MON_1116_1700 });
    if (opened.kind !== 'Ready') throw new Error(`open: ${opened.kind}`);
    const card = await countRequests(() => cardApp.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding }));
    if (card.result.kind !== 'Ready') throw new Error(`getTrade: ${card.result.kind}`);
    expect(card.result.trade.evaluation?.rewardRiskOdds).toBeDefined();
    expect(card.result.trade.replay?.planColumn?.terms).toBeDefined();
    expect(tallyOf(card.requests)).toEqual(CARD);
  });
});
