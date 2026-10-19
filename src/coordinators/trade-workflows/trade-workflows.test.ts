import { describe, expect, it } from 'vitest';
import { Rational } from '../../domain/values/index.ts';
import { dumpAll } from '../../../tests/support/stack.ts';
import { onboardedStack } from '../../../tests/support/onboarded.ts';
import type { ConfirmPlanCommand } from './index.ts';

type Stack = Awaited<ReturnType<typeof onboardedStack>>;

function command(stack: Stack, overrides: Partial<ConfirmPlanCommand> = {}): ConfirmPlanCommand {
  return {
    accountId: stack.account.id,
    accountRevision: stack.account.recordRevision,
    strategyId: stack.strategy.id,
    strategyRevision: stack.strategy.recordRevision,
    economicTime: '2026-10-12T13:30:00Z',
    plan: {
      underlying: 'XYZ',
      legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '50.00' }],
      stops: [{ kind: 'UnderlyingPrice', price: '47.50' }],
      targets: [{ kind: 'UnderlyingPrice', price: '56.00' }],
    },
    reflection: {
      definitionId: stack.definition.id,
      answers: {
        'prompt.plan-reflection.thesis': { kind: 'Text', text: 'Breakout above the 50-day on volume.' },
        'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'A close back below 48.' },
        'prompt.plan-reflection.conviction': { kind: 'Scale', value: 4 },
        'prompt.plan-reflection.primary-emotion': { kind: 'Option', optionId: 'option.plan-reflection.primary-emotion.calm' },
      },
    },
    ...overrides,
  };
}

function workspaceStores(dump: Awaited<ReturnType<typeof dumpAll>>) {
  return Object.entries(dump).find(([name]) => name.startsWith('tj-ws-'))![1];
}

describe('confirmPlan: accepted', () => {
  it('should commit the Trade, its facts, Planned lifecycle-index membership, and the Plan Reflection Entry in one semantic commit', async () => {
    const stack = await onboardedStack();
    const before = workspaceStores(await dumpAll(stack.factory));
    const contentBefore = (before['meta'] as { key: string; contentRevision?: number }[]).find((m) => m.key === 'content')!.contentRevision!;
    const result = await stack.tradeWorkflows.confirmPlan(command(stack));
    expect(result.kind).toBe('Confirmed');
    const after = workspaceStores(await dumpAll(stack.factory));
    expect(after['trades']).toEqual([expect.objectContaining({ lifecycle: 'Planned', planTime: '2026-10-12T13:30:00Z' })]);
    expect((after['trades']![0] as { facts: unknown[] }).facts).toHaveLength(4);
    expect(after['journalEntries']).toEqual([expect.objectContaining({ entryTypeKey: 'entry-type.plan-reflection' })]);
    // One semantic commit: the content revision advanced exactly once.
    expect((after['meta'] as { key: string; contentRevision?: number }[]).find((m) => m.key === 'content')!.contentRevision).toBe(contentBefore + 1);
  });

  it('should return TradeMutationSuccess: Trade identity and FactRevision, created fact identities, the lifecycle transition to Planned, the Entry identity, the post-commit Trade projection, its derivation with Plan Baseline and 1R, the Entry projection, and the affected Planned-list scope', async () => {
    const stack = await onboardedStack();
    const result = await stack.tradeWorkflows.confirmPlan(command(stack));
    if (result.kind !== 'Confirmed') throw new Error(`expected Confirmed, got ${result.kind}`);
    const { receipt, postCommit, affected } = result;
    expect(receipt.factRevision).toBe(1);
    expect(receipt.createdFactIds).toHaveLength(4);
    expect(receipt.lifecycleTransitions).toEqual([{ tradeId: receipt.tradeId, from: null, to: 'Planned' }]);
    expect(postCommit.trade).toEqual(expect.objectContaining({ tradeId: receipt.tradeId, factRevision: 1, storedLifecycle: 'Planned' }));
    expect(postCommit.derivation.baseline.oneR.equals(Rational.of(250n))).toBe(true);
    expect(postCommit.derivation.agreement).toEqual({ kind: 'Agrees' });
    expect(postCommit.entry).toEqual(expect.objectContaining({ id: receipt.entryId, anchor: { kind: 'Trade', tradeId: receipt.tradeId } }));
    expect(affected).toEqual([{ scope: 'TradeList', lifecycle: 'Planned' }]);
    expect(receipt.binding.contentRevision).toBeGreaterThan(1);
  });

  it('should store Thesis and Invalidation in the Plan facts equal to the Entry\'s answers, entered once', async () => {
    const stack = await onboardedStack();
    const result = await stack.tradeWorkflows.confirmPlan(command(stack));
    if (result.kind !== 'Confirmed') throw new Error('expected Confirmed');
    expect(result.postCommit.trade.plan.thesis).toBe('Breakout above the 50-day on volume.');
    expect(result.postCommit.trade.plan.invalidation).toBe('A close back below 48.');
    const answer = (promptId: string) => result.postCommit.entry.responses.find((r) => r.promptId === promptId)?.value;
    expect(answer('prompt.plan-reflection.thesis')).toEqual({ kind: 'Text', text: result.postCommit.trade.plan.thesis });
    expect(answer('prompt.plan-reflection.invalidation')).toEqual({ kind: 'Text', text: result.postCommit.trade.plan.invalidation });
  });

  it('should store the trader-supplied Economic Time on the Plan fact and as the Entry\'s moment time', async () => {
    const stack = await onboardedStack();
    const result = await stack.tradeWorkflows.confirmPlan(command(stack, { economicTime: '2026-10-09T19:45:00Z' }));
    if (result.kind !== 'Confirmed') throw new Error('expected Confirmed');
    expect(result.postCommit.trade.plan.economicTime).toBe('2026-10-09T19:45:00Z');
    expect(result.postCommit.entry.momentTime).toBe('2026-10-09T19:45:00Z');
    // Authored time is when the trader actually saved.
    expect(result.postCommit.entry.authoredTime).toBe('2026-10-12T14:05:00Z');
  });
});

describe('confirmPlan: rejected', () => {
  it('should aggregate Catalog, Journal, and Trade Analysis issues into one typed rejection', async () => {
    const stack = await onboardedStack();
    const base = command(stack);
    const result = await stack.tradeWorkflows.confirmPlan({
      ...base,
      accountId: 'no-such-account',
      plan: { ...base.plan, stops: [{ kind: 'UnderlyingPrice', price: '51' }] },
      reflection: {
        ...base.reflection,
        answers: { ...base.reflection.answers, 'prompt.plan-reflection.thesis': { kind: 'Text', text: '' } },
      },
    });
    expect(result).toEqual({
      kind: 'Rejected',
      binding: expect.any(Object) as unknown,
      issues: [
        { source: 'ReferenceCatalog', field: 'account', code: 'UnknownReference' },
        { source: 'Journal', field: 'prompt.plan-reflection.thesis', code: 'RequiredAnswerMissing' },
        { source: 'TradeAnalysis', code: 'NoPositiveRisk' },
      ],
    });
  });

  it('should reject a future Economic Time with EconomicTimeInFuture', async () => {
    const stack = await onboardedStack();
    expect(await stack.tradeWorkflows.confirmPlan(command(stack, { economicTime: '2026-10-12T14:06:00Z' }))).toEqual({
      kind: 'Rejected',
      binding: expect.any(Object) as unknown,
      issues: [{ source: 'TradeWorkflows', field: 'economicTime', code: 'EconomicTimeInFuture' }],
    });
  });

  it('should reject an unknown Account or Strategy with typed reference issues', async () => {
    const stack = await onboardedStack();
    expect(await stack.tradeWorkflows.confirmPlan(command(stack, { strategyId: 'no-such-strategy' }))).toEqual({
      kind: 'Rejected',
      binding: expect.any(Object) as unknown,
      issues: [{ source: 'ReferenceCatalog', field: 'strategy', code: 'UnknownReference' }],
    });
    expect(await stack.tradeWorkflows.confirmPlan(command(stack, { accountId: stack.strategy.id }))).toEqual({
      kind: 'Rejected',
      binding: expect.any(Object) as unknown,
      issues: [{ source: 'ReferenceCatalog', field: 'account', code: 'WrongKind' }],
    });
  });

  it('should leave the Trade Record, Journal, Catalog, and Workspace content revisions unchanged on every rejection', async () => {
    const stack = await onboardedStack();
    const base = command(stack);
    const rejected: ConfirmPlanCommand[] = [
      { ...base, economicTime: '2026-10-13T00:00:00Z' },
      { ...base, strategyId: 'no-such-strategy' },
      { ...base, plan: { ...base.plan, targets: [] } },
      { ...base, reflection: { ...base.reflection, answers: {} } },
    ];
    for (const attempt of rejected) {
      const before = await dumpAll(stack.factory);
      const binding = (await stack.persistence.readSnapshot(['meta'], () => Promise.resolve(null))).binding;
      const result = await stack.tradeWorkflows.confirmPlan(attempt);
      expect(result.kind).toBe('Rejected');
      // The rejection names the Workspace snapshot it was judged against, which is unchanged.
      expect(result.kind === 'Rejected' && result.binding).toEqual(binding);
      expect(await dumpAll(stack.factory)).toEqual(before);
    }
  });

  it('should return Conflict and write nothing when a referenced record\'s revision changed after the form was loaded', async () => {
    const stack = await onboardedStack();
    const before = await dumpAll(stack.factory);
    expect(await stack.tradeWorkflows.confirmPlan(command(stack, { accountRevision: stack.account.recordRevision + 1 }))).toEqual({
      kind: 'Conflict',
      changed: ['account'],
    });
    expect(await dumpAll(stack.factory)).toEqual(before);
  });

  it('should return RuntimeNotWritable and write nothing when the mutation-boundary readiness recheck fails', async () => {
    const stack = await onboardedStack();
    stack.testHost.fail(['inventory']);
    const before = await dumpAll(stack.factory);
    expect(await stack.tradeWorkflows.confirmPlan(command(stack))).toEqual(
      expect.objectContaining({
        kind: 'RuntimeNotWritable',
        runtimeReadiness: 'RecoveryOnly',
        failedChecks: [{ check: 'inventory', reason: 'InventoryMissing' }],
      }),
    );
    expect(await dumpAll(stack.factory)).toEqual(before);
  });
});
