// I95.6 The request pins D9.5 moves or keeps (section 1.6: R1 to R5), counted with the disclosed request counter on the real facade.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import type { MarketDataPrepareEntry } from '../../../src/modules/market-data/index.ts';
import { countRequests, type CountedRequest } from '../../support/request-counter.ts';
import { onboardedAt, planStock, record, saveMark } from '../d7/support.ts';
import { heldTrade, MARKS, MON_1700, MONDAY, openOn } from './support.ts';

const entries = (requests: readonly CountedRequest[]) => requests.filter((r) => r.store === 'journalEntries');

// `count` stock Trades bought Monday, each with its own symbol and Monday's Mark.
async function stockBook(count: number) {
  const { app } = await onboardedAt(MON_1700);
  const tradeIds: string[] = [];
  for (const symbol of ['ABC', 'DEF', 'GHI', 'JKL'].slice(0, count)) {
    const tradeId = await planStock(app, symbol, '30.00', '28.00', '36.00', '100', '2026-10-12T13:00:00Z');
    await record(app, tradeId, { quantity: '100', price: '30.00', economicTime: '2026-10-12T14:00:00Z' });
    await saveMark(app, symbol, MONDAY, '31.00');
    tradeIds.push(tradeId);
  }
  return { app, tradeIds };
}

const openCount = (app: Application) => countRequests(() => app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MON_1700 }));

describe('I95.6 The request pins of the Review (section 1.6)', () => {
  it('should read the Journal entries once in open, the same for two Trades and for four', { timeout: 120_000 }, async () => {
    const two = await openCount((await stockBook(2)).app);
    const four = await openCount((await stockBook(4)).app);

    // Catches a read per Trade, or a second Journal entries read: one range read through the existing index.
    expect(entries(two.requests)).toEqual([{ on: 'index', store: 'journalEntries', index: 'byObligation', method: 'getAll' }]);
    expect(four.requests).toEqual(two.requests);
  });

  it('should read the Trade entries once in getTrade whatever the number of Actions', { timeout: 120_000 }, async () => {
    const none = await heldTrade(MARKS, []);
    const five = await heldTrade(MARKS, ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']);
    const cardRequests = async ({ app, tradeId }: { app: Application; tradeId: string }) => {
      const opened = await openCount(app);
      if (opened.result.kind !== 'Ready') throw new Error('open: not Ready');
      const { reviewDate, binding } = opened.result;
      return countRequests(() => app.DailyReview.getTrade({ reviewDate, tradeId, binding }));
    };

    const without = await cardRequests(none);
    const with5 = await cardRequests(five);

    // Catches a read per Action, or a read that is not through byAnchorTrade.
    expect(entries(with5.requests)).toEqual([{ on: 'index', store: 'journalEntries', index: 'byAnchorTrade', method: 'getAll' }]);
    expect(entries(without.requests)).toEqual(entries(with5.requests));
    // R5: the card's reads of Marks do not grow with the Actions either.
    expect(with5.requests.filter((r) => r.store === 'observations')).toEqual(without.requests.filter((r) => r.store === 'observations'));
  });

  it('should save a page of Marks in one snapshot and one commit whatever the number of entries', { timeout: 120_000 }, async () => {
    const save = async (symbols: readonly string[]) => {
      const { app } = await stockBookWithoutMarks();
      const opened = await openOn(app, MON_1700);
      const marks: MarketDataPrepareEntry[] = symbols.map((symbol) => ({ key: { instrumentKey: symbol, tradingDate: MONDAY }, expectedRevision: 'None', intention: { kind: 'RecordInitialManualMark', price: '31.00' } }));
      return countRequests(() => app.DailyReview.save({ kind: 'SaveReviewMarks', reviewDate: opened.reviewDate, binding: opened.binding, entries: marks }), { transactions: true });
    };
    const one = await save(['ABC']);
    const three = await save(['ABC', 'DEF', 'GHI']);

    // Catches a save that opens a snapshot or commits once per entry: the transactions are the same for one entry and for three.
    const transactions = (requests: readonly CountedRequest[]) => requests.filter((r) => r.on === 'transaction');
    expect(three.requests.filter((r) => r.store === 'observations' && r.method === 'put')).toHaveLength(3);
    expect(transactions(three.requests)).toEqual(transactions(one.requests));
    expect(three.requests.filter((r) => r.on === 'transaction' && r.method === 'readwrite' && r.store.split(',').includes('observations'))).toHaveLength(1);
  });
});

// Three stock Trades bought Monday with no Marks.
async function stockBookWithoutMarks() {
  const { app } = await onboardedAt(MON_1700);
  for (const symbol of ['ABC', 'DEF', 'GHI']) {
    const tradeId = await planStock(app, symbol, '30.00', '28.00', '36.00', '100', '2026-10-12T13:00:00Z');
    await record(app, tradeId, { quantity: '100', price: '30.00', economicTime: '2026-10-12T14:00:00Z' });
  }
  return { app };
}
