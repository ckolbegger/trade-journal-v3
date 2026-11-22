import { describe, expect, it } from 'vitest';
import { cardFixture, fiveTradeFixture, MONDAY_1700, reviewStack, type ReviewStack } from '../../../tests/support/review-fixture.ts';
import { dumpAll } from '../../../tests/support/stack.ts';
import type { GetDailyTradeReviewResult, SaveDailyReviewResult, TradeSaveBinding } from './index.ts';

// T95.7: SaveTradeAction refuses until the Trade's Review Date Marks are resolved (A304, P166).

async function bindingFor(stack: ReviewStack, tradeId: string): Promise<TradeSaveBinding> {
  const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
  if (opened.kind !== 'Ready') throw new Error(`expected Ready, got ${opened.kind}`);
  const trade: GetDailyTradeReviewResult = await stack.dailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
  if (trade.kind !== 'Ready') throw new Error(`expected Ready, got ${trade.kind}`);
  return trade.trade.saveBinding;
}

const hold = async (stack: ReviewStack, tradeId: string): Promise<SaveDailyReviewResult> =>
  stack.dailyReview.save({ kind: 'SaveTradeAction', binding: await bindingFor(stack, tradeId), action: 'Hold' });

describe('SaveTradeAction waits for the Trade\'s Marks (A304)', () => {
  it('should refuse an Action with ReviewMarksUnresolved while a required Review Date Mark is Missing, and write nothing', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { c } = await fiveTradeFixture(stack);
    const binding = await bindingFor(stack, c);
    const before = await dumpAll(stack.factory);

    const result = await stack.dailyReview.save({ kind: 'SaveTradeAction', binding, action: 'Hold' });

    expect(result).toEqual({ kind: 'Rejected', issues: [expect.objectContaining({ code: 'ReviewMarksUnresolved' })] });
    expect(await dumpAll(stack.factory)).toEqual(before);
  }, 30_000);

  it('should name the Instruments still Missing', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await fiveTradeFixture(stack, { withoutMarks: true });

    const result = await hold(stack, a);

    expect(result).toEqual({ kind: 'Rejected', issues: [{ code: 'ReviewMarksUnresolved', instruments: [{ kind: 'Stock', symbol: 'XYZ' }] }] });
  }, 30_000);

  it('should save the Action once the Mark is saved', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { c } = await fiveTradeFixture(stack);
    expect((await hold(stack, c)).kind).toBe('Rejected');

    await stack.saveMark('DEF', '40.50');

    expect((await hold(stack, c)).kind).toBe('Saved');
  }, 30_000);

  it('should save the Action once the Mark is acknowledged Unavailable', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { c } = await fiveTradeFixture(stack);
    expect((await hold(stack, c)).kind).toBe('Rejected');

    await stack.acknowledge('DEF');

    expect((await hold(stack, c)).kind).toBe('Saved');
  }, 30_000);

  it('should not ask for an earlier session Mark', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await fiveTradeFixture(stack);
    // XYZ has Monday's Mark and none for the session before.

    expect((await hold(stack, a)).kind).toBe('Saved');
  }, 30_000);

  it('should still resolve an owed reflection through ResolveReviewDebt while a Mark is Missing', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await cardFixture(stack, { withoutMarks: true });
    const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
    if (opened.kind !== 'Ready') throw new Error(`expected Ready, got ${opened.kind}`);
    expect(opened.completion.kind === 'Incomplete' && opened.completion.reasons.some((r) => r.code === 'MarkMissing')).toBe(true);
    const trade = await stack.dailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId: a, binding: opened.binding });
    if (trade.kind !== 'Ready') throw new Error(`expected Ready, got ${trade.kind}`);
    const reflection = trade.trade.reflections.find((r) => r.classification === 'Due')!;

    const result = await stack.dailyReview.save({
      kind: 'ResolveReviewDebt',
      reviewDate: opened.reviewDate,
      binding: reflection.saveBinding,
      resolution: {
        kind: 'Answer',
        answers: {
          'prompt.position-change-reflection.decision-mode': { kind: 'Option', optionId: 'option.position-change-reflection.decision-mode.as-planned' },
          'prompt.position-change-reflection.primary-emotion': { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
          'prompt.position-change-reflection.decision-confidence': { kind: 'Scale', value: 4 },
        },
      },
    });

    expect(result.kind).toBe('DebtResolved');
  }, 30_000);
});
