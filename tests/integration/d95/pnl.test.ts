// I95.16-D2 The walked Trade's P&L (P178, decision 131): dollars, R and change at no extra store request.
// R-BREN-U open at Mon 11-16 17:00 with Marks through that day; open on a fresh launch, counted with the disclosed request counter.
import { describe, expect, it } from 'vitest';
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

// open's counts as I9AR.4 pins them, unchanged by the P&L.
const OPEN = { 'journalDebts.getAll': 1, 'journalDefinitions.getAll': 1, 'journalEntries.getAll': 1, 'journalObligations.getAll': 1, 'journalTypes.getAll': 1, 'meta.get': 14, 'observations.getAll': 4, 'trades.getAll': 2 };

describe('I95.16-D2 The walked Trade carries its P&L', () => {
  it('should keep open at its request counts with the P&L', { timeout: 120_000 }, async () => {
    const { d, app, tradeId } = await seriesApp(R_BREN_U, 'strategy.long-call', MON_1116_1700, { marksThrough: 10 });
    const fresh = await restart(app, d);

    const { result, requests } = await countRequests(() => fresh.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MON_1116_1700 }));

    if (result.kind !== 'Ready') throw new Error(`open: ${result.kind}`);
    const trades = result.families.find((f) => f.family === 'Trades');
    if (!trades) throw new Error('no Trades family');
    expect(trades.trades.find((t) => t.tradeId === tradeId)?.pnl?.change.kind).toBe('Value');
    expect(tallyOf(requests)).toEqual(OPEN);
  });
});
