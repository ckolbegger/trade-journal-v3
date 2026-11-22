import { describe, expect, it } from 'vitest';
import { dumpAll } from '../../../tests/support/stack.ts';
import { cardFixture, FRIDAY_DATE, MONDAY_1700, REVIEW_DATE, reviewStack, type ReviewStack } from '../../../tests/support/review-fixture.ts';
import type { MarketDataPrepareEntry } from '../../modules/market-data/index.ts';
import { createDailyReview } from './index.ts';
import type { SaveReviewMarksResult } from './index.ts';

// T95.6: SaveReviewMarks for the whole page (A303): no Trade is named, any Instrument and session the page shows may be saved.

const initial = (instrumentKey: string, tradingDate: string, price: string): MarketDataPrepareEntry => ({
  key: { instrumentKey, tradingDate },
  expectedRevision: 'None',
  intention: { kind: 'RecordInitialManualMark', price },
});

async function openPage(stack: ReviewStack) {
  const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
  if (opened.kind !== 'Ready') throw new Error(`expected Ready, got ${opened.kind}`);
  const walk = opened.families.find((family) => family.family === 'Trades');
  return { reviewDate: opened.reviewDate, binding: opened.binding, order: walk?.family === 'Trades' ? walk.trades.map((t) => t.tradeId) : [] };
}

async function savePage(stack: ReviewStack, entries: readonly MarketDataPrepareEntry[]): Promise<SaveReviewMarksResult> {
  const { reviewDate, binding } = await openPage(stack);
  return stack.dailyReview.save({ kind: 'SaveReviewMarks', reviewDate, binding, entries });
}

function ready(result: SaveReviewMarksResult) {
  if (result.kind !== 'MarksSaved') throw new Error(`expected MarksSaved, got ${result.kind}`);
  if (result.review.kind !== 'Ready') throw new Error(`expected a Ready review, got ${result.review.kind}`);
  return { marks: result.marks, review: result.review };
}

describe('SaveReviewMarks for the whole page (A303)', () => {
  it('should save entries for the Instruments of several Trades in one request that names no Trade', async () => {
    const stack = await reviewStack(MONDAY_1700);
    await cardFixture(stack, { withoutMarks: true });

    const { marks } = ready(await savePage(stack, [initial('XYZ', REVIEW_DATE, '52.00'), initial('ABC', REVIEW_DATE, '27.50'), initial('JKL', REVIEW_DATE, '21.00')]));

    expect(marks.map((m) => m.key.instrumentKey)).toEqual(['XYZ', 'ABC', 'JKL']);
    const stored = await stack.persistence.readSnapshot(['observations'], async (tx) => [
      await tx.get('observations', [REVIEW_DATE, 'XYZ']),
      await tx.get('observations', [REVIEW_DATE, 'ABC']),
      await tx.get('observations', [REVIEW_DATE, 'JKL']),
    ]);
    expect(stored.value.map((record) => record !== undefined)).toEqual([true, true, true]);
  }, 30_000);

  it('should return the refreshed Review in its new order', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { b } = await cardFixture(stack, { withoutMarks: true });
    const before = await openPage(stack);

    // ABC at 27.50 is past its Stop of 28.00, so it moves to the head of the page.
    const { review } = ready(await savePage(stack, [initial('ABC', REVIEW_DATE, '27.50')]));

    const after = await openPage(stack);
    expect(review.trades.map((t) => t.tradeId)).toEqual(after.order);
    expect(after.order[0]).toBe(b);
    expect(before.order[0]).not.toBe(b);
    expect(review.trade.tradeId).toBe(b);
  }, 30_000);

  it('should send a changed Review Date Mark that was typed for that date as a correction with the reason Fixed in the same Review', async () => {
    const stack = await reviewStack(MONDAY_1700);
    await cardFixture(stack, { withoutMarks: true });
    ready(await savePage(stack, [initial('XYZ', REVIEW_DATE, '52.00')]));

    // The grid sends no reason of its own for a fix.
    const fix: MarketDataPrepareEntry = { key: { instrumentKey: 'XYZ', tradingDate: REVIEW_DATE }, expectedRevision: 1, intention: { kind: 'CorrectMark', price: '52.50', reason: '' } };
    const { marks } = ready(await savePage(stack, [fix]));

    expect(marks[0]!.classification).toBe('Correction');
    const frames = await stack.marketData.query({ kind: 'ResolveFrames', context: { kind: 'Review', reviewDate: REVIEW_DATE }, instruments: ['XYZ'] });
    expect(frames.kind === 'Frames' && frames.frames[0]!.resolution).toMatchObject({ kind: 'Available', mark: { correctionReason: 'Fixed in the same Review' } });
  }, 30_000);

  it('should still require a reason to correct an earlier session Mark', async () => {
    const stack = await reviewStack(MONDAY_1700);
    await cardFixture(stack, { withoutMarks: true });
    // XYZ has a typed Mark on the Review Date too, so only the date tells the fix from the correction.
    ready(await savePage(stack, [initial('XYZ', FRIDAY_DATE, '51.00'), initial('XYZ', REVIEW_DATE, '52.00')]));
    const before = await dumpAll(stack.factory);

    const fix: MarketDataPrepareEntry = { key: { instrumentKey: 'XYZ', tradingDate: FRIDAY_DATE }, expectedRevision: 1, intention: { kind: 'CorrectMark', price: '51.50', reason: '' } };
    const result = await savePage(stack, [fix]);

    expect(result).toMatchObject({ kind: 'Rejected', issues: [expect.objectContaining({ field: 'reason', code: 'ReasonRequired' })] });
    expect(await dumpAll(stack.factory)).toEqual(before);
  }, 30_000);

  it('should save nothing when one entry binding is stale', async () => {
    const stack = await reviewStack(MONDAY_1700);
    await cardFixture(stack, { withoutMarks: true });
    await stack.saveMark('ABC', '27.50');
    const before = await dumpAll(stack.factory);

    // ABC already has a Mark at revision 1: an entry that binds it as 'None' is stale, and XYZ beside it is not written either.
    const result = await savePage(stack, [initial('XYZ', REVIEW_DATE, '52.00'), initial('ABC', REVIEW_DATE, '28.00')]);

    expect(result).toMatchObject({ kind: 'Conflict', keys: [expect.objectContaining({ key: { instrumentKey: 'ABC', tradingDate: REVIEW_DATE }, code: 'StaleRevision' })] });
    expect(await dumpAll(stack.factory)).toEqual(before);
  }, 30_000);

  it('should refuse 101 entries with TooManyEntries', async () => {
    const stack = await reviewStack(MONDAY_1700);
    await cardFixture(stack, { withoutMarks: true });
    const before = await dumpAll(stack.factory);
    const dates = Array.from({ length: 101 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10));

    const result = await savePage(stack, dates.map((date) => initial('XYZ', date, '1.00')));

    expect(result).toEqual({ kind: 'Rejected', issues: [{ field: 'entries', code: 'TooManyEntries' }] });
    expect(await dumpAll(stack.factory)).toEqual(before);
  }, 30_000);

  it('should commit once, with one put an entry', async () => {
    const stack = await reviewStack(MONDAY_1700);
    await cardFixture(stack, { withoutMarks: true });
    const { reviewDate, binding } = await openPage(stack);
    let commits = 0;
    const commit = (async (...args: Parameters<typeof stack.persistence.commit>) => {
      commits++;
      return stack.persistence.commit(...args);
    }) as typeof stack.persistence.commit;
    const review = createDailyReview({ ...stack, persistence: { ...stack.persistence, commit } });
    const before = await stack.persistence.readSnapshot(['observations'], (tx) => tx.getAll('observations'));

    const entries = [initial('XYZ', REVIEW_DATE, '52.00'), initial('ABC', REVIEW_DATE, '27.50'), initial('JKL', REVIEW_DATE, '21.00')];
    const { marks } = ready(await review.save({ kind: 'SaveReviewMarks', reviewDate, binding, entries }));

    expect(commits).toBe(1);
    const after = await stack.persistence.readSnapshot(['observations'], (tx) => tx.getAll('observations'));
    expect(after.value.length - before.value.length).toBe(entries.length);
    expect(marks).toHaveLength(entries.length);
  }, 30_000);
});
