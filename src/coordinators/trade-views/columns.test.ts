import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { onboardedStack } from '../../../tests/support/onboarded.ts';
import { createTradeViews } from './index.ts';

// T8R.21: the Today table's column dates (A232, P110). An Open Trade with 100 shares, entered Mon 2026-10-12, read at various instants.
const PLAN_TIME = '2026-10-12T13:00:00Z';
const ENTRY = '2026-10-12T14:00:00Z';

async function detailAt(now: string) {
  const stack = await onboardedStack(new IDBFactory(), now);
  const views = createTradeViews(stack);
  const confirmed = await stack.tradeWorkflows.confirmPlan({
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
        'prompt.plan-reflection.thesis': { kind: 'Text', text: 'Breakout.' },
        'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'A close below 48.' },
      },
    },
  });
  if (confirmed.kind !== 'Confirmed') throw new Error(`expected Confirmed, got ${confirmed.kind}`);
  const trade = confirmed.postCommit.trade;
  const current = await stack.tradeRecord.getRecord({ tradeId: trade.tradeId, projection: 'AnalysisInput' });
  if (current.kind !== 'Found') throw new Error('no Trade');
  const definition = await stack.journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
  if (definition.kind !== 'Found') throw new Error('no definition');
  const recorded = await stack.tradeWorkflows.recordPositionChange({
    originTradeId: trade.tradeId,
    trades: [{ tradeId: trade.tradeId, expectedFactRevision: current.factRevision }],
    members: [{ kind: 'Execution', tradeId: trade.tradeId, action: 'Buy', instrument: { kind: 'Stock', symbol: 'XYZ' }, intent: { kind: 'ServesPlannedLeg', plannedLegId: trade.plan.legs[0]!.factId }, quantity: '100', price: '50.00', fee: '1.00', economicTime: ENTRY }],
    reflection: { kind: 'Decline', definitionId: definition.definition.id, reason: 'test' },
  });
  if (recorded.kind !== 'Recorded') throw new Error(`expected Recorded, got ${recorded.kind}`);
  const result = await views.getTradeDetail({ tradeId: trade.tradeId });
  if (result.kind !== 'Ready' || !('marksColumns' in result.view || 'current' in result.view)) throw new Error(`expected an Open Detail, got ${result.kind}`);
  return (result.view as { marksColumns?: unknown }).marksColumns;
}

describe("getTradeDetail: Today's column dates (A232)", () => {
  it('should give Thursday and Wednesday at Thu 12:00, and again at Thu 18:00', async () => {
    const expected = { today: { date: '2026-10-15', next: false }, yesterday: '2026-10-14' };
    expect(await detailAt('2026-10-15T16:00:00Z')).toEqual(expected);
    expect(await detailAt('2026-10-15T22:00:00Z')).toEqual(expected);
  });

  it('should give Monday as the next session and Friday on a Saturday', async () => {
    expect(await detailAt('2026-10-17T14:00:00Z')).toEqual({ today: { date: '2026-10-19', next: true }, yesterday: '2026-10-16' });
  });

  it('should give the next session after a holiday', async () => {
    // Thanksgiving, Thu 2026-11-26, at 12:00: Friday is the next session, Wednesday the one before.
    expect(await detailAt('2026-11-26T17:00:00Z')).toEqual({ today: { date: '2026-11-27', next: true }, yesterday: '2026-11-25' });
  });

  it('should leave the dates out outside session-policy coverage', async () => {
    expect(await detailAt('2029-01-05T17:00:00Z')).toBeUndefined();
  });
});
