// D9R2's Node suite fixtures: D9's facade-built test Trades (tests/support/replay-series-app.ts), a stock Trade cloned from R-AXIO-U onto
// another symbol and opening date, and the Review's Marks family and save entries as plain helpers. Facade operations only.
import type { Application } from '../../../src/app/compose.ts';
import type { MarketDataPrepareEntry } from '../../../src/modules/market-data/index.ts';
import { R_AXIO_U, type ReplayTestSeries } from '../../../src/domain/trade-analysis/reference-trade.ts';
import { R_CORV_D } from '../../../src/domain/trade-analysis/option-trade.ts';
import type { SeriesBook } from '../../support/replay-series-app.ts';
import { MON_1116_1700, seriesApp, seriesBook } from '../d9/support.ts';

export { MON_1116_1700, seriesApp, seriesBook };

export const REVIEW_DATE = '2026-11-16';

// R-AXIO-U's stock Trade on another symbol, its first (only) Position Change on `opened`. Use it with marksThrough -1 (no Marks of its
// own) and `without: (id) => id === 'pc-axio-2'`, so the Trade holds the symbol from `opened` alone.
export function stockSeries(symbol: string, opened: string): ReplayTestSeries {
  const text = JSON.stringify(R_AXIO_U).replaceAll('AXIO', symbol).replaceAll('2026-11-02', opened).replaceAll('2026-11-06', opened);
  return JSON.parse(text) as ReplayTestSeries;
}
export const OPENED_ONLY = { marksThrough: -1, without: (id: string) => id === 'pc-axio-2' } as const;

// An Instrument held by two Trades (R-CORV-D's put Trade, and a CORV stock Trade opened Thu 11-12), a Trade on NEWX opened on the
// Review Date Mon 11-16, and R-CORV-D's mixed earlier sessions: Tue 11-10 has a CORV Mark and no put Mark.
export async function sharedBook(): Promise<SeriesBook> {
  return seriesBook(MON_1116_1700, [
    [R_CORV_D, 'strategy.long-put', { marksThrough: 9 }],
    [stockSeries('CORV', '2026-11-12'), 'strategy.long-stock', OPENED_ONLY],
    [stockSeries('NEWX', REVIEW_DATE), 'strategy.long-stock', OPENED_ONLY],
  ]);
}

export async function openReady(app: Application) {
  const opened = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MON_1116_1700 });
  if (opened.kind !== 'Ready') throw new Error(`open: ${opened.kind}`);
  return opened;
}

export function marksFamily(opened: Awaited<ReturnType<typeof openReady>>) {
  const family = opened.families.find((f) => f.family === 'Marks');
  if (family?.family !== 'Marks') throw new Error('no Marks family');
  return family;
}

export const initialMark = (instrumentKey: string, tradingDate: string, price: string): MarketDataPrepareEntry => ({
  key: { instrumentKey, tradingDate },
  expectedRevision: 'None',
  intention: { kind: 'RecordInitialManualMark', price },
});

export const correctMark = (instrumentKey: string, tradingDate: string, price: string, expectedRevision: number): MarketDataPrepareEntry => ({
  key: { instrumentKey, tradingDate },
  expectedRevision,
  intention: { kind: 'CorrectMark', price, reason: 'Misread the quote' },
});

// `SaveReviewMarks` against a fresh open's binding.
export async function saveMarks(app: Application, tradeId: string, entries: readonly MarketDataPrepareEntry[]) {
  const opened = await openReady(app);
  return app.DailyReview.save({ kind: 'SaveReviewMarks', reviewDate: opened.reviewDate, tradeId, binding: opened.binding, entries });
}
