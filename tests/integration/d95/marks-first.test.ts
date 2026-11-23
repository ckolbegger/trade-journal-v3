// I95.4 No Action saves for a Trade until its Review Date Marks are saved or acknowledged Unavailable (A304, P166), through the real facade.
import { describe, expect, it } from 'vitest';
import { dumpAll } from '../d7/support.ts';
import { MON_1700, MONDAY, openOn, saveActionOn, sixTradeBook, type Book } from './support.ts';

async function holdFor(book: Book, tradeId: string) {
  const opened = await openOn(book.app, MON_1700);
  const card = await book.app.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
  if (card.kind !== 'Ready') throw new Error(`getTrade: ${card.kind}`);
  return book.app.DailyReview.save({ kind: 'SaveTradeAction', binding: card.trade.saveBinding, action: 'Hold' });
}

const JKL_KEY = { instrumentKey: 'JKL', tradingDate: MONDAY };

describe('I95.4 Actions wait for the Trade Marks (A304)', () => {
  it('should refuse an Action with ReviewMarksUnresolved naming the Instrument, and write nothing', { timeout: 120_000 }, async () => {
    const book = await sixTradeBook({ withoutMonday: ['inside'] });
    const before = await dumpAll(book.d.factory);

    const result = await holdFor(book, book.ids.inside);

    // Catches an Action saved without the Mark, or a refusal that names no Instrument.
    expect(result).toEqual({ kind: 'Rejected', issues: [{ code: 'ReviewMarksUnresolved', instruments: [{ kind: 'Stock', symbol: 'JKL' }] }] });
    expect(await dumpAll(book.d.factory)).toEqual(before);
  });

  it('should save the Action once the Mark is saved', { timeout: 120_000 }, async () => {
    const book = await sixTradeBook({ withoutMonday: ['inside'] });
    expect((await holdFor(book, book.ids.inside)).kind).toBe('Rejected');
    const opened = await openOn(book.app, MON_1700);
    await book.app.DailyReview.save({ kind: 'SaveReviewMarks', reviewDate: opened.reviewDate, binding: opened.binding, entries: [{ key: JKL_KEY, expectedRevision: 'None', intention: { kind: 'RecordInitialManualMark', price: '20.50' } }] });

    expect((await holdFor(book, book.ids.inside)).kind).toBe('Saved');
  });

  it('should save the Action once the Mark is acknowledged Unavailable', { timeout: 120_000 }, async () => {
    const book = await sixTradeBook({ withoutMonday: ['inside'] });
    const opened = await openOn(book.app, MON_1700);
    await book.app.DailyReview.save({ kind: 'SaveReviewMarks', reviewDate: opened.reviewDate, binding: opened.binding, entries: [{ key: JKL_KEY, expectedRevision: 'None', intention: { kind: 'AssertUnavailable', reason: 'No quote today.' } }] });

    expect((await holdFor(book, book.ids.inside)).kind).toBe('Saved');
  });

  it('should not ask for an earlier session Mark', { timeout: 120_000 }, async () => {
    const book = await sixTradeBook();
    // MNO was bought Thursday and has Marks for Friday and Monday only: Thursday's is a gap that blocks nothing.
    expect((await saveActionOn(book.app, MON_1700, book.ids.exit, 'Hold')).kind).toBe('Saved');
  });
});
