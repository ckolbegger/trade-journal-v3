// I95.3 SaveReviewMarks for the whole page (A303, AC-RESP-001, AC-MARK-003, AC-MARK-004, AC-REV-005), through the real facade.
import { describe, expect, it } from 'vitest';
import type { MarketDataPrepareEntry } from '../../../src/modules/market-data/index.ts';
import { countRequests } from '../../support/request-counter.ts';
import { dumpAll } from '../d7/support.ts';
import { FRIDAY, MON_1700, MONDAY, openOn, saveMark, sixTradeBook, walkOf, type Book } from './support.ts';

const initial = (instrumentKey: string, tradingDate: string, price: string): MarketDataPrepareEntry => ({ key: { instrumentKey, tradingDate }, expectedRevision: 'None', intention: { kind: 'RecordInitialManualMark', price } });

async function savePage(book: Book, entries: readonly MarketDataPrepareEntry[]) {
  const opened = await openOn(book.app, MON_1700);
  return book.app.DailyReview.save({ kind: 'SaveReviewMarks', reviewDate: opened.reviewDate, binding: opened.binding, entries });
}

describe('I95.3 One page save of Marks (A303)', () => {
  it('should commit a save across three Trades once and return the refreshed Review', { timeout: 120_000 }, async () => {
    const book = await sixTradeBook({ withoutMonday: ['shallow', 'deep', 'target'] });
    const entries = [initial('ABC', MONDAY, '25.00'), initial('DEF', MONDAY, '47.00'), initial('GHI', MONDAY, '56.50')];

    const saved = await countRequests(() => savePage(book, entries), { transactions: true });

    if (saved.result.kind !== 'MarksSaved' || saved.result.review.kind !== 'Ready') throw new Error(`save: ${saved.result.kind}`);
    // Catches a save that writes in more than one commit: one read-write transaction on observations, one put an entry.
    expect(saved.requests.filter((r) => r.on === 'transaction' && r.method === 'readwrite' && r.store.split(',').includes('observations'))).toHaveLength(1);
    expect(saved.requests.filter((r) => r.store === 'observations' && r.method === 'put')).toHaveLength(3);
    // Catches a response that is not the refreshed Review: no Mark to go, the three Trades in their new bands, equal to the next open.
    expect(saved.result.marks.map((m) => m.key.instrumentKey).sort()).toEqual(['ABC', 'DEF', 'GHI']);
    expect(saved.result.review.day?.toGo.marks).toBe(0);
    const bands = Object.fromEntries(saved.result.review.trades.map((t) => [t.tradeId, t.band]));
    expect([bands[book.ids.shallow], bands[book.ids.deep], bands[book.ids.target]]).toEqual(['StopReached', 'StopReached', 'TargetReached']);
    expect(saved.result.review.trades.map((t) => t.tradeId)).toEqual(walkOf(await openOn(book.app, MON_1700)).map((t) => t.tradeId));
  });

  it('should fix a typed Review Date Mark with the stored reason Fixed in the same Review', { timeout: 120_000 }, async () => {
    const book = await sixTradeBook();

    // The grid sends no reason of its own for a fix.
    const saved = await savePage(book, [{ key: { instrumentKey: 'JKL', tradingDate: MONDAY }, expectedRevision: 1, intention: { kind: 'CorrectMark', price: '20.60', reason: '' } }]);

    if (saved.kind !== 'MarksSaved') throw new Error(`save: ${saved.kind}`);
    expect(saved.marks[0]!.classification).toBe('Correction');
    const frames = await book.app.MarketData.query({ kind: 'ResolveFrames', context: { kind: 'Review', reviewDate: MONDAY }, instruments: ['JKL'] });
    expect(frames.kind === 'Frames' && frames.frames[0]!.resolution).toMatchObject({ kind: 'Available', mark: { price: '20.6', correctionReason: 'Fixed in the same Review' } });
  });

  it('should still need a reason to correct an earlier session', { timeout: 120_000 }, async () => {
    const book = await sixTradeBook();
    const before = await dumpAll(book.d.factory);

    // MNO's Friday Mark is typed, and so is its Monday one: only the date tells the fix from the correction.
    const result = await savePage(book, [{ key: { instrumentKey: 'MNO', tradingDate: FRIDAY }, expectedRevision: 1, intention: { kind: 'CorrectMark', price: '41.50', reason: '' } }]);

    expect(result).toMatchObject({ kind: 'Rejected', issues: [expect.objectContaining({ field: 'reason', code: 'ReasonRequired' })] });
    expect(await dumpAll(book.d.factory)).toEqual(before);
  });

  it('should never make an acknowledgment a price and leave a gap a gap', { timeout: 120_000 }, async () => {
    const book = await sixTradeBook({ withoutMonday: ['inside'] });
    const before = await openOn(book.app, MON_1700);
    const earlierBefore = before.families.find((f) => f.family === 'Marks');

    const acknowledged = await savePage(book, [{ key: { instrumentKey: 'JKL', tradingDate: MONDAY }, expectedRevision: 'None', intention: { kind: 'AssertUnavailable', reason: 'No quote today.' } }]);

    if (acknowledged.kind !== 'MarksSaved') throw new Error(`save: ${JSON.stringify(acknowledged).slice(0, 300)}`);
    const opened = await openOn(book.app, MON_1700);
    const marks = opened.families.find((f) => f.family === 'Marks');
    if (marks?.family !== 'Marks' || earlierBefore?.family !== 'Marks') throw new Error('no Marks family');
    // Catches an acknowledgment that stores a price: the key reads Acknowledged and the Trade's P&L stays Unavailable.
    expect(marks.today.find((row) => row.instrumentKey === 'JKL')?.resolution.kind).toBe('AcknowledgedUnavailable');
    expect(walkOf(opened).find((t) => t.tradeId === book.ids.inside)?.pnl?.dollars.kind).toBe('Unavailable');
    // Catches an acknowledgment that fills an earlier session: the sessions before the Review Date are as they were.
    expect(marks.earlier).toEqual(earlierBefore.earlier);

    // An exact Mark arriving later makes the key Available and the figure a value; the acknowledgment's history stays on the record.
    const row = marks.today.find((r) => r.instrumentKey === 'JKL')!;
    const exact = await savePage(book, [{ key: { instrumentKey: 'JKL', tradingDate: MONDAY }, expectedRevision: row.resolutionRevision, intention: { kind: 'RecordInitialManualMark', price: '20.50' } }]);
    expect(exact.kind).toBe('MarksSaved');
    const later = await openOn(book.app, MON_1700);
    expect(walkOf(later).find((t) => t.tradeId === book.ids.inside)?.pnl?.dollars.kind).toBe('Value');
  });

  it('should save nothing when the Workspace binding or one entry binding is stale', { timeout: 120_000 }, async () => {
    const book = await sixTradeBook({ withoutMonday: ['shallow'] });
    const opened = await openOn(book.app, MON_1700);
    await saveMark(book.app, 'ABC', MONDAY, '25.00');
    const before = await dumpAll(book.d.factory);

    // The Review's binding names another Workspace database: only that binding is compared, and no entry is written.
    const other = { ...opened.binding, workspace: { ...opened.binding.workspace, databaseName: 'tj-ws-other' } };
    const changed = await book.app.DailyReview.save({ kind: 'SaveReviewMarks', reviewDate: opened.reviewDate, binding: other, entries: [initial('GHI', FRIDAY, '55.00')] });
    expect(changed.kind).toBe('ReviewChanged');
    expect(await dumpAll(book.d.factory)).toEqual(before);

    // A fresh Review, but ABC's Mark is at revision 1 and the entry binds it as None: nothing beside it is written either.
    const conflict = await savePage(book, [initial('GHI', FRIDAY, '55.00'), initial('ABC', MONDAY, '26.00')]);
    expect(conflict).toMatchObject({ kind: 'Conflict', keys: [expect.objectContaining({ key: { instrumentKey: 'ABC', tradingDate: MONDAY }, code: 'StaleRevision' })] });
    expect(await dumpAll(book.d.factory)).toEqual(before);
  });

  it('should refuse 101 entries with TooManyEntries and write nothing', { timeout: 120_000 }, async () => {
    const book = await sixTradeBook();
    const before = await dumpAll(book.d.factory);
    const dates = Array.from({ length: 101 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10));

    const result = await savePage(book, dates.map((date) => initial('ABC', date, '1.00')));

    expect(result).toEqual({ kind: 'Rejected', issues: [{ field: 'entries', code: 'TooManyEntries' }] });
    expect(await dumpAll(book.d.factory)).toEqual(before);
  });
});
