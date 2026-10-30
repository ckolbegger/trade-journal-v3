import { describe, expect, it } from 'vitest';
import { debtFixture, TUESDAY_1700, TUESDAY_CUTOFF, type DebtFixture } from '../../../tests/support/debt-fixture.ts';
import { reviewStack } from '../../../tests/support/review-fixture.ts';
import type { OpenDailyReviewResult } from './index.ts';

const open = (fixture: DebtFixture) => fixture.stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUESDAY_1700 });

function ready(result: OpenDailyReviewResult) {
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  return result;
}

describe('reflections per walked Trade (P16, P17, A68)', () => {
  it('should return, for each walked Trade, its due and not-yet-due reflection counts, classified against Monday 16:00 (the close of the session before Tuesday): T-A 2 due (D-1, D-2) and 1 later (D-7); T-F, T-E, and T-G 1 due each; T-H 1 later (D-6); with Marks as the first family, the Trade walk next, and no Debt family', async () => {
    const fixture = await debtFixture();
    const review = ready(await open(fixture));

    expect(review).toEqual(expect.objectContaining({ reviewDate: '2026-10-13', cutoff: TUESDAY_CUTOFF }));
    expect(review.families.map((f) => f.family)).toEqual(['Marks', 'Trades']);
    const walk = review.families[1]!;
    if (walk.family !== 'Trades') throw new Error('no Trades family');
    const counts = Object.fromEntries(walk.trades.map((t) => [t.tradeId, t.reflections]));
    const { a, f, e, g, h } = fixture.trades;
    expect(counts).toEqual({
      [a]: { due: 2, later: 1 },
      [f]: { due: 1, later: 0 },
      [e]: { due: 1, later: 0 },
      [g]: { due: 1, later: 0 },
      [h]: { due: 0, later: 1 },
    });
  }, 60_000);
});

describe('due classification (A75)', () => {
  it('should classify a Debt as later when its anchor, written with a New York offset, is after the previous session close', async () => {
    const stack = await reviewStack(TUESDAY_1700);
    const trade = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    // Monday 16:30 New York is 20:30Z, after the 20:00Z close, though it sorts before it as a string.
    await stack.fill(trade, '2026-10-12T16:30:00-04:00', '100', '50.10', { kind: 'Defer' });
    await stack.saveMark('XYZ', '52.00', '2026-10-13');
    await stack.saveAction(trade.tradeId, 'Hold', '2026-10-13');

    const review = ready(await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUESDAY_1700 }));
    const walk = review.families[1]!;
    if (walk.family !== 'Trades') throw new Error('no Trades family');
    expect(walk.trades.map((t) => t.reflections)).toEqual([{ due: 0, later: 1 }]);
  }, 60_000);
});

describe('completion (AC-REV-006)', () => {
  it('should report Incomplete naming the due reflections by Trade while every Mark and Action is resolved, and Complete once each due reflection is answered or declined, with D-6 and D-7 still Outstanding', async () => {
    const fixture = await debtFixture();
    const { debts, trades, stack } = fixture;
    const incomplete = ready(await open(fixture)).completion;

    expect(incomplete).toEqual({
      kind: 'Incomplete',
      reasons: expect.arrayContaining([
        { code: 'ReflectionDue', tradeId: trades.a, debtIds: [debts['D-1'].debtId, debts['D-2'].debtId] },
        { code: 'ReflectionDue', tradeId: trades.f, debtIds: [debts['D-3'].debtId] },
        { code: 'ReflectionDue', tradeId: trades.e, debtIds: [debts['D-4'].debtId] },
        { code: 'ReflectionDue', tradeId: trades.g, debtIds: [debts['D-5'].debtId] },
      ]) as unknown,
    });
    if (incomplete.kind !== 'Incomplete') throw new Error('expected Incomplete');
    expect(incomplete.reasons).toHaveLength(4);

    const definitionId = debts['D-1'].definitionId;
    const answers = {
      'prompt.position-change-reflection.decision-mode': { kind: 'Option', optionId: 'option.position-change-reflection.decision-mode.as-planned' },
      'prompt.position-change-reflection.primary-emotion': { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
      'prompt.position-change-reflection.decision-confidence': { kind: 'Scale', value: 4 },
    } as const;
    for (const name of ['D-1', 'D-3', 'D-4'] as const) {
      const saved = await stack.journal.save({ intention: 'ResolveDebt', debtId: debts[name].debtId, expectedDebtRevision: debts[name].revision, resolution: { kind: 'Answer', form: { definitionId, answers } } });
      expect(saved.kind).toBe('Saved');
    }
    for (const name of ['D-2', 'D-5'] as const) {
      const saved = await stack.journal.save({ intention: 'ResolveDebt', debtId: debts[name].debtId, expectedDebtRevision: debts[name].revision, resolution: { kind: 'Decline' } });
      expect(saved.kind).toBe('Saved');
    }

    const review = ready(await open(fixture));
    expect(review.completion).toEqual({ kind: 'Complete' });
    const outstanding = await stack.journal.query({ scope: 'OutstandingDebt' });
    expect(outstanding.debts.map((d) => d.debtId).sort()).toEqual([debts['D-6'].debtId, debts['D-7'].debtId].sort());
  }, 60_000);
});
