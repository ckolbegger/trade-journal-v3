// I95.17-D1 The card's contract expiration and dated meter (decision 131): at no extra store request.
// R-BREN-U open at Mon 11-16 17:00 with Marks through that day; getTrade on a fresh launch, counted with the disclosed request counter.
import { describe, expect, it } from 'vitest';
import { BREN_CALL, R_BREN_U } from '../../../src/domain/trade-analysis/option-trade.ts';
import { countRequests, type CountedRequest } from '../../support/request-counter.ts';
import { restart } from '../d7s/support.ts';
import { MON_1116_1700, seriesApp } from '../d9ar/support.ts';

type Tally = Record<string, number>;
const tallyOf = (requests: readonly CountedRequest[]): Tally => {
  const tally: Tally = {};
  for (const r of requests) tally[`${r.store}.${r.method}`] = (tally[`${r.store}.${r.method}`] ?? 0) + 1;
  return tally;
};

// getTrade's counts as I9AR.4 pins them, unchanged by the expiration.
const CARD = { 'catalog.getAll': 1, 'journalDebts.getAll': 1, 'journalDefinitions.getAll': 2, 'journalEntries.getAll': 1, 'journalObligations.getAll': 1, 'journalTypes.getAll': 1, 'meta.get': 17, 'observations.getAll': 3, 'trades.getAll': 2 };

describe('I95.17-D1 The Review card carries its contract expiration', () => {
  it('should keep getTrade at its request counts with the expiration', { timeout: 120_000 }, async () => {
    const { d, app, tradeId } = await seriesApp(R_BREN_U, 'strategy.long-call', MON_1116_1700, { marksThrough: 10 });
    const fresh = await restart(app, d);
    const opened = await fresh.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MON_1116_1700 });
    if (opened.kind !== 'Ready') throw new Error(`open: ${opened.kind}`);

    const card = await countRequests(() => fresh.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding }));

    if (card.result.kind !== 'Ready') throw new Error(`getTrade: ${card.result.kind}`);
    expect(card.result.trade.expiration?.date).toBe(BREN_CALL.expiration);
    expect(tallyOf(card.requests)).toEqual(CARD);
  });
});
