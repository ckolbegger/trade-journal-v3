import { describe, expect, it } from 'vitest';
import { derive, type DerivedTradeState, type TradeAnalysisRecord } from './index.ts';
import { OC_CONTRACT, OC_PC1, OC_X1, OS_CONTRACT, OS_S1, ocRecord, osRecord } from './option-trade.ts';
import { PC1, referenceRecord } from './reference-trade.ts';

const XYZ = { kind: 'Stock', symbol: 'XYZ' } as const;
const MNO = { kind: 'Stock', symbol: 'MNO' } as const;

function derivedAt(record: TradeAnalysisRecord, valuationDate?: string): DerivedTradeState {
  const result = derive({ record, ...(valuationDate !== undefined && { valuationDate }) });
  if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${JSON.stringify(result)}`);
  return result;
}

const instrumentsOf = (state: DerivedTradeState) => state.observationRequirements.map((r) => r.instrument);

describe('contract status at the valuation date (P81)', () => {
  it('should give O-C contract position the status Live at Thu 11-19', () => {
    const state = derivedAt(ocRecord([OC_PC1]), '2026-11-19');
    expect(state.valuationDate).toBe('2026-11-19');
    expect(state.contractStatuses).toEqual([{ instrument: OC_CONTRACT, status: 'Live' }]);
  });

  it('should give it DueToday at Fri 11-20, still requiring the contract Mark and XYZ Mark', () => {
    const state = derivedAt(ocRecord([OC_PC1]), '2026-11-20');
    expect(state.contractStatuses).toEqual([{ instrument: OC_CONTRACT, status: 'DueToday' }]);
    expect(instrumentsOf(state)).toEqual([OC_CONTRACT, XYZ]);
  });

  it('should give it PastExpiration at Mon 11-23, requiring neither Mark', () => {
    const state = derivedAt(ocRecord([OC_PC1]), '2026-11-23');
    expect(state.contractStatuses).toEqual([{ instrument: OC_CONTRACT, status: 'PastExpiration' }]);
    expect(state.observationRequirements).toEqual([]);
  });

  it('should give O-S short contract the same three statuses on the same dates', () => {
    const statusOn = (date: string) => derivedAt(osRecord([OS_S1]), date).contractStatuses.map((s) => s.status);
    expect(statusOn('2026-11-19')).toEqual(['Live']);
    expect(statusOn('2026-11-20')).toEqual(['DueToday']);
    expect(statusOn('2026-11-23')).toEqual(['PastExpiration']);
    expect(derivedAt(osRecord([OS_S1]), '2026-11-20').contractStatuses[0]!.instrument).toEqual(OS_CONTRACT);
    expect(instrumentsOf(derivedAt(osRecord([OS_S1]), '2026-11-20'))).toEqual([OS_CONTRACT, MNO]);
    expect(derivedAt(osRecord([OS_S1]), '2026-11-23').observationRequirements).toEqual([]);
  });

  it('should give no status to a stock position, or to a contract once its quantity is closed', () => {
    expect(derivedAt(referenceRecord([PC1]), '2026-11-20').contractStatuses).toEqual([]);
    expect(derivedAt(ocRecord([OC_PC1, OC_X1]), '2026-11-20').contractStatuses).toEqual([]);
  });

  it('should give no status and no requirements when derive has no valuation date', () => {
    const state = derivedAt(ocRecord([OC_PC1]));
    expect(state.contractStatuses).toEqual([]);
    expect(state.observationRequirements).toEqual([]);
    expect(state.valuationDate).toBeUndefined();
  });
});
