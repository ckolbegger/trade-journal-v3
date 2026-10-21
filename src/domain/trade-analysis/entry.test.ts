import { describe, expect, it } from 'vitest';
import { Rational } from '../values/index.ts';
import { derive, type CalculationResult, type DerivedTradeState, type EntryQualityFigures, type TradeAnalysisRecord } from './index.ts';
import { execution, PC1, PC2, PC3, positionChange, referenceRecord } from './reference-trade.ts';

// The derived state of a coherent record.
function derivedState(record: TradeAnalysisRecord): DerivedTradeState {
  const result = derive({ record });
  if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${JSON.stringify(result)}`);
  return result;
}

// The resolved Entry Quality figures of a coherent record.
function figures(record: TradeAnalysisRecord): EntryQualityFigures {
  const quality = derivedState(record).entryQuality;
  if (quality.kind !== 'Value') throw new Error(`expected resolved Entry Quality, got ${JSON.stringify(quality)}`);
  return quality.value;
}

// A Calculation Result with its Rational shown as an exact fraction, so a failure names the value.
function exact(result: CalculationResult<Rational>) {
  return result.kind === 'Value' ? `${result.value.numerator}/${result.value.denominator}` : result;
}
const q = (n: bigint, d = 1n) => exact({ kind: 'Value', value: Rational.of(n, d) });

// A first entry of 120 @ 50.00, fee 1.00, in one Position Change.
const FIRST_120 = positionChange('pc-1', 1, [execution('ex-1', '2026-10-12T14:00:00Z', 2, '120', '50.00', '1.00')]);

describe('Entry Resolution Point', () => {
  it('should leave the entry unresolved after PC1 and report Entry Quality NotApplicable with reason EntryNotResolved', () => {
    const derived = derivedState(referenceRecord([PC1]));
    expect(derived.entryResolution).toEqual({ kind: 'Unresolved' });
    expect(derived.entryQuality).toEqual({ kind: 'NotApplicable', reason: 'EntryNotResolved' });
  });

  it('should resolve at PC2, when entered quantity first reaches the planned 100', () => {
    expect(derivedState(referenceRecord([PC2, PC1])).entryResolution).toEqual({ kind: 'Resolved', positionChangeId: 'pc-2' });
  });

  it('should resolve at PC1 when PC1 alone buys 120 shares', () => {
    expect(derivedState(referenceRecord([FIRST_120])).entryResolution).toEqual({ kind: 'Resolved', positionChangeId: 'pc-1' });
  });
});

describe('Entry Quality, reference Trade resolved at PC2', () => {
  it('should report average entry 50.18, window quantity 100, and window fees 2.00', () => {
    const f = figures(referenceRecord([PC1, PC2]));
    expect(exact(f.averageEntry)).toBe(q(5018n, 100n));
    expect(exact(f.windowQuantity)).toBe(q(100n));
    expect(exact(f.windowFees)).toBe(q(2n));
  });

  it('should report actual initial risk 270.00 and actual initial reward 580.00', () => {
    const f = figures(referenceRecord([PC1, PC2]));
    expect(exact(f.actualInitialRisk)).toBe(q(270n));
    expect(exact(f.actualInitialReward)).toBe(q(580n));
  });

  it('should report risk in Plan R 27/25, slippage 18.00, size ratio 1, planned ratio 12/5, and actual ratio 58/27, each as its own Calculation Result', () => {
    const f = figures(referenceRecord([PC1, PC2]));
    expect(exact(f.riskInPlanR)).toBe(q(27n, 25n));
    expect(exact(f.slippage)).toBe(q(18n));
    expect(exact(f.sizeRatio)).toBe(q(1n));
    expect(exact(f.plannedRewardRisk)).toBe(q(12n, 5n));
    expect(exact(f.actualRewardRisk)).toBe(q(58n, 27n));
  });

  it('should keep Entry Quality unchanged after PC3 adds 20 shares outside the window, AC-CALC-001', () => {
    const after = derivedState(referenceRecord([PC1, PC2, PC3]));
    expect(after.entryResolution).toEqual({ kind: 'Resolved', positionChangeId: 'pc-2' });
    expect(after.entryQuality).toEqual(derivedState(referenceRecord([PC1, PC2])).entryQuality);
  });

  it('should include every Execution of the resolving Position Change in the window, so a first entry of 120 @ 50.00 fee 1.00 gives risk 301.00, reward 719.00, and size ratio 6/5', () => {
    const f = figures(referenceRecord([FIRST_120]));
    expect(exact(f.windowQuantity)).toBe(q(120n));
    expect(exact(f.actualInitialRisk)).toBe(q(301n));
    expect(exact(f.actualInitialReward)).toBe(q(719n));
    expect(exact(f.sizeRatio)).toBe(q(6n, 5n));
  });
});

// A single first entry of 100 shares at the given price, fee 1.00.
const firstEntry = (price: string) => positionChange('pc-1', 1, [execution('ex-1', '2026-10-12T14:00:00Z', 2, '100', price, '1.00')]);

describe('entries beyond a boundary', () => {
  it('should report risk equal to window fees, flag EntryAtOrBeyondStop, and return the actual ratio as NotApplicable EntryAtOrBeyondStop for 100 @ 47.00 fee 1.00', () => {
    const f = figures(referenceRecord([firstEntry('47.00')]));
    expect(exact(f.actualInitialRisk)).toBe(exact(f.windowFees));
    expect(exact(f.actualInitialRisk)).toBe(q(1n));
    expect(f.flags).toEqual(['EntryAtOrBeyondStop']);
    expect(f.actualRewardRisk).toEqual({ kind: 'NotApplicable', reason: 'EntryAtOrBeyondStop' });
  });

  it('should flag EntryAtOrBeyondTarget and return the actual ratio as NotApplicable EntryAtOrBeyondTarget for 100 @ 56.50 fee 1.00', () => {
    const f = figures(referenceRecord([firstEntry('56.50')]));
    expect(f.flags).toEqual(['EntryAtOrBeyondTarget']);
    expect(f.actualRewardRisk).toEqual({ kind: 'NotApplicable', reason: 'EntryAtOrBeyondTarget' });
    // A24: reward is max of zero and the distance to Target, less window fees.
    expect(exact(f.actualInitialReward)).toBe(q(-1n));
  });
});

describe('Planned-Leg Fulfillment', () => {
  const fulfillment = (record: TradeAnalysisRecord) => derivedState(record).legFulfillment;

  it('should report Unfilled before PC1, PartiallyFilled after PC1, and FilledAsPlanned after PC2', () => {
    expect(fulfillment(referenceRecord([]))).toEqual([{ plannedLegId: 'leg-1', fulfillment: 'Unfilled' }]);
    expect(fulfillment(referenceRecord([PC1]))).toEqual([{ plannedLegId: 'leg-1', fulfillment: 'PartiallyFilled' }]);
    expect(fulfillment(referenceRecord([PC1, PC2]))).toEqual([{ plannedLegId: 'leg-1', fulfillment: 'FilledAsPlanned' }]);
  });

  it('should report FilledWithDeviation after PC3', () => {
    expect(fulfillment(referenceRecord([PC1, PC2, PC3]))).toEqual([{ plannedLegId: 'leg-1', fulfillment: 'FilledWithDeviation' }]);
  });
});
