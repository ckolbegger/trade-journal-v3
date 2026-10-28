import { describe, expect, it } from 'vitest';
import { Rational } from '../values/index.ts';
import { derive, type DerivedTradeState, type TradeAnalysisRecord } from './index.ts';
import { PC1, PC2, PC3, referenceRecord } from './reference-trade.ts';

// Monday 2026-10-12, America/New_York: 10:30 is 14:30Z.
const MONDAY_1030 = '2026-10-12T14:30:00Z';

function derivedState(record: TradeAnalysisRecord, extra: { cutoff?: string; valuationDate?: string } = {}): DerivedTradeState {
  const result = derive({ record, ...extra });
  if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${JSON.stringify(result)}`);
  return result;
}

describe('derive at an economic cutoff', () => {
  it('should derive Position and Lots from facts at or before the cutoff only (the reference Trade at Monday 10:30 has 60 shares)', () => {
    const state = derivedState(referenceRecord([PC1, PC2, PC3]), { cutoff: MONDAY_1030 });
    expect(state.positions.map((p) => p.quantity.compare(Rational.of(60n)))).toEqual([0]);
    expect(state.positions[0]!.openLots.map((l) => l.openingExecutionId)).toEqual(['ex-1']);
  });

  it('should report exposure start as the first effective opening Execution\'s Economic Time, moving earlier when an earlier-dated Position Change is supplied', () => {
    expect(derivedState(referenceRecord([PC2, PC3])).exposureStart).toBe(PC2.economicTime);
    expect(derivedState(referenceRecord([PC1, PC2, PC3])).exposureStart).toBe(PC1.economicTime);
    expect(derivedState(referenceRecord([])).exposureStart).toBeNull();
  });

  it('should require an exact Mark on the valuation date for each Instrument with remaining quantity at the cutoff, with earliest relevance at its exposure start, and nothing for a Planned Trade', () => {
    const open = derivedState(referenceRecord([PC2, PC1]), { cutoff: '2026-10-12T20:00:00Z', valuationDate: '2026-10-12' });
    expect(open.observationRequirements).toEqual([
      { instrument: { kind: 'Stock', symbol: 'XYZ' }, valuationDate: '2026-10-12', earliestRelevance: PC1.economicTime },
    ]);
    const planned = derivedState(referenceRecord([]), { cutoff: '2026-10-12T20:00:00Z', valuationDate: '2026-10-12' });
    expect(planned.observationRequirements).toEqual([]);
    const beforeFills = derivedState(referenceRecord([PC1]), { cutoff: '2026-10-12T13:30:00Z', valuationDate: '2026-10-12' });
    expect(beforeFills.observationRequirements).toEqual([]);
  });
});
