// The D5R Node application-stack suite (plan section 6.1): the real facade on fake-indexeddb, as D5's suite,
// with no substitutes of D5R's own (section 6.0). The card fixture (breakdown section 4) is built here through
// facade operations only: D4's five Trades without T-D, a second XYZ Trade (T-F), T-A's first Position Change on
// Friday, and T-A's two Position Changes deferred (D-1 due Monday, D-2 due in the next Review).
import type { Application } from '../../../src/app/compose.ts';
import type { MarketDataPrepareEntry } from '../../../src/modules/market-data/index.ts';
import { device, MONDAY, MONDAY_1700, onboarded, openReview, PC1_TIME, PC2, planStock, record, recordDeferred, saveMark, type Device } from '../d5/support.ts';

export * from '../d5/support.ts';

export const FRIDAY_DATE = '2026-10-09';
const FRIDAY_PLAN_TIME = '2026-10-09T13:00:00Z';
const FRIDAY_1000 = '2026-10-09T14:00:00Z';
const MONDAY_1030 = '2026-10-12T14:30:00Z';

export interface CardTrades {
  readonly a: string;
  readonly b: string;
  readonly c: string;
  readonly e: string;
  readonly f: string;
}

// The card fixture on a fresh device at Monday 17:00. `withMarks` saves the Monday Marks for XYZ, ABC and JKL
// (DEF never has one), through `MarketData.save` before any Review exists.
export async function cardApp(options: { readonly withMarks: boolean }): Promise<{ d: Device; app: Application; trades: CardTrades }> {
  const d = await device(undefined, MONDAY_1700);
  const app = await onboarded(d);
  const a = await planStock(app, 'XYZ', '50.00', '47.50', '56.00', '100', FRIDAY_PLAN_TIME);
  await recordDeferred(app, a, { quantity: '60', price: '50.10', economicTime: FRIDAY_1000 });
  await recordDeferred(app, a, PC2);
  const single = async (symbol: string, entry: string, stop: string, target: string) => {
    const tradeId = await planStock(app, symbol, entry, stop, target);
    await record(app, tradeId, { quantity: '100', price: entry, economicTime: PC1_TIME });
    return tradeId;
  };
  const b = await single('ABC', '30.00', '28.00', '36.00');
  const c = await single('DEF', '40.00', '38.00', '46.00');
  const e = await single('JKL', '20.00', '19.00', '30.00');
  const f = await planStock(app, 'XYZ', '50.00', '48.00', '55.00', '50');
  await record(app, f, { quantity: '50', price: '50.00', economicTime: MONDAY_1030 });
  if (options.withMarks) {
    await saveMark(app, 'XYZ', MONDAY, '52.00');
    await saveMark(app, 'ABC', MONDAY, '27.50');
    await saveMark(app, 'JKL', MONDAY, '21.00');
  }
  return { d, app, trades: { a, b, c, e, f } };
}

export const initialMark = (instrumentKey: string, tradingDate: string, price: string): MarketDataPrepareEntry => ({
  key: { instrumentKey, tradingDate },
  expectedRevision: 'None',
  intention: { kind: 'RecordInitialManualMark', price },
});

export const unavailable = (instrumentKey: string, tradingDate: string, reason: string): MarketDataPrepareEntry => ({
  key: { instrumentKey, tradingDate },
  expectedRevision: 'None',
  intention: { kind: 'AssertUnavailable', reason },
});

export function marksSaved<T extends { readonly kind: string }>(result: T): Extract<T, { kind: 'MarksSaved' }> {
  if (result.kind !== 'MarksSaved') throw new Error(`expected MarksSaved, got ${JSON.stringify(result)}`);
  return result as Extract<T, { kind: 'MarksSaved' }>;
}

// `SaveReviewMarks` from one card, against a fresh `open`'s binding.
export async function saveMarksFrom(app: Application, d: Device, tradeId: string, entries: readonly MarketDataPrepareEntry[]) {
  const opened = await openReview(app, d);
  return app.DailyReview.save({ kind: 'SaveReviewMarks', reviewDate: opened.reviewDate, tradeId, binding: opened.binding, entries });
}
