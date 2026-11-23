import { describe, expect, it } from 'vitest';
import { deriveLongStockPosition } from '../../src/trade-analysis/derive';
import { ExactNumber, fromDecimalString, toMoneyString } from '../../src/shared/exact-number';

const basePlan = {
  plannedQuantity: ExactNumber.toJSON(fromDecimalString('100')),
  intendedEntryPrice: ExactNumber.toJSON(fromDecimalString('185.00')),
  stopPrice: ExactNumber.toJSON(fromDecimalString('175.00')),
  targetPrice: ExactNumber.toJSON(fromDecimalString('215.00')),
};

describe('TradeAnalysis.derive (Long Stock Opening Executions) seam', () => {
  it('derives Open Lots, weighted average entry, Entry Quality, slippage, and FilledAsPlanned from scaled opening fills', () => {
    const derived = deriveLongStockPosition({
      storedLifecycleState: 'Open',
      plan: basePlan,
      executions: [
        {
          id: 'exec-1',
          tradeId: 'trd-1',
          positionChangeId: 'pc-1',
          side: 'Buy',
          quantity: ExactNumber.toJSON(fromDecimalString('60')),
          fillPrice: ExactNumber.toJSON(fromDecimalString('184.50')),
          fee: ExactNumber.toJSON(fromDecimalString('1.50')),
          plannedLegIntent: 'PlannedLeg',
          economicTime: '2026-11-23T14:35:00.000Z',
          recordedSequence: 2,
          recordedAt: '2026-11-23T14:35:05.000Z',
        },
        {
          id: 'exec-2',
          tradeId: 'trd-1',
          positionChangeId: 'pc-2',
          side: 'Buy',
          quantity: ExactNumber.toJSON(fromDecimalString('40')),
          fillPrice: ExactNumber.toJSON(fromDecimalString('185.75')),
          fee: ExactNumber.toJSON(fromDecimalString('1.00')),
          plannedLegIntent: 'PlannedLeg',
          economicTime: '2026-11-23T15:00:00.000Z',
          recordedSequence: 3,
          recordedAt: '2026-11-23T15:00:05.000Z',
        },
      ],
    });

    expect(derived.derivedLifecycleState).toBe('Open');
    expect(derived.integrityDisagreement).toBe(false);
    expect(derived.openLots).toHaveLength(2);
    expect(derived.openSharesDisplay).toBe('100');
    // (60*184.50 + 40*185.75) / 100 = (11070 + 7430) / 100 = 185.00
    expect(toMoneyString(derived.averageEntryPrice!)).toBe('$185.00');
    expect(toMoneyString(derived.totalOpeningFees)).toBe('$2.50');
    expect(derived.fulfillment).toBe('FilledAsPlanned');
    expect(derived.deviations).toEqual([]);
    // Actual initial risk = (185 - 175)*100 + 2.50 = $1,002.50
    expect(derived.entryQuality?.actualInitialRiskDisplay).toBe('$1,002.50');
  });

  it('emits EntrySize and UnplannedExposure deviations and flags integrityDisagreement when stored vs derived lifecycle disagrees', () => {
    const derived = deriveLongStockPosition({
      storedLifecycleState: 'Planned', // deliberate disagreement with open execution
      plan: basePlan,
      executions: [
        {
          id: 'exec-1',
          tradeId: 'trd-1',
          positionChangeId: 'pc-1',
          side: 'Buy',
          quantity: ExactNumber.toJSON(fromDecimalString('120')),
          fillPrice: ExactNumber.toJSON(fromDecimalString('186.00')),
          fee: ExactNumber.toJSON(fromDecimalString('0')),
          plannedLegIntent: 'PlannedLeg',
          economicTime: '2026-11-23T14:35:00.000Z',
          recordedSequence: 2,
          recordedAt: '2026-11-23T14:35:05.000Z',
        },
        {
          id: 'exec-2',
          tradeId: 'trd-1',
          positionChangeId: 'pc-2',
          side: 'Buy',
          quantity: ExactNumber.toJSON(fromDecimalString('10')),
          fillPrice: ExactNumber.toJSON(fromDecimalString('187.00')),
          fee: ExactNumber.toJSON(fromDecimalString('0')),
          plannedLegIntent: 'ExplicitlyUnplanned',
          economicTime: '2026-11-23T15:00:00.000Z',
          recordedSequence: 3,
          recordedAt: '2026-11-23T15:00:05.000Z',
        },
      ],
    });

    expect(derived.derivedLifecycleState).toBe('Open');
    expect(derived.integrityDisagreement).toBe(true);
    expect(derived.fulfillment).toBe('UnplannedExposure');
    expect(derived.deviations.map((d) => d.kind).sort()).toEqual([
      'EntrySize',
      'UnplannedExposure',
    ]);
  });
});
