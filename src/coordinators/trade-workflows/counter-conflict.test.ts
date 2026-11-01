import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { dumpAll } from '../../../tests/support/stack.ts';
import { onboardedStack } from '../../../tests/support/onboarded.ts';
import type { Persistence } from '../../persistence/index.ts';
import { createTradeWorkflows, type ConfirmPlanCommand, type PositionChangeCommand } from './index.ts';

// T5R2.12: Trade Workflows retries a counter-only conflict (A175, ADR 0011).
const NOW = '2026-10-12T21:00:00Z';
const PLAN_TIME = '2026-10-12T13:00:00Z';
const PC1 = '2026-10-12T14:00:00Z';

type Stack = Awaited<ReturnType<typeof onboardedStack>>;

const planCommand = (stack: Stack): ConfirmPlanCommand => ({
  accountId: stack.account.id,
  accountRevision: stack.account.recordRevision,
  strategyId: stack.strategy.id,
  strategyRevision: stack.strategy.recordRevision,
  economicTime: PLAN_TIME,
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
    },
  },
});

// A Trade with a Plan, and a deferred Position Change Reflection for each Debt wanted.
async function withDebts(debts: number) {
  const stack = await onboardedStack(new IDBFactory(), NOW);
  const confirmed = await stack.tradeWorkflows.confirmPlan(planCommand(stack));
  if (confirmed.kind !== 'Confirmed') throw new Error(`expected Confirmed, got ${confirmed.kind}`);
  const trade = confirmed.postCommit.trade;
  const definition = await stack.journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
  if (definition.kind !== 'Found') throw new Error('no definition');
  const buy = (economicTime: string) => ({
    kind: 'Execution' as const,
    tradeId: trade.tradeId,
    action: 'Buy' as const,
    instrument: { kind: 'Stock' as const, symbol: 'XYZ' },
    intent: { kind: 'ServesPlannedLeg' as const, plannedLegId: trade.plan.legs[0]!.factId },
    quantity: '10',
    price: '50.00',
    fee: '1.00',
    economicTime,
  });
  const command = (expectedFactRevision: number, reflection: PositionChangeCommand['reflection'], time = PC1): PositionChangeCommand => ({
    originTradeId: trade.tradeId,
    trades: [{ tradeId: trade.tradeId, expectedFactRevision }],
    members: [buy(time)],
    reflection,
  });
  const complete = (): PositionChangeCommand['reflection'] => ({
    kind: 'Complete',
    form: {
      definitionId: definition.definition.id,
      answers: {
        'prompt.position-change-reflection.decision-mode': { kind: 'Option', optionId: 'option.position-change-reflection.decision-mode.as-planned' },
        'prompt.position-change-reflection.primary-emotion': { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
        'prompt.position-change-reflection.decision-confidence': { kind: 'Scale', value: 4 },
      },
    },
  });
  let factRevision = confirmed.receipt.factRevision;
  const pending: { debtId: string; revision: string }[] = [];
  for (let i = 0; i < debts; i++) {
    const deferred = await stack.tradeWorkflows.recordPositionChange(command(factRevision, { kind: 'Defer' }));
    if (deferred.kind !== 'Recorded' || deferred.postCommit.reflection.kind !== 'Debt') throw new Error('expected a deferred Position Change');
    factRevision = deferred.receipt.factRevision;
    pending.push(deferred.postCommit.reflection.debt);
  }
  // A Journal write: one Debt resolution through Journal.save.
  const resolveNext = async () => {
    const debt = pending.shift()!;
    const saved = await stack.journal.save({ intention: 'ResolveDebt', debtId: debt.debtId, expectedDebtRevision: debt.revision, resolution: { kind: 'Decline' } });
    if (saved.kind !== 'Saved') throw new Error(`expected Saved, got ${saved.kind}`);
  };
  // Trade Workflows over a persistence that lands a Journal write just before the chosen commit attempts.
  const interfere = (attempts: readonly number[]) => {
    let attempt = 0;
    const persistence: Persistence = {
      ...stack.persistence,
      commit: async (candidate) => {
        attempt += 1;
        if (attempts.includes(attempt)) await resolveNext();
        return stack.persistence.commit(candidate);
      },
    };
    return createTradeWorkflows({ ...stack, persistence, guard: stack.guard });
  };
  const journalRevision = async () => {
    const { value } = await stack.persistence.readSnapshot(['meta'], async (tx) => ((await tx.get('meta', 'journal')) as { journalRevision: number }).journalRevision);
    return value;
  };
  return { stack, trade, factRevision, command, complete, interfere, journalRevision };
}

const workspaceStores = (dump: Awaited<ReturnType<typeof dumpAll>>) => Object.entries(dump).find(([name]) => name.startsWith('tj-ws-'))![1];

describe('counter-only conflict (A175, ADR 0011)', () => {
  it('should record a Position Change once, with its reflection, when one Journal write lands before its first commit, and advance the Journal revision twice', async () => {
    const f = await withDebts(1);
    const before = await f.journalRevision();
    const stores = workspaceStores(await dumpAll(f.stack.factory));
    const entriesBefore = stores['journalEntries']!.length;
    const factsBefore = (stores['trades']![0] as { facts: unknown[] }).facts.length;
    const result = await f.interfere([1]).recordPositionChange(f.command(f.factRevision, f.complete(), '2026-10-12T15:00:00Z'));
    expect(result.kind).toBe('Recorded');
    if (result.kind !== 'Recorded') return;
    expect(result.postCommit.reflection.kind).toBe('Entry');
    expect(result.receipt.factRevision).toBe(f.factRevision + 1);
    expect(await f.journalRevision()).toBe(before + 2);
    const after = workspaceStores(await dumpAll(f.stack.factory));
    expect(after['journalEntries']).toHaveLength(entriesBefore + 1);
    // Once: a Position Change and its one Execution, not two of each.
    expect((after['trades']![0] as { facts: unknown[] }).facts).toHaveLength(factsBefore + 2);
  });

  it('should confirm a Plan once, with its Plan Reflection, when one Journal write lands before its first commit', async () => {
    const f = await withDebts(1);
    const before = workspaceStores(await dumpAll(f.stack.factory));
    const result = await f.interfere([1]).confirmPlan(planCommand(f.stack));
    expect(result.kind).toBe('Confirmed');
    const after = workspaceStores(await dumpAll(f.stack.factory));
    expect(after['trades']).toHaveLength(before['trades']!.length + 1);
    // Once: the one Plan Reflection Entry; the Debt resolution is a Decline, not an Entry.
    expect(after['journalEntries']).toHaveLength(before['journalEntries']!.length + 1);
  });

  it('should return Conflict and write nothing when a Journal write lands before each of its three attempts', async () => {
    const f = await withDebts(3);
    const workflows = f.interfere([1, 2, 3]);
    const before = workspaceStores(await dumpAll(f.stack.factory));
    const revisionBefore = await f.journalRevision();
    const result = await workflows.recordPositionChange(f.command(f.factRevision, f.complete(), '2026-10-12T15:00:00Z'));
    expect(result).toEqual({ kind: 'Conflict', changed: [expect.stringMatching(/^journal@\d+$/)] });
    const after = workspaceStores(await dumpAll(f.stack.factory));
    expect(after['trades']).toEqual(before['trades']);
    expect(after['journalEntries']).toEqual(before['journalEntries']);
    expect(await f.journalRevision()).toBe(revisionBefore + 3);
  });
});
