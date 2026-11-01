// I5R.2: a Marks save writes every Mark or none (P37, A155, AC-RESP-001). An invalid entry, a fault inside the
// commit, and a stale second command each leave the stored records as they were, and a retry or one revision per
// key shows the first commit was whole.
import { IDBObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dumpAll, MONDAY, openReview, workspaceStores, type StoredObservation } from '../d5/support.ts';
import { cardApp, initialMark, marksSaved, saveMarksFrom } from './support.ts';

afterEach(() => vi.restoreAllMocks());

// Four entries on four keys, from T-A's card: three valid and one price that is not a number (entry index 1).
const fourEntries = (price: string) => [
  initialMark('ABC', MONDAY, '27.50'),
  initialMark('DEF', MONDAY, price),
  initialMark('JKL', MONDAY, '21.00'),
  initialMark('XYZ', MONDAY, '52.00'),
];

describe('I5R.2 Nothing or everything', () => {
  it('should reject a command with one invalid price among four entries, naming that entry, and leave the dump unchanged', async () => {
    const { d, app, trades } = await cardApp({ withMarks: false });
    const before = await dumpAll(d.factory);

    const result = await saveMarksFrom(app, d, trades.a, fourEntries('not a price'));

    expect(result.kind).toBe('Rejected');
    const issues = result.kind === 'Rejected' ? result.issues : [];
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.map((issue) => ('entryIndex' in issue ? [issue.entryIndex, issue.field] : null))).toEqual(issues.map(() => [1, 'price']));
    expect(await dumpAll(d.factory)).toEqual(before);
  }, 60_000);

  it('should abort the transaction when a fault follows the first observations write, leave the dump unchanged, and succeed on a retry', async () => {
    const { d, app, trades } = await cardApp({ withMarks: false });
    const before = await dumpAll(d.factory);

    // The fault: the second write to `observations` is issued as an `add` of the first write's record, which the store
    // refuses with a ConstraintError after the first write was accepted; the failed request aborts the transaction.
    // eslint-disable-next-line @typescript-eslint/unbound-method -- called back with the store as `this` below
    const put = IDBObjectStore.prototype.put;
    let observationWrites = 0;
    let firstValue: unknown;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
      if (this.name !== 'observations') return put.apply(this, args);
      if (++observationWrites === 1) firstValue = args[0];
      return observationWrites === 2 ? this.add(firstValue) : put.apply(this, args);
    });
    const failed = await saveMarksFrom(app, d, trades.a, fourEntries('40.50'));

    expect(observationWrites).toBeGreaterThanOrEqual(2);
    expect(failed).toEqual(expect.objectContaining({ kind: 'StorageFailure' }));
    expect(await dumpAll(d.factory)).toEqual(before);

    vi.restoreAllMocks();
    const retried = marksSaved(await saveMarksFrom(app, d, trades.a, fourEntries('40.50')));
    expect(retried.marks).toHaveLength(4);
    const stored = workspaceStores(await dumpAll(d.factory))['observations'] as StoredObservation[];
    expect(stored.map((o) => o.instrumentKey).sort()).toEqual(['ABC', 'DEF', 'JKL', 'XYZ']);
    expect(stored.map((o) => o.resolutionRevision)).toEqual([1, 1, 1, 1]);
  }, 60_000);

  it('should return Conflict naming every key for a second command from the same binding, and keep one revision per key', async () => {
    const { d, app, trades } = await cardApp({ withMarks: false });
    const opened = await openReview(app, d);
    const command = { kind: 'SaveReviewMarks', reviewDate: opened.reviewDate, tradeId: trades.a, binding: opened.binding, entries: fourEntries('40.50') } as const;

    expect(marksSaved(await app.DailyReview.save(command)).marks).toHaveLength(4);
    const afterFirst = await dumpAll(d.factory);
    const second = await app.DailyReview.save(command);

    expect(second.kind).toBe('Conflict');
    const keys = second.kind === 'Conflict' ? (second.keys ?? []) : [];
    expect(keys.map((k) => k.key.instrumentKey).sort()).toEqual(['ABC', 'DEF', 'JKL', 'XYZ']);
    expect(await dumpAll(d.factory)).toEqual(afterFirst);
    const stored = workspaceStores(afterFirst)['observations'] as StoredObservation[];
    expect(stored.map((o) => [o.instrumentKey, o.resolutionRevision, o.marks.length])).toEqual(['ABC', 'DEF', 'JKL', 'XYZ'].map((k) => [k, 1, 1]));
  }, 60_000);
});
