// I95.16-D1 The card's Plan terms (P177, decision 130): the same Thesis and "No longer valid if" Trade Detail shows, at no extra store request.
// R-BREN-U open at Mon 11-16 17:00 with Marks through that day; each read on a fresh launch, counted with the disclosed request counter.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { R_BREN_U } from '../../../src/domain/trade-analysis/option-trade.ts';
import { countRequests, type CountedRequest } from '../../support/request-counter.ts';
import { restart } from '../d7s/support.ts';
import { MON_1116_1700, seriesApp } from '../d9ar/support.ts';

type Tally = Record<string, number>;
const tallyOf = (requests: readonly CountedRequest[]): Tally => {
  const tally: Tally = {};
  for (const r of requests) tally[`${r.store}.${r.method}`] = (tally[`${r.store}.${r.method}`] ?? 0) + 1;
  return tally;
};

// getTrade's counts as I9AR.4 pins them, unchanged by the Plan terms.
const CARD = { 'catalog.getAll': 1, 'journalDebts.getAll': 1, 'journalDefinitions.getAll': 2, 'journalEntries.getAll': 1, 'journalObligations.getAll': 1, 'journalTypes.getAll': 1, 'meta.get': 17, 'observations.getAll': 3, 'trades.getAll': 2 };

async function cardOf(app: Application, tradeId: string) {
  const opened = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MON_1116_1700 });
  if (opened.kind !== 'Ready') throw new Error(`open: ${opened.kind}`);
  return countRequests(() => app.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding }));
}

describe('I95.16-D1 The Review card carries the Plan terms', () => {
  it('should give the same Thesis and No longer valid if text Trade Detail shows', { timeout: 120_000 }, async () => {
    const { d, app, tradeId } = await seriesApp(R_BREN_U, 'strategy.long-call', MON_1116_1700, { marksThrough: 10 });
    const detailApp = await restart(app, d);
    const detail = await detailApp.TradeViewsAndReporting.getTradeDetail({ tradeId });
    if (detail.kind !== 'Ready') throw new Error(`getTradeDetail: ${detail.kind}`);
    const card = await cardOf(await restart(detailApp, d), tradeId);
    if (card.result.kind !== 'Ready') throw new Error(`getTrade: ${card.result.kind}`);

    expect(detail.view.plan.thesis).not.toBe('');
    expect(card.result.trade.plan).toEqual({ thesis: detail.view.plan.thesis, invalidation: detail.view.plan.invalidation });
  });

  it('should keep getTrade at its request counts with the Plan terms', { timeout: 120_000 }, async () => {
    const { d, app, tradeId } = await seriesApp(R_BREN_U, 'strategy.long-call', MON_1116_1700, { marksThrough: 10 });
    const card = await cardOf(await restart(app, d), tradeId);
    if (card.result.kind !== 'Ready') throw new Error(`getTrade: ${card.result.kind}`);

    expect(card.result.trade.plan?.thesis).toBeTruthy();
    expect(tallyOf(card.requests)).toEqual(CARD);
  });
});
