import { describe, expect, it } from 'vitest';
import { debtFixture, TUESDAY_1700, type DebtFixture, type DebtName } from '../../../tests/support/debt-fixture.ts';
import { dumpAll } from '../../../tests/support/stack.ts';
import type { ReflectionSaveBinding, ResolveReviewDebtRequest, SaveDailyReviewResult } from './index.ts';

// T5.10: DailyReview.save (ResolveReviewDebt), against the Debt fixture at Tuesday 17:00.

const ANSWERS = {
  'prompt.position-change-reflection.decision-mode': { kind: 'Option', optionId: 'option.position-change-reflection.decision-mode.as-planned' },
  'prompt.position-change-reflection.primary-emotion': { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
  'prompt.position-change-reflection.decision-confidence': { kind: 'Scale', value: 4 },
} as const;

// The Debt's save binding and the Review Date, as the Review screen receives them from getTrade.
async function bindingFor(fixture: DebtFixture, name: DebtName): Promise<{ reviewDate: string; binding: ReflectionSaveBinding }> {
  const { stack, debts } = fixture;
  const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUESDAY_1700 });
  if (opened.kind !== 'Ready') throw new Error(`expected Ready, got ${opened.kind}`);
  const trade = await stack.dailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId: debts[name].anchor.tradeId, binding: opened.binding });
  if (trade.kind !== 'Ready') throw new Error(`expected Ready, got ${trade.kind}`);
  const reflection = trade.trade.reflections.find((r) => r.debtId === debts[name].debtId);
  if (!reflection) throw new Error(`no reflection for ${name}`);
  return { reviewDate: opened.reviewDate, binding: reflection.saveBinding };
}

const resolve = (fixture: DebtFixture, request: Omit<ResolveReviewDebtRequest, 'kind'>): Promise<SaveDailyReviewResult> =>
  fixture.stack.dailyReview.save({ kind: 'ResolveReviewDebt', ...request });

function resolved(result: SaveDailyReviewResult) {
  if (result.kind !== 'DebtResolved') throw new Error(`expected DebtResolved, got ${result.kind}`);
  return result;
}

describe('ResolveReviewDebt', () => {
  it('should answer D-1 against its snapshot, creating the Entry with Source Daily Review and settling the Debt in one semantic commit, and return the Entry, the Debt\'s Settled transition, the revised progress and completion, and T-A as the next step while D-2 is still due (A67, A68)', async () => {
    const fixture = await debtFixture();
    const { stack, debts, trades } = fixture;
    const before = (await stack.journal.query({ scope: 'OutstandingDebt' })).snapshot.journalRevision;
    const { reviewDate, binding } = await bindingFor(fixture, 'D-1');

    const result = resolved(await resolve(fixture, { reviewDate, binding, resolution: { kind: 'Answer', answers: ANSWERS } }));

    expect(result.entry).toEqual(
      expect.objectContaining({ sourceKey: 'source.daily-review', settledDebtId: debts['D-1'].debtId, definitionId: debts['D-1'].definitionId, momentTime: debts['D-1'].momentTime, anchor: debts['D-1'].anchor }),
    );
    expect(result.decline).toBeUndefined();
    expect(result.debt).toEqual({ ...debts['D-1'], status: 'Settled', entryId: result.entry!.id, revision: expect.any(String) as unknown });
    expect(result.debt.revision).not.toBe(debts['D-1'].revision);

    // One semantic commit: the Journal counter moved once, and the Debt is no longer Outstanding.
    const after = await stack.journal.query({ scope: 'OutstandingDebt' });
    expect(after.snapshot.journalRevision).toBe(before + 1);
    expect(after.debts.map((d) => d.debtId)).not.toContain(debts['D-1'].debtId);

    if (result.review.kind !== 'Ready') throw new Error('expected a Ready review');
    expect(result.review.progress).toEqual({ tradesWithAction: 5, tradesEligible: 5 });
    expect(result.review.completion).toEqual({
      kind: 'Incomplete',
      reasons: expect.arrayContaining([{ code: 'ReflectionDue', tradeId: trades.a, debtIds: [debts['D-2'].debtId] }]) as unknown,
    });
    expect(result.review.nextStep).toEqual({ kind: 'Trade', trade: expect.objectContaining({ tradeId: trades.a }) as unknown });
  }, 60_000);

  it("should, with T-A's Action already saved, decline D-2 with an optional reason and return the same result shape, with the next Trade that is not done as the next step", async () => {
    const fixture = await debtFixture();
    const { stack, debts, trades } = fixture;
    const first = await bindingFor(fixture, 'D-1');
    resolved(await resolve(fixture, { ...first, resolution: { kind: 'Answer', answers: ANSWERS } }));
    const { reviewDate, binding } = await bindingFor(fixture, 'D-2');

    const result = resolved(await resolve(fixture, { reviewDate, binding, resolution: { kind: 'Decline', reason: 'Not worth recalling' } }));

    expect(result.entry).toBeUndefined();
    expect(result.decline).toEqual(
      expect.objectContaining({ sourceKey: 'source.daily-review', settledDebtId: debts['D-2'].debtId, reason: 'Not worth recalling', momentTime: debts['D-2'].momentTime }),
    );
    expect(result.debt).toEqual(expect.objectContaining({ debtId: debts['D-2'].debtId, status: 'Declined', declineId: result.decline!.id }));

    // T-A owes nothing now; the next Trade after it in the walk with a due reflection is next.
    const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUESDAY_1700 });
    if (opened.kind !== 'Ready') throw new Error(`expected Ready, got ${opened.kind}`);
    const walk = opened.families.find((f) => f.family === 'Trades');
    if (walk?.family !== 'Trades') throw new Error('no Trades family');
    const order = walk.trades.map((t) => t.tradeId);
    const after = [...order.slice(order.indexOf(trades.a) + 1), ...order.slice(0, order.indexOf(trades.a))];
    const expectedNext = after.find((id) => walk.trades.find((t) => t.tradeId === id)!.reflections.due > 0);

    if (result.review.kind !== 'Ready') throw new Error('expected a Ready review');
    expect(result.review.progress).toEqual({ tradesWithAction: 5, tradesEligible: 5 });
    expect(result.review.completion).toEqual(opened.completion);
    expect(result.review.nextStep).toEqual({ kind: 'Trade', trade: expect.objectContaining({ tradeId: expectedNext }) as unknown });
    expect(expectedNext).not.toBe(trades.a);
  }, 60_000);

  it('should return Conflict carrying the current outcome and write nothing when the Debt was resolved on Trade Detail since the binding', async () => {
    const fixture = await debtFixture();
    const { stack, debts } = fixture;
    const { reviewDate, binding } = await bindingFor(fixture, 'D-2');
    const elsewhere = await stack.journal.save({ intention: 'ResolveDebt', debtId: debts['D-2'].debtId, expectedDebtRevision: debts['D-2'].revision, resolution: { kind: 'Decline' } });
    if (elsewhere.kind !== 'Saved') throw new Error(`expected Saved, got ${elsewhere.kind}`);
    const before = await dumpAll(stack.factory);

    const result = await resolve(fixture, { reviewDate, binding, resolution: { kind: 'Answer', answers: ANSWERS } });

    expect(result).toEqual({ kind: 'Conflict', currentOutcome: elsewhere.currentOutcome });
    expect(elsewhere.currentOutcome.kind).toBe('Decline');
    expect(await dumpAll(stack.factory)).toEqual(before);
  }, 60_000);

  it('should return RuntimeNotWritable and write nothing when the mutation-boundary readiness recheck fails', async () => {
    const fixture = await debtFixture();
    const { stack } = fixture;
    const { reviewDate, binding } = await bindingFor(fixture, 'D-1');
    stack.testHost.fail(['inventory']);
    const before = await dumpAll(stack.factory);

    expect(await resolve(fixture, { reviewDate, binding, resolution: { kind: 'Answer', answers: ANSWERS } })).toEqual(
      expect.objectContaining({ kind: 'RuntimeNotWritable', runtimeReadiness: 'RecoveryOnly', failedChecks: [{ check: 'inventory', reason: 'InventoryMissing' }] }),
    );
    expect(await dumpAll(stack.factory)).toEqual(before);
  }, 60_000);
});
