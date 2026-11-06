import { describe, expect, it } from 'vitest';
import { Rational } from '../values/index.ts';
import { derive, type DerivedTradeState, type TradeAnalysisRecord } from './index.ts';
import { OC_PC1, OC_PC2, OC_X1, OS_B1, OS_S1, ocRecord, osRecord } from './option-trade.ts';
import { PC1, PC2, referenceRecord } from './reference-trade.ts';

function derivedState(record: TradeAnalysisRecord): DerivedTradeState {
  const result = derive({ record });
  if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${JSON.stringify(result)}`);
  return result;
}

// A Net cost value shown as an exact fraction, so a failure names the value.
function netCostOf(record: TradeAnalysisRecord) {
  const result = derivedState(record).netCost;
  return result.kind === 'Value' ? `${result.value.numerator}/${result.value.denominator}` : result;
}
const exactly = (n: bigint) => `${Rational.of(n).numerator}/${Rational.of(n).denominator}`;

describe('Net cost', () => {
  it('should return Net cost as the sum of quantity times price over the Open Lots plus their opening fees, exactly: 60 @ 50.10 with fee 1.00 is 3007.00', () => {
    expect(netCostOf(referenceRecord([PC1]))).toBe(exactly(3007n));
  });

  it('should sum across the Lots of several Position Changes, including an earlier-dated one: 60 @ 50.10, 40 @ 50.30, fees 1.00 each is 5020.00', () => {
    expect(netCostOf(referenceRecord([PC2, PC1]))).toBe(exactly(5020n));
  });

  it('should return Net cost NotApplicable with reason NoRemainingPosition for a Planned Trade with no Lots', () => {
    expect(netCostOf(referenceRecord([]))).toEqual({ kind: 'NotApplicable', reason: 'NoRemainingPosition' });
  });

  it('should multiply an option Lot by the contract multiplier: one long call at 1.90 with fee 0.65 is 190.65', () => {
    expect(netCostOf(ocRecord([OC_PC1, OC_PC2, OC_X1]))).toBe('3813/20');
  });

  it('should multiply a short option Lot by the contract multiplier: one short put at 1.25 with fee 0.65 is minus 124.35', () => {
    expect(netCostOf(osRecord([OS_S1, OS_B1]))).toBe('-2487/20');
  });
});
