// I9R2.2 One SaveReviewMarks across Trades, sessions and Instruments (AC-RESP-001, ADR 0011), through the real facade on fake-indexeddb.
// R-CORV-D and R-DALE-D, Marks through Fri 11-13, DALE's put Mark left out on Mon 11-09: Missing are CORV's put on Tue 11-10, DALE's put on
// Mon 11-09, and each put (and Underlying) on the Review Date Mon 11-16.
import { describe, expect, it } from 'vitest';
import { instrumentKey } from '../../../src/domain/instrument/index.ts';
import { CORV_PUT, DALE_PUT, R_CORV_D, R_DALE_D } from '../../../src/domain/trade-analysis/option-trade.ts';
import { countRequests } from '../../support/request-counter.ts';
import { initialMark, MON_1116_1700, marksFamily, openReady, REVIEW_DATE, saveMarks, seriesBook } from './support.ts';

const CORV_PUT_KEY = instrumentKey(CORV_PUT);
const DALE_PUT_KEY = instrumentKey(DALE_PUT);

const book = () =>
  seriesBook(MON_1116_1700, [
    [R_CORV_D, 'strategy.long-put', { marksThrough: 9 }],
    [R_DALE_D, 'strategy.cash-secured-put', { marksThrough: 9, skipHeldOn: ['2026-11-09'] }],
  ]);

// The Marks family as the open reads it: what is still Missing, today and earlier, and the Marks listed.
const standing = async (app: Awaited<ReturnType<typeof book>>['app']) => {
  const family = marksFamily(await openReady(app));
  return { today: family.today, earlier: family.earlier, earlierMarks: family.earlierMarks };
};

describe('I9R2.2 One Save Marks across Trades, sessions and Instruments (AC-RESP-001, ADR 0011)', () => {
  it('I9R2.2 should commit entries across two Trades, three sessions and two Instruments once and return the refreshed Review with every key saved', { timeout: 120_000 }, async () => {
    const { app, tradeIds } = await book();
    const entries = [
      initialMark(CORV_PUT_KEY, '2026-11-10', '4.80'),
      initialMark(CORV_PUT_KEY, REVIEW_DATE, '5.90'),
      initialMark(DALE_PUT_KEY, '2026-11-09', '2.30'),
      initialMark(DALE_PUT_KEY, REVIEW_DATE, '4.60'),
    ];
    const opened = await openReady(app);

    const saved = await countRequests(
      () => app.DailyReview.save({ kind: 'SaveReviewMarks', reviewDate: opened.reviewDate, tradeId: tradeIds[0]!, binding: opened.binding, entries }),
      { transactions: true },
    );

    if (saved.result.kind !== 'MarksSaved') throw new Error(`expected MarksSaved, got ${JSON.stringify(saved.result).slice(0, 300)}`);
    // Catches a save that writes in more than one commit (or none): one read-write transaction on observations, one put per entry.
    const commits = saved.requests.filter((r) => r.on === 'transaction' && r.method === 'readwrite' && r.store.split(',').includes('observations'));
    expect(commits).toHaveLength(1);
    expect(saved.requests.filter((r) => r.store === 'observations' && r.method === 'put')).toHaveLength(entries.length);
    // Catches a key left out of, or added to, the response.
    expect(saved.result.marks.map((m) => [m.key.instrumentKey, m.key.tradingDate]).sort()).toEqual(entries.map((e) => [e.key.instrumentKey, e.key.tradingDate]).sort());
    expect(saved.result.marks.every((m) => m.resolution.kind === 'Available' && m.resolutionRevision === 1)).toBe(true);
    // Catches a response that is not the refreshed Review (the Review the screen renders without a readback, AC-RESP-001): the card of the request's Trade.
    expect(saved.result.review.kind).toBe('Ready');
    if (saved.result.review.kind === 'Ready') expect(saved.result.review.trade.tradeId).toBe(tradeIds[0]);
    // Catches entries that were reported but not stored: the next open has none of them Missing.
    const after = await standing(app);
    expect(after.earlier).toEqual([]);
    expect(after.today.filter((row) => [CORV_PUT_KEY, DALE_PUT_KEY].includes(row.instrumentKey)).map((row) => row.resolution.kind)).toEqual(['Available', 'Available']);
  });

  it('I9R2.2 should save nothing when one binding among the entries is stale', { timeout: 120_000 }, async () => {
    const { app, tradeIds } = await book();
    const before = await standing(app);
    // CORV's Mark on 11-10 exists (revision 1): a first-Mark entry binding 'None' is stale (ADR 0011).
    const result = await saveMarks(app, tradeIds[0]!, [
      initialMark(CORV_PUT_KEY, '2026-11-10', '4.80'),
      initialMark('CORV', '2026-11-10', '76.00'),
      initialMark(DALE_PUT_KEY, '2026-11-09', '2.30'),
    ]);

    // Catches a partial save, or a stale key that is not named.
    expect(result).toMatchObject({ kind: 'Conflict', keys: [expect.objectContaining({ key: { instrumentKey: 'CORV', tradingDate: '2026-11-10' }, code: 'StaleRevision' })] });
    expect(await standing(app)).toEqual(before);
  });

  it('I9R2.2 should refuse 101 entries with TooManyEntries and write nothing', { timeout: 120_000 }, async () => {
    const { app, tradeIds } = await book();
    const before = await standing(app);
    const dates = Array.from({ length: 101 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10));

    const result = await saveMarks(app, tradeIds[0]!, dates.map((date) => initialMark(CORV_PUT_KEY, date, '1.00')));

    // Catches a limit that is off by one or missing: 101 is refused as a whole.
    expect(result).toEqual({ kind: 'Rejected', issues: [{ field: 'entries', code: 'TooManyEntries' }] });
    expect(await standing(app)).toEqual(before);
  });
});
