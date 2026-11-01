import { describe, expect, it } from 'vitest';
import { Rational } from '../values/index.ts';
import { derive, type CalculationResult, type DerivedTradeState, type TradeAnalysisRecord } from './index.ts';
import { PC1, PC2, positionChange, referenceRecord, sellExecution, X1, X2 } from './reference-trade.ts';

// The derived state of a coherent record.
function derivedState(record: TradeAnalysisRecord): DerivedTradeState {
  const result = derive({ record });
  if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${JSON.stringify(result)}`);
  return result;
}

// Rationals compared as exact fractions, so a failure names the value rather than the object.
const q = (r: Rational) => `${r.numerator}/${r.denominator}`;

// A Calculation Result with a Value shown as an exact fraction; any other kind is returned whole,
// so a failure names it.
const exact = (result: CalculationResult<Rational>) => (result.kind === 'Value' ? q(result.value) : result);

describe('lot-aware fees A80', () => {
  it('should allocate a Lot opening fee in proportion to matched quantity and keep the remainder on the Lot: 0.50 to PC1 to X1 and 0.50 left on PC1 Lot, and exactly 1/3 allocated and 2/3 left when 20 of a 60-share Lot with fee 1.00 are sold', () => {
    const afterX1 = derivedState(referenceRecord([PC1, PC2, X1]));
    expect(afterX1.lotMatchResults.map((r) => [r.openingExecutionId, r.disposingExecutionId, exact(r.allocatedOpeningFee)])).toEqual([
      ['ex-1', 'ex-x1', '1/2'],
    ]);
    expect(afterX1.positions[0]?.openLots.map((l) => [l.openingExecutionId, q(l.unconsumedOpeningFee)])).toEqual([
      ['ex-1', '1/2'],
      ['ex-2', '1/1'],
    ]);

    const sellTwenty = positionChange('pc-s', 7, [sellExecution('ex-s', '2026-10-13T14:00:00Z', 8, '20', '52.00', '0.10')]);
    const afterTwenty = derivedState(referenceRecord([PC1, sellTwenty]));
    expect(afterTwenty.lotMatchResults.map((r) => exact(r.allocatedOpeningFee))).toEqual(['1/3']);
    expect(afterTwenty.positions[0]?.openLots.map((l) => q(l.unconsumedOpeningFee))).toEqual(['2/3']);
  });

  it('should allocate a disposing Execution fee across its Lot Matches by matched quantity, X2a 1.00 as 0.60 and 0.40, so opening fees 2.00 and disposal fees 2.00 are each allocated exactly once after X2', () => {
    const { lotMatchResults: results } = derivedState(referenceRecord([PC1, PC2, X1, X2]));
    const sum = (of: (r: (typeof results)[number]) => CalculationResult<Rational>) =>
      q(results.reduce((total, r) => { const v = of(r); return v.kind === 'Value' ? total.add(v.value) : total; }, Rational.of(0n)));
    expect(results.filter((r) => r.disposingExecutionId === 'ex-x2a').map((r) => exact(r.allocatedDisposalFee))).toEqual(['3/5', '2/5']);
    expect(sum((r) => r.allocatedOpeningFee)).toBe('2/1');
    expect(sum((r) => r.allocatedDisposalFee)).toBe('2/1');
  });
});

describe('realized P&L', () => {
  it("should return each Lot Match's allocated opening fee, allocated disposal fee, and realized amount as Value calculation results, PC1 to X1 holding 1/2, 3/5 and 559/10 after X1", () => {
    const afterX1 = derivedState(referenceRecord([PC1, PC2, X1]));
    const [match] = afterX1.lotMatchResults;
    expect(afterX1.lotMatchResults).toHaveLength(1);
    expect([match?.allocatedOpeningFee, match?.allocatedDisposalFee, match?.realized].map((r) => r && exact(r))).toEqual([
      '1/2',
      '3/5',
      '559/10',
    ]);
  });

  it('should return each Lot Match realized amount and Economic Time, and realized-to-date 55.90 after X1 and 248.00 after X2, with incurred fees 2.60 and 4.00', () => {
    const afterX1 = derivedState(referenceRecord([PC1, PC2, X1]));
    expect(afterX1.lotMatchResults.map((r) => [r.disposingExecutionId, r.disposedAt, exact(r.realized)])).toEqual([
      ['ex-x1', '2026-10-13T14:00:00Z', '559/10'],
    ]);
    expect(q(afterX1.realizedToDate)).toBe('559/10');
    expect(q(afterX1.fees.incurred)).toBe('13/5');
    expect(q(afterX1.fees.incurredOpening)).toBe('2/1');

    const afterX2 = derivedState(referenceRecord([PC1, PC2, X1, X2]));
    expect(afterX2.lotMatchResults.map((r) => [r.openingExecutionId, r.disposingExecutionId, r.disposedAt, exact(r.realized)])).toEqual([
      ['ex-1', 'ex-x1', '2026-10-13T14:00:00Z', '559/10'],
      ['ex-1', 'ex-x2a', '2026-10-13T18:00:00Z', '859/10'],
      ['ex-2', 'ex-x2a', '2026-10-13T18:00:00Z', '531/10'],
      ['ex-2', 'ex-x2b', '2026-10-13T18:00:00Z', '531/10'],
    ]);
    expect(q(afterX2.realizedToDate)).toBe('248/1');
    expect(q(afterX2.fees.incurred)).toBe('4/1');

    // Realized-to-date at a cutoff counts only the matches disposed at or before it.
    const atX1 = derive({ record: referenceRecord([PC1, PC2, X1, X2]), cutoff: '2026-10-13T14:00:00Z' });
    expect(atX1.kind === 'Derived' && q(atX1.realizedToDate)).toBe('559/10');
  });
});

describe('FIFO Lot Matches', () => {
  it('should derive Position 70, one Lot Match holding only PC1 and X1 Executions, quantity 30, and policy FIFO A78, and remaining Lots PC1 30 and PC2 40 in Fact Order after X1', () => {
    const derived = derivedState(referenceRecord([X1, PC2, PC1]));
    expect(derived.positions.map((p) => q(p.quantity))).toEqual(['70/1']);
    expect(derived.lotMatches.map((m) => ({ ...m, quantity: q(m.quantity) }))).toEqual([
      { openingExecutionId: 'ex-1', disposingExecutionId: 'ex-x1', quantity: '30/1', policy: 'FIFO' },
    ]);
    expect(derived.positions[0]?.openLots.map((l) => [l.openingExecutionId, q(l.quantity)])).toEqual([
      ['ex-1', '30/1'],
      ['ex-2', '40/1'],
    ]);
  });

  it('should let one disposing Execution consume two Lots oldest first and dispose a Position Change Executions in Fact Order, deriving PC1 to X2a 30, PC2 to X2a 20, and PC2 to X2b 20, and Position 0, after X2', () => {
    // X2b is supplied first, so only Fact Order can put X2a ahead of it.
    const x2 = { ...X2, executions: [...X2.executions].reverse() };
    const derived = derivedState(referenceRecord([x2, X1, PC2, PC1]));
    expect(derived.positions.map((p) => q(p.quantity))).toEqual(['0/1']);
    expect(derived.positions[0]?.openLots).toEqual([]);
    expect(derived.lotMatches.map((m) => [m.openingExecutionId, m.disposingExecutionId, q(m.quantity)])).toEqual([
      ['ex-1', 'ex-x1', '30/1'],
      ['ex-1', 'ex-x2a', '30/1'],
      ['ex-2', 'ex-x2a', '20/1'],
      ['ex-2', 'ex-x2b', '20/1'],
    ]);
  });
});
