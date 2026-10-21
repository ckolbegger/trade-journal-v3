import { describe, expect, it } from 'vitest';
import { onboardedStack } from '../../../tests/support/onboarded.ts';
import type { ConfirmPlanCommand } from '../trade-workflows/index.ts';
import { Rational } from '../../domain/values/index.ts';
import { createTradeViews } from './index.ts';

type Stack = Awaited<ReturnType<typeof onboardedStack>>;

function command(stack: Stack, economicTime: string, symbol = 'XYZ'): ConfirmPlanCommand {
  return {
    accountId: stack.account.id,
    accountRevision: stack.account.recordRevision,
    strategyId: stack.strategy.id,
    strategyRevision: stack.strategy.recordRevision,
    economicTime,
    plan: {
      underlying: symbol,
      legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol }, quantity: '100', intendedEntry: '50.00' }],
      stops: [{ kind: 'UnderlyingPrice', price: '47.50' }],
      targets: [{ kind: 'UnderlyingPrice', price: '56.00' }],
    },
    reflection: {
      definitionId: stack.definition.id,
      answers: {
        'prompt.plan-reflection.thesis': { kind: 'Text', text: 'Breakout.' },
        'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'Below 48.' },
        'prompt.plan-reflection.primary-emotion': { kind: 'Option', optionId: 'option.plan-reflection.primary-emotion.calm' },
      },
    },
  };
}

async function viewsStack() {
  const stack = await onboardedStack();
  const views = createTradeViews(stack);
  const confirm = async (economicTime: string, symbol?: string) => {
    const result = await stack.tradeWorkflows.confirmPlan(command(stack, economicTime, symbol));
    if (result.kind !== 'Confirmed') throw new Error(`expected Confirmed, got ${result.kind}`);
    return result.receipt.tradeId;
  };
  return { ...stack, views, confirm };
}

describe('browseTrades: Planned', () => {
  it('should return a Ready page with, per Trade, underlying, current Strategy, Account and Institution labels, Plan time, 1R, Original Planned Reward, planned ratio, and "Awaiting entry", ordered by Plan time descending', async () => {
    const stack = await viewsStack();
    const older = await stack.confirm('2026-10-09T14:00:00Z', 'ABC');
    const newer = await stack.confirm('2026-10-12T13:30:00Z', 'XYZ');
    const result = await stack.views.browseTrades({ lifecycle: 'Planned' });
    if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
    expect(result.view.items.map((i) => i.tradeId)).toEqual([newer, older]);
    const [item] = result.view.items;
    expect(item).toEqual(
      expect.objectContaining({
        underlying: 'XYZ',
        strategy: 'Long Stock',
        account: 'Roth IRA',
        institution: 'Fidelity',
        planTime: '2026-10-12T13:30:00Z',
        entryReadiness: 'Awaiting entry',
      }),
    );
    expect(item?.oneR.equals(Rational.of(250n))).toBe(true);
    expect(item?.originalPlannedReward.equals(Rational.of(600n))).toBe(true);
    expect(item?.rewardRiskRatio.equals(Rational.of(12n, 5n))).toBe(true);
  });

  it('should return a Ready page with no items when there are no Planned Trades', async () => {
    const stack = await viewsStack();
    const result = await stack.views.browseTrades({ lifecycle: 'Planned' });
    expect(result.kind).toBe('Ready');
    expect(result.kind === 'Ready' && result.view.items).toEqual([]);
  });

  it('should bind the Trade, Journal, and Catalog revisions it read from one snapshot', async () => {
    const stack = await viewsStack();
    await stack.confirm('2026-10-12T13:30:00Z');
    const result = await stack.views.browseTrades({ lifecycle: 'Planned' });
    const current = await stack.persistence.readSnapshot(['meta'], async (tx) => ({
      catalog: await tx.get('meta', 'catalog'),
      journal: await tx.get('meta', 'journal'),
    }));
    expect(result.kind === 'Ready' && result.binding).toEqual({
      workspace: current.binding,
      catalogRevision: (current.value.catalog as { catalogRevision: number }).catalogRevision,
      journalRevision: (current.value.journal as { journalRevision: number }).journalRevision,
    });
  });

  it('should return pages of 50 with a next cursor and accept that cursor until the next commit', async () => {
    const stack = await viewsStack();
    for (let i = 0; i < 51; i++) await stack.confirm(`2026-10-${String(1 + (i % 9)).padStart(2, '0')}T14:${String(i).padStart(2, '0')}:00Z`);
    const first = await stack.views.browseTrades({ lifecycle: 'Planned' });
    if (first.kind !== 'Ready' || !first.view.nextCursor) throw new Error('expected a next page');
    expect(first.view.items).toHaveLength(50);
    const second = await stack.views.browseTrades({ lifecycle: 'Planned', cursor: first.view.nextCursor });
    expect(second.kind === 'Ready' && second.view.items).toHaveLength(1);
    await stack.confirm('2026-10-11T10:00:00Z');
    expect(await stack.views.browseTrades({ lifecycle: 'Planned', cursor: first.view.nextCursor })).toEqual({
      kind: 'Rejected',
      reason: 'CursorExpired',
    });
  });
});

describe('getTradeDetail: Planned', () => {
  it('should return the Plan (underlying, leg, quantity, intended entry, Stop, Target, Thesis, Invalidation, Plan time), stored lifecycle Planned with agreement, Plan Baseline with per-condition basis, 1R, labels, and the Plan Reflection with snapshot prompt labels', async () => {
    const stack = await viewsStack();
    const tradeId = await stack.confirm('2026-10-12T13:30:00Z');
    const result = await stack.views.getTradeDetail({ tradeId });
    if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
    const { view } = result;
    if ('findings' in view) throw new Error('expected the Planned form of Detail');
    expect(view.plan).toEqual({
      underlying: 'XYZ',
      planTime: '2026-10-12T13:30:00Z',
      thesis: 'Breakout.',
      invalidation: 'Below 48.',
      legs: [expect.objectContaining({ side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '50' })],
      stops: [expect.objectContaining({ kind: 'UnderlyingPrice', price: '47.5' })],
      targets: [expect.objectContaining({ kind: 'UnderlyingPrice', price: '56' })],
    });
    expect(view.lifecycle).toEqual({ stored: 'Planned', agreement: { kind: 'Agrees' } });
    expect(view.baseline.oneR.equals(Rational.of(250n))).toBe(true);
    expect(view.baseline.stopBasis).toHaveLength(1);
    expect(view.labels).toEqual({ strategy: 'Long Stock', account: 'Roth IRA', institution: 'Fidelity' });
    expect(view.journal).toEqual([
      expect.objectContaining({
        entryType: 'Plan Reflection',
        source: 'Plan Confirmation',
        responses: expect.arrayContaining([{ prompt: 'Why this trade, why now?', answer: { kind: 'Text', text: 'Breakout.' } }]) as unknown,
      }),
    ]);
  });

  it('should return NotFound for an unknown Trade identity', async () => {
    const stack = await viewsStack();
    expect(await stack.views.getTradeDetail({ tradeId: 'no-such-trade' })).toEqual({ kind: 'NotFound' });
  });

  it('should bind every revision it read from one snapshot even when a commit races with the read', async () => {
    const stack = await viewsStack();
    const tradeId = await stack.confirm('2026-10-12T13:30:00Z');
    let journalReads = 0;
    const racingJournal = {
      ...stack.journal,
      query: async (query: Parameters<typeof stack.journal.query>[0]) => {
        journalReads++;
        // A commit lands in the middle of the first assembly.
        if (journalReads === 1) await stack.confirm('2026-10-12T13:45:00Z', 'ABC');
        return stack.journal.query(query);
      },
    };
    const views = createTradeViews({ ...stack, journal: racingJournal });
    const result = await views.getTradeDetail({ tradeId });
    const current = await stack.persistence.readSnapshot(['meta'], () => Promise.resolve(null));
    expect(result.kind).toBe('Ready');
    expect(result.kind === 'Ready' && result.binding.workspace).toEqual(current.binding);
    expect(journalReads).toBe(2);
  });
});
