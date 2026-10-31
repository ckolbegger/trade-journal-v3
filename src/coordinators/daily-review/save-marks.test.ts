import { describe, expect, it } from 'vitest';
import { Rational } from '../../domain/values/index.ts';
import { cardFixture, FRIDAY_DATE, MONDAY_1700, REVIEW_DATE, reviewStack, type ReviewStack } from '../../../tests/support/review-fixture.ts';
import { dumpAll } from '../../../tests/support/stack.ts';
import type { MarketDataPrepareEntry } from '../../modules/market-data/index.ts';
import { createDailyReview } from './index.ts';
import type { ReviewBinding, SaveDailyReviewResult } from './index.ts';

// T5R.5: DailyReview.save (SaveReviewMarks), against the card fixture at Monday 17:00 with no Monday Marks.

async function overview(stack: ReviewStack): Promise<ReviewBinding & { readonly reviewDate: string }> {
  const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
  if (opened.kind !== 'Ready') throw new Error(`expected Ready, got ${opened.kind}`);
  return { ...opened.binding, reviewDate: opened.reviewDate };
}

const initial = (instrumentKey: string, tradingDate: string, price: string): MarketDataPrepareEntry => ({
  key: { instrumentKey, tradingDate },
  expectedRevision: 'None',
  intention: { kind: 'RecordInitialManualMark', price },
});

// T-A's card: its Friday and Monday XYZ Marks.
const xyzEntries = [initial('XYZ', REVIEW_DATE, '52.00'), initial('XYZ', FRIDAY_DATE, '51.00')];

async function saveMarks(stack: ReviewStack, tradeId: string, entries: readonly MarketDataPrepareEntry[]): Promise<SaveDailyReviewResult> {
  const { reviewDate, ...binding } = await overview(stack);
  return stack.dailyReview.save({ kind: 'SaveReviewMarks', reviewDate, tradeId, binding, entries });
}

function marksSaved(result: SaveDailyReviewResult) {
  if (result.kind !== 'MarksSaved') throw new Error(`expected MarksSaved, got ${result.kind}`);
  return result;
}

function ready(result: SaveDailyReviewResult) {
  const { review } = marksSaved(result);
  if (review.kind !== 'Ready') throw new Error(`expected a Ready review, got ${review.kind}`);
  return review;
}

describe('SaveReviewMarks (P37, P38, A155)', () => {
  it('should save XYZ for Monday and for Friday from T-A card in one commit, and return MarksSaved with each key resolution, revision, and classification, equal to the stored records', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await cardFixture(stack, { withoutMarks: true });

    const { marks } = marksSaved(await saveMarks(stack, a, xyzEntries));

    const stored = await stack.persistence.readSnapshot(['observations'], async (tx) => [
      await tx.get('observations', [REVIEW_DATE, 'XYZ']),
      await tx.get('observations', [FRIDAY_DATE, 'XYZ']),
    ]);
    const [monday, friday] = stored.value;
    expect(marks.map((m) => m.key)).toEqual([
      { instrumentKey: 'XYZ', tradingDate: REVIEW_DATE },
      { instrumentKey: 'XYZ', tradingDate: FRIDAY_DATE },
    ]);
    expect(marks.map((m) => m.resolutionRevision)).toEqual([monday!['resolutionRevision'], friday!['resolutionRevision']]);
    expect(marks.map((m) => m.classification)).toEqual(['InitialManual', 'InitialManual']);
    expect(marks.map((m) => m.resolution.kind)).toEqual(['Available', 'Available']);
    // The same resolution a fresh frame query reports for the Review date.
    const frames = await stack.marketData.query({ kind: 'ResolveFrames', context: { kind: 'Review', reviewDate: REVIEW_DATE }, instruments: ['XYZ'] });
    expect(frames.kind === 'Frames' && frames.frames[0]!.resolution).toEqual(marks[0]!.resolution);
  }, 30_000);

  it('should return, in the same result, the revised completion and progress, T-A card evaluated with XYZ 52.00 (range position 9/17, Reward : risk now 8/9), and T-F revised walked item, which shares XYZ, without the caller calling open or getTrade', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, f } = await cardFixture(stack, { withoutMarks: true });

    const review = ready(await saveMarks(stack, a, xyzEntries));

    expect(review.progress).toEqual({ tradesWithAction: 0, tradesEligible: 5 });
    const missing = review.completion.kind === 'Incomplete' ? review.completion.reasons.filter((r) => r.code === 'MarkMissing').map((r) => (r.code === 'MarkMissing' ? r.instrumentKey : '')) : [];
    expect(missing.sort()).toEqual(['ABC', 'DEF', 'JKL']);
    expect(review.trade.tradeId).toBe(a);
    expect(review.trade.attention.rangePosition).toEqual({ kind: 'Placed', now: Rational.of(9n, 17n), atEntry: Rational.of(134n, 425n) });
    expect(review.trade.evaluation?.rewardRiskNow).toEqual({ kind: 'Value', value: Rational.of(8n, 9n) });
    expect(review.trades.find((t) => t.tradeId === f)!.rangePosition).toEqual({ kind: 'Placed', now: Rational.of(4n, 7n), atEntry: Rational.of(2n, 7n) });
    // The binding is the one a fresh open gives.
    const reopened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
    expect(reopened.kind === 'Ready' && reopened.binding).toEqual(review.binding);
  }, 30_000);

  it('should return the next step, preferring a card with a Missing Review-date Mark, T-C, for DEF', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, c } = await cardFixture(stack, { withoutMarks: true });
    // ABC and JKL are marked already, so DEF is the only Missing Review-date Mark.
    await stack.saveMark('ABC', '27.50');
    await stack.saveMark('JKL', '21.00');

    const review = ready(await saveMarks(stack, a, xyzEntries));

    if (review.nextStep.kind !== 'Mark') throw new Error(`expected a Mark next step, got ${review.nextStep.kind}`);
    expect(review.nextStep.row).toEqual(expect.objectContaining({ instrumentKey: 'DEF', task: 'Manual', trades: [c] }));
    expect(review.nextStep.trade.tradeId).toBe(c);
  }, 30_000);

  it('should pass Market Data Rejected issues and Conflict back unchanged and write nothing', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await cardFixture(stack, { withoutMarks: true });
    const before = await dumpAll(stack.factory);

    const rejected = await saveMarks(stack, a, [initial('XYZ', REVIEW_DATE, '52.00'), initial('ABC', REVIEW_DATE, 'abc')]);
    const direct = await stack.marketData.prepareEffects({ entries: [initial('XYZ', REVIEW_DATE, '52.00'), initial('ABC', REVIEW_DATE, 'abc')] });
    expect(rejected).toEqual(direct);
    expect(rejected.kind).toBe('Rejected');
    expect(await dumpAll(stack.factory)).toEqual(before);

    // A key that already has a Mark is a Conflict; the Marks beside it are not written either.
    await stack.saveMark('XYZ', '51.50');
    const afterMark = await dumpAll(stack.factory);
    const conflict = await saveMarks(stack, a, [initial('XYZ', REVIEW_DATE, '52.00'), initial('ABC', REVIEW_DATE, '27.50')]);
    const directConflict = await stack.marketData.prepareEffects({ entries: [initial('XYZ', REVIEW_DATE, '52.00'), initial('ABC', REVIEW_DATE, '27.50')] });
    expect(conflict).toEqual(directConflict);
    expect(conflict.kind).toBe('Conflict');
    expect(await dumpAll(stack.factory)).toEqual(afterMark);
  }, 30_000);

  it('should report the saved Marks with the Review part as ChangedDuringAssembly when another write lands between the commit and the assembly', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await cardFixture(stack, { withoutMarks: true });
    const { reviewDate, ...binding } = await overview(stack);
    let committed = false;
    const commit = (async (...args: Parameters<typeof stack.persistence.commit>) => {
      const result = await stack.persistence.commit(...args);
      committed = true;
      return result;
    }) as typeof stack.persistence.commit;
    // Every assembly attempt after the commit sees a write land in the middle of it (a Mark on an earlier session).
    const earlier = ['2026-10-08', '2026-10-07', '2026-10-06', '2026-10-05', '2026-10-02'];
    const query = (async (...args: Parameters<typeof stack.marketData.query>) => {
      if (committed && args[0].kind === 'ResolveSession' && earlier.length > 0) await stack.saveMark('ABC', '27.00', earlier.shift());
      return stack.marketData.query(...args);
    }) as typeof stack.marketData.query;
    const review = createDailyReview({ ...stack, persistence: { ...stack.persistence, commit }, marketData: { ...stack.marketData, query } });

    const result = marksSaved(await review.save({ kind: 'SaveReviewMarks', reviewDate, tradeId: a, binding, entries: xyzEntries }));

    expect(result.review).toEqual({ kind: 'ChangedDuringAssembly' });
    expect(result.marks).toHaveLength(2);
    const stored = await stack.persistence.readSnapshot(['observations'], (tx) => tx.get('observations', [REVIEW_DATE, 'XYZ']));
    expect(result.marks[0]!.resolutionRevision).toBe(stored.value!['resolutionRevision']);
  }, 30_000);
});

describe('write gate', () => {
  it('should return RuntimeNotWritable and write nothing when the mutation-boundary readiness recheck fails', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await cardFixture(stack, { withoutMarks: true });
    const { reviewDate, ...binding } = await overview(stack);
    stack.testHost.fail(['inventory']);
    const before = await dumpAll(stack.factory);

    expect(await stack.dailyReview.save({ kind: 'SaveReviewMarks', reviewDate, tradeId: a, binding, entries: xyzEntries })).toEqual(
      expect.objectContaining({ kind: 'RuntimeNotWritable', runtimeReadiness: 'RecoveryOnly', failedChecks: [{ check: 'inventory', reason: 'InventoryMissing' }] }),
    );
    expect(await dumpAll(stack.factory)).toEqual(before);
  }, 30_000);
});
