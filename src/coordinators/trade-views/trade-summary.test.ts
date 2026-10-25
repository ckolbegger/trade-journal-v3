import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { derive, type TradeAnalysisRecord } from '../../domain/trade-analysis/index.ts';
import { Rational } from '../../domain/values/index.ts';
import { onboardedStack } from '../../../tests/support/onboarded.ts';
import type { PositionChangeMember } from '../trade-workflows/index.ts';
import { createTradeViews } from './index.ts';

// T2.58: the reference Trade (100 shares, intended entry 50.00), 60 @ 50.10 with fee 1.00 open.
const NOW = '2026-10-12T21:00:00Z';
const PLAN_TIME = '2026-10-12T13:00:00Z';
const PC1 = '2026-10-12T14:00:00Z';

// derive is the real one, replaceable so a Trade can be made incoherent.
vi.mock('../../domain/trade-analysis/index.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../domain/trade-analysis/index.ts')>();
  return { ...original, derive: vi.fn(original.derive) };
});

async function summaryStack() {
  const stack = await onboardedStack(new IDBFactory(), NOW);
  const views = createTradeViews(stack);
  const pc = await stack.journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
  if (pc.kind !== 'Found') throw new Error('no Position Change Reflection definition');
  const confirm = async (symbol: string): Promise<TradeAnalysisRecord> => {
    const confirmed = await stack.tradeWorkflows.confirmPlan({
      accountId: stack.account.id,
      accountRevision: stack.account.recordRevision,
      strategyId: stack.strategy.id,
      strategyRevision: stack.strategy.recordRevision,
      economicTime: PLAN_TIME,
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
        },
      },
    });
    if (confirmed.kind !== 'Confirmed') throw new Error(`expected Confirmed, got ${confirmed.kind}`);
    return confirmed.postCommit.trade;
  };
  const enter = async (trade: TradeAnalysisRecord, quantity: string, price: string) => {
    const current = await stack.tradeRecord.getRecord({ tradeId: trade.tradeId, projection: 'AnalysisInput' });
    if (current.kind !== 'Found') throw new Error('no Trade');
    const member: PositionChangeMember = {
      kind: 'Execution',
      tradeId: trade.tradeId,
      action: 'Buy',
      instrument: { kind: 'Stock', symbol: trade.plan.underlying },
      intent: { kind: 'ServesPlannedLeg', plannedLegId: trade.plan.legs[0]!.factId },
      quantity,
      price,
      fee: '1.00',
      economicTime: PC1,
    };
    const result = await stack.tradeWorkflows.recordPositionChange({
      originTradeId: trade.tradeId,
      trades: [{ tradeId: trade.tradeId, expectedFactRevision: current.factRevision }],
      members: [member],
      reflection: {
        kind: 'Complete',
        form: {
          definitionId: pc.definition.id,
          answers: {
            'prompt.position-change-reflection.decision-mode': { kind: 'Option', optionId: 'option.position-change-reflection.decision-mode.as-planned' },
            'prompt.position-change-reflection.primary-emotion': { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
            'prompt.position-change-reflection.decision-confidence': { kind: 'Scale', value: 4 },
          },
        },
      },
    });
    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${result.kind}`);
  };
  return { views, confirm, enter };
}

const listed = async (views: Awaited<ReturnType<typeof summaryStack>>['views'], lifecycle: 'Planned' | 'Open') => {
  const result = await views.browseTrades({ lifecycle });
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  return result.view.items[0] as unknown as Record<string, unknown>;
};
const detailed = async (views: Awaited<ReturnType<typeof summaryStack>>['views'], tradeId: string) => {
  const result = await views.getTradeDetail({ tradeId });
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  return result.view as unknown as Record<string, unknown>;
};
const stockSummary = (quantity: Rational, price: Rational) => ({ kind: 'Stock', direction: 'Long', quantity, price });

describe('Trade Summary', () => {
  it('should give each Planned item and Planned Detail summary Stock, Long, the planned quantity, and the intended entry', async () => {
    const { views, confirm } = await summaryStack();
    const trade = await confirm('XYZ');
    const expected = stockSummary(Rational.of(100n), Rational.of(50n));
    const item = await listed(views, 'Planned');
    expect(item['summary']).toEqual(expected);
    expect(item).not.toHaveProperty('netCost');
    expect((await detailed(views, trade.tradeId))['summary']).toEqual(expected);
  });

  it('should give each Open item and Open Detail summary Stock, Long, the open quantity, and the average open cost, with netCost from derive', async () => {
    const { views, confirm, enter } = await summaryStack();
    const trade = await confirm('XYZ');
    await enter(trade, '60', '50.10');
    // 60 @ 50.10 with fee 1.00: 3007.00.
    const expected = stockSummary(Rational.of(60n), Rational.of(501n, 10n));
    const netCost = { kind: 'Value', value: Rational.of(3007n) };
    const item = await listed(views, 'Open');
    expect(item['summary']).toEqual(expected);
    expect(item['netCost']).toEqual(netCost);
    const detail = await detailed(views, trade.tradeId);
    expect(detail['summary']).toEqual(expected);
    expect(detail['netCost']).toEqual(netCost);
  });

  it('should give an incoherent Planned or Open item and Detail no summary and no netCost', async () => {
    const { views, confirm, enter } = await summaryStack();
    const planned = await confirm('ABC');
    const open = await confirm('XYZ');
    await enter(open, '60', '50.10');
    vi.mocked(derive).mockImplementation(() => ({ kind: 'IncoherentFacts', findings: [] }) as unknown as ReturnType<typeof derive>);
    try {
      for (const [lifecycle, tradeId] of [['Planned', planned.tradeId], ['Open', open.tradeId]] as const) {
        for (const view of [await listed(views, lifecycle), await detailed(views, tradeId)]) {
          expect(view).not.toHaveProperty('summary');
          expect(view).not.toHaveProperty('netCost');
        }
      }
    } finally {
      vi.mocked(derive).mockRestore();
    }
  });

  it('should keep every other field of every item and Detail unchanged', async () => {
    const { views, confirm, enter } = await summaryStack();
    const planned = await confirm('ABC');
    const open = await confirm('XYZ');
    await enter(open, '60', '50.10');
    const without = (view: Record<string, unknown>, ...keys: string[]) => Object.keys(view).filter((k) => !keys.includes(k)).sort();
    expect(without(await listed(views, 'Planned'), 'summary')).toEqual([
      'account', 'entryReadiness', 'institution', 'oneR', 'originalPlannedReward', 'planTime', 'rewardRiskRatio', 'strategy', 'tradeId', 'underlying',
    ]);
    expect(without(await listed(views, 'Open'), 'summary', 'netCost')).toEqual([
      'account', 'averageOpenCost', 'deviationCount', 'entryStatus', 'incurredFees', 'institution', 'integrity', 'lastActivity', 'openQuantity', 'plannedQuantity', 'strategy', 'tradeId', 'underlying',
    ]);
    expect(without(await detailed(views, planned.tradeId), 'summary')).toEqual(['baseline', 'factRevision', 'journal', 'labels', 'lifecycle', 'plan', 'tradeId']);
    expect(without(await detailed(views, open.tradeId), 'summary', 'netCost')).toEqual([
      'baseline', 'deviations', 'entryQuality', 'entryResolution', 'entryStatus', 'factRevision', 'fees', 'findings', 'journal', 'labels', 'legFulfillment', 'lifecycle', 'plan', 'positionChanges', 'positions', 'tradeId',
    ]);
  });
});
