import { describe, expect, it } from 'vitest';
import { Rational } from '../values/index.ts';
import { derive, type DerivedTradeState, type TradeAnalysisRecord } from './index.ts';
import { execution, PC1, PC2, PC3, positionChange, referenceRecord } from './reference-trade.ts';

describe('fact replay order', () => {
  it('should order effective facts by Economic Time then Recorded Sequence, regardless of the order they are supplied in', () => {
    const derived = derivedState(referenceRecord([PC3, PC1, PC2]));
    expect(derived.facts.map((f) => f.factId)).toEqual(['ex-1', 'ex-2', 'ex-3']);
  });

  it('should order two Executions with equal Economic Time by Recorded Sequence', () => {
    const at = '2026-10-12T14:00:00Z';
    const pc = positionChange('pc-1', 1, [
      execution('ex-b', at, 3, '30', '50.20', '0.50'),
      execution('ex-a', at, 2, '30', '50.00', '0.50'),
    ]);
    expect(derivedState(referenceRecord([pc])).facts.map((f) => f.factId)).toEqual(['ex-a', 'ex-b']);
  });
});

// The derived state of a coherent record.
function derivedState(record: TradeAnalysisRecord): DerivedTradeState {
  const result = derive({ record });
  if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${JSON.stringify(result)}`);
  return result;
}

const dec = (n: bigint, d = 1n) => Rational.of(n, d);

// Rationals compared as exact fractions, so a failure names the value rather than the object.
function lots(derived: DerivedTradeState) {
  return derived.positions.map((p) => ({
    instrument: p.instrument,
    quantity: `${p.quantity.numerator}/${p.quantity.denominator}`,
    openLots: p.openLots.map((l) => ({
      openingExecutionId: l.openingExecutionId,
      quantity: `${l.quantity.numerator}/${l.quantity.denominator}`,
      price: `${l.price.numerator}/${l.price.denominator}`,
      unconsumedOpeningFee: `${l.unconsumedOpeningFee.numerator}/${l.unconsumedOpeningFee.denominator}`,
    })),
  }));
}
const q = (r: Rational) => `${r.numerator}/${r.denominator}`;

describe('Instrument Position and Open Lots', () => {
  it('should derive Position 60 and one Open Lot after PC1', () => {
    expect(lots(derivedState(referenceRecord([PC1])))).toEqual([
      {
        instrument: { kind: 'Stock', symbol: 'XYZ' },
        quantity: q(dec(60n)),
        openLots: [{ openingExecutionId: 'ex-1', quantity: q(dec(60n)), price: q(dec(501n, 10n)), unconsumedOpeningFee: q(dec(1n)) }],
      },
    ]);
  });

  it('should derive Position 100 and two Open Lots in Fact Order after PC1 and PC2', () => {
    const [position] = lots(derivedState(referenceRecord([PC2, PC1])));
    expect(position?.quantity).toBe(q(dec(100n)));
    expect(position?.openLots).toEqual([
      { openingExecutionId: 'ex-1', quantity: q(dec(60n)), price: q(dec(501n, 10n)), unconsumedOpeningFee: q(dec(1n)) },
      { openingExecutionId: 'ex-2', quantity: q(dec(40n)), price: q(dec(503n, 10n)), unconsumedOpeningFee: q(dec(1n)) },
    ]);
  });

  it('should create one Lot per Execution when one Position Change has two Executions', () => {
    const pc = positionChange('pc-1', 1, [
      execution('ex-a', '2026-10-12T14:00:00Z', 2, '30', '50.00', '0.50'),
      execution('ex-b', '2026-10-12T14:00:00Z', 3, '30', '50.20', '0.50'),
    ]);
    const [position] = lots(derivedState(referenceRecord([pc])));
    expect(position?.quantity).toBe(q(dec(60n)));
    expect(position?.openLots).toEqual([
      { openingExecutionId: 'ex-a', quantity: q(dec(30n)), price: q(dec(50n)), unconsumedOpeningFee: q(dec(1n, 2n)) },
      { openingExecutionId: 'ex-b', quantity: q(dec(30n)), price: q(dec(502n, 10n)), unconsumedOpeningFee: q(dec(1n, 2n)) },
    ]);
  });

  it('should report incurred opening fees as the exact sum of Execution fees, counting each fee once', () => {
    const pc = positionChange('pc-1', 1, [
      execution('ex-a', '2026-10-12T14:00:00Z', 2, '30', '50.00', '0.50'),
      execution('ex-b', '2026-10-12T14:00:00Z', 3, '30', '50.20', '0.25'),
    ]);
    const derived = derivedState(referenceRecord([pc, PC2]));
    expect(q(derived.fees.incurredOpening)).toBe(q(dec(7n, 4n)));
  });

  it('should keep exact values for fractional inputs', () => {
    const pc = positionChange('pc-1', 1, [execution('ex-1', '2026-10-12T14:00:00Z', 2, '2.5', '10.123456', '0.333333')]);
    const derived = derivedState(referenceRecord([pc]));
    expect(lots(derived)[0]).toEqual({
      instrument: { kind: 'Stock', symbol: 'XYZ' },
      quantity: q(dec(5n, 2n)),
      openLots: [{ openingExecutionId: 'ex-1', quantity: q(dec(5n, 2n)), price: q(dec(10123456n, 1000000n)), unconsumedOpeningFee: q(dec(333333n, 1000000n)) }],
    });
    expect(q(derived.fees.incurredOpening)).toBe(q(dec(333333n, 1000000n)));
  });
});

describe('expected lifecycle', () => {
  it('should expect Planned with no Position Change and Open after any opening Execution', () => {
    expect(derivedState(referenceRecord([])).expectedLifecycle).toBe('Planned');
    expect(derivedState(referenceRecord([PC1], 'Planned')).expectedLifecycle).toBe('Open');
  });

  it('should report agreement Agrees when the supplied stored lifecycle equals the expected one', () => {
    expect(derivedState(referenceRecord([PC1], 'Open')).agreement).toEqual({ kind: 'Agrees' });
  });
});

describe('incoherent facts', () => {
  it('should return a typed IncoherentFacts result naming the fact when an Execution names an unknown Planned Leg, has a nonpositive quantity, or duplicates a fact identity', () => {
    const unknownLeg = { ...execution('ex-9', '2026-10-12T14:00:00Z', 2, '10', '50', '0'), intent: { kind: 'ServesPlannedLeg', plannedLegId: 'leg-x' } } as const;
    expect(derive({ record: referenceRecord([positionChange('pc-9', 1, [unknownLeg])]) })).toEqual({
      kind: 'IncoherentFacts',
      findings: [{ factId: 'ex-9', reason: 'UnknownPlannedLeg' }],
    });
    for (const quantity of ['0', '-5']) {
      const pc = positionChange('pc-9', 1, [execution('ex-9', '2026-10-12T14:00:00Z', 2, quantity, '50', '0')]);
      expect(derive({ record: referenceRecord([pc]) }), quantity).toEqual({
        kind: 'IncoherentFacts',
        findings: [{ factId: 'ex-9', reason: 'NonpositiveQuantity' }],
      });
    }
    const twice = positionChange('pc-9', 1, [execution('ex-1', '2026-10-12T16:00:00Z', 2, '10', '50', '0')]);
    expect(derive({ record: referenceRecord([PC1, twice]) })).toEqual({
      kind: 'IncoherentFacts',
      findings: [{ factId: 'ex-1', reason: 'DuplicateFactId' }],
    });
  });

  it('should return deep-equal results for identical inputs', () => {
    expect(derive({ record: referenceRecord([PC1, PC2]) })).toEqual(derive({ record: referenceRecord([PC1, PC2]) }));
    // Outputs are inert (Trade Analysis contract): they never alias the caller's input.
    const input = { record: referenceRecord([structuredClone(PC1)]) };
    const derived = derive(input);
    const before = structuredClone(derived);
    const fill = input.record.positionChanges[0]!.executions[0]!;
    (fill.instrument as { symbol: string }).symbol = 'ABC';
    (fill.intent as { plannedLegId: string }).plannedLegId = 'leg-x';
    expect(derived).toEqual(before);
  });
});
