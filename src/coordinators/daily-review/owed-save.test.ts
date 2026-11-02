import { describe, expect, it } from 'vitest';
import { reflectionsOwedProgress } from '../../../tests/support/card-progress.ts';
import { closedTradeReviewFixture, TUESDAY_1700, type ClosedTradeFixture } from '../../../tests/support/closed-trade-review-fixture.ts';
import type { SaveDailyReviewResult, TradeSaveBinding } from './index.ts';

// T6.13: DailyReview.save across the walk and the owed-reflection group, against the Closed-Trade Review fixture at
// Tuesday 17:00, every Mark and every Action saved.

const CLOSE_REVIEW_ANSWERS = { 'prompt.close-review.take-again': { kind: 'Option', optionId: 'option.close-review.take-again.yes-as-planned' } } as const;

async function openTuesday(fixture: ClosedTradeFixture) {
  const review = await fixture.stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUESDAY_1700 });
  if (review.kind !== 'Ready') throw new Error(`expected Ready, got ${review.kind}`);
  return review;
}

// An owed Trade's card, as the Review screen receives it from getTrade.
async function owedCardOf(fixture: ClosedTradeFixture, name: 'L' | 'M' | 'Q') {
  const review = await openTuesday(fixture);
  const card = await fixture.stack.dailyReview.getTrade({ reviewDate: review.reviewDate, tradeId: fixture.trades[name]!, binding: review.binding });
  if (card.kind !== 'ReflectionsOwed') throw new Error(`expected ReflectionsOwed, got ${card.kind}`);
  return { reviewDate: review.reviewDate, card: card.card };
}

// A walked Trade's save binding.
async function walkedBindingOf(fixture: ClosedTradeFixture, name: 'A' | 'N'): Promise<TradeSaveBinding> {
  const review = await openTuesday(fixture);
  const card = await fixture.stack.dailyReview.getTrade({ reviewDate: review.reviewDate, tradeId: fixture.trades[name]!, binding: review.binding });
  if (card.kind !== 'Ready') throw new Error(`expected Ready, got ${card.kind}`);
  return card.trade.saveBinding;
}

function resolved(result: SaveDailyReviewResult) {
  if (result.kind !== 'DebtResolved') throw new Error(`expected DebtResolved, got ${result.kind}`);
  return result;
}

function ready(result: SaveDailyReviewResult) {
  if (result.kind !== 'DebtResolved' && result.kind !== 'Saved') throw new Error(`expected a saved result, got ${result.kind}`);
  if (result.review.kind !== 'Ready') throw new Error(`expected a Ready review, got ${result.review.kind}`);
  return result.review;
}

describe('ResolveReviewDebt on an owed-reflection card', () => {
  it('should answer T-M Close Review with a Close Review Entry with Source Daily Review and return revised completion Complete', async () => {
    const fixture = await closedTradeReviewFixture();
    const { stack, debts, trades } = fixture;
    const debtM = debts.find((debt) => debt.anchor.tradeId === trades.M)!;
    const before = (await stack.journal.query({ scope: 'OutstandingDebt' })).snapshot.journalRevision;
    const { reviewDate, card } = await owedCardOf(fixture, 'M');

    const result = resolved(await stack.dailyReview.save({ kind: 'ResolveReviewDebt', reviewDate, binding: card.reflections[0]!.saveBinding, resolution: { kind: 'Answer', answers: CLOSE_REVIEW_ANSWERS } }));

    expect(result.entry).toEqual(expect.objectContaining({ sourceKey: 'source.daily-review', settledDebtId: debtM.debtId, definitionId: debtM.definitionId, momentTime: debtM.momentTime, anchor: debtM.anchor }));
    expect(result.debt).toEqual({ ...debtM, status: 'Settled', entryId: result.entry!.id, revision: expect.any(String) as unknown });
    // One semantic commit, bound on the Journal counter.
    const after = await stack.journal.query({ scope: 'OutstandingDebt' });
    expect(after.snapshot.journalRevision).toBe(before + 1);
    expect(after.debts.map((debt) => debt.debtId)).not.toContain(debtM.debtId);

    // T-M was the only due reflection, so the Review is now Complete and has nothing further to ask.
    const review = ready(result);
    expect(review.completion).toEqual({ kind: 'Complete' });
    expect(review.nextStep).toEqual({ kind: 'Done' });
    expect(review.progress).toEqual({ tradesWithAction: 2, tradesEligible: 2 });
    const reopened = await openTuesday(fixture);
    expect(review.completion).toEqual(reopened.completion);
  }, 60_000);

  it('should return the progress of the owed card the Debt belonged to, done once its reflection is answered', async () => {
    const fixture = await closedTradeReviewFixture();
    const { stack, trades } = fixture;
    const { reviewDate, card } = await owedCardOf(fixture, 'M');
    expect(card.progress).toEqual(reflectionsOwedProgress(1, 0));

    const review = ready(resolved(await stack.dailyReview.save({ kind: 'ResolveReviewDebt', reviewDate, binding: card.reflections[0]!.saveBinding, resolution: { kind: 'Answer', answers: CLOSE_REVIEW_ANSWERS } })));

    expect(review.cards).toEqual([{ tradeId: trades.M, progress: reflectionsOwedProgress(0, 0) }]);
  }, 60_000);

  it('should return the T-M card as the next step after the last walked Action is saved while its Close Review is still due, skipping T-L and T-Q whose reflections are not yet due', async () => {
    const fixture = await closedTradeReviewFixture();
    const { stack, trades } = fixture;
    // Every walked Trade already has an Action; saving T-N's again leaves the walk done and the owed Close Review due.
    const binding = await walkedBindingOf(fixture, 'N');

    const result = await stack.dailyReview.save({ kind: 'SaveTradeAction', binding, action: 'Hold' });

    const review = ready(result);
    expect(review.completion).toEqual({ kind: 'Incomplete', reasons: [{ code: 'ReflectionDue', tradeId: trades.M, debtIds: [expect.any(String) as unknown] }] });
    const { reviewDate, card } = await owedCardOf(fixture, 'M');
    expect(reviewDate).toBe(binding.reviewDate);
    // The same card getTrade returns for T-M, not T-L or T-Q.
    expect(card.tradeId).toBe(trades.M);
    expect(review.nextStep).toEqual({ kind: 'OwedTrade', card });
  }, 60_000);

  it('should return a settled Complete review with next step Done when resolving the last due reflection leaves a Review with no walk Empty', async () => {
    // T-M alone: nothing is walked, and its Close Review is the only due reflection.
    const fixture = await closedTradeReviewFixture({ only: ['M'] });
    const { stack, trades } = fixture;
    const { reviewDate, card } = await owedCardOf(fixture, 'M');

    const result = resolved(await stack.dailyReview.save({ kind: 'ResolveReviewDebt', reviewDate, binding: card.reflections[0]!.saveBinding, resolution: { kind: 'Answer', answers: CLOSE_REVIEW_ANSWERS } }));

    const review = ready(result);
    expect(review.completion).toEqual({ kind: 'Complete' });
    expect(review.nextStep).toEqual({ kind: 'Done' });
    expect(review.progress).toEqual({ tradesWithAction: 0, tradesEligible: 0 });
    expect(review.cards).toEqual([{ tradeId: trades.M, progress: reflectionsOwedProgress(0, 0) }]);
    // The binding is the one a later read accepts: the Review it was settled with is the Empty one `open` returns.
    const reopened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUESDAY_1700 });
    if (reopened.kind !== 'Empty') throw new Error(`expected Empty, got ${reopened.kind}`);
    expect(review.binding).toEqual(reopened.binding);
  }, 60_000);
});

describe('SaveReviewMarks across the walk and the group', () => {
  it('should return the T-M card as the next step after a Marks save when the walk is done and its Close Review is still due', async () => {
    const fixture = await closedTradeReviewFixture();
    const { stack, trades } = fixture;
    const review = await openTuesday(fixture);
    const marks = review.families.find((family) => family.family === 'Marks');
    const row = marks?.family === 'Marks' ? marks.today.find((candidate) => candidate.instrumentKey === 'XYZ') : undefined;
    if (!row) throw new Error('no XYZ row');
    const entries = [{ key: { instrumentKey: 'XYZ', tradingDate: row.tradingDate }, expectedRevision: row.resolutionRevision, intention: { kind: 'CorrectMark' as const, price: '52.50', reason: 'A better quote.' } }];

    const result = await stack.dailyReview.save({ kind: 'SaveReviewMarks', reviewDate: review.reviewDate, tradeId: trades.A!, binding: review.binding, entries });

    if (result.kind !== 'MarksSaved' || result.review.kind !== 'Ready') throw new Error(`expected a Ready MarksSaved, got ${result.kind}`);
    const { card } = await owedCardOf(fixture, 'M');
    expect(result.review.nextStep).toEqual({ kind: 'OwedTrade', card });
  }, 60_000);
});
