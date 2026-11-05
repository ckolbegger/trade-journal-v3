import { describe, expect, it } from 'vitest';
import { derive, type DerivationResult } from './index.ts';
import { execution, PC1, PC2, positionChange, referenceRecord, sellExecution } from './reference-trade.ts';

const XYZ = { kind: 'Stock', symbol: 'XYZ' };

// The findings of an incoherent result, with `available` as an exact fraction.
const findingsOf = (result: DerivationResult) => {
  if (result.kind !== 'IncoherentFacts') throw new Error(`expected IncoherentFacts, got ${result.kind}`);
  return result.findings.map((f) => ({ ...f, ...('available' in f && { available: `${f.available.numerator}/${f.available.denominator}` }) }));
};

describe('findings for facts that cannot be replayed (P69)', () => {
  it('should name a Sell above the open quantity with its Instrument, Economic Time, side Sell, quantity 120 and 100 open', () => {
    const pc = positionChange('pc-s', 7, [sellExecution('ex-s', '2026-10-13T14:00:00Z', 8, '120', '52.00', '0.60')]);
    expect(findingsOf(derive({ record: referenceRecord([PC1, PC2, pc]) }))).toEqual([
      {
        factId: 'ex-s',
        kind: 'Execution',
        instrument: XYZ,
        economicTime: '2026-10-13T14:00:00Z',
        side: 'Sell',
        quantity: '120',
        reason: 'ExceedsOpenQuantity',
        available: '100/1',
      },
    ]);
  });

  it('should name a Sell that leaves the Position flat before a later fact with its Instrument, Economic Time, side and quantity', () => {
    const pc = positionChange('pc-s', 7, [sellExecution('ex-s', '2026-10-12T14:30:00Z', 8, '60', '52.00', '0.60')]);
    expect(findingsOf(derive({ record: referenceRecord([PC1, PC2, pc]) }))).toEqual([
      {
        factId: 'ex-s',
        kind: 'Execution',
        instrument: XYZ,
        economicTime: '2026-10-12T14:30:00Z',
        side: 'Sell',
        quantity: '60',
        reason: 'FlatBeforeLaterFacts',
      },
    ]);
  });

  it('should name an Execution with an unknown Planned Leg, and one with a quantity that is not positive, each with its Instrument, Economic Time, side and quantity', () => {
    const unknownLeg = { ...execution('ex-9', '2026-10-12T14:00:00Z', 2, '10', '50', '0'), intent: { kind: 'ServesPlannedLeg', plannedLegId: 'leg-x' } } as const;
    expect(findingsOf(derive({ record: referenceRecord([positionChange('pc-9', 1, [unknownLeg])]) }))).toEqual([
      { factId: 'ex-9', kind: 'Execution', instrument: XYZ, economicTime: '2026-10-12T14:00:00Z', side: 'Buy', quantity: '10', reason: 'UnknownPlannedLeg' },
    ]);
    const negative = positionChange('pc-9', 1, [sellExecution('ex-9', '2026-10-12T14:00:00Z', 2, '-5', '50', '0')]);
    expect(findingsOf(derive({ record: referenceRecord([negative]) }))).toEqual([
      { factId: 'ex-9', kind: 'Execution', instrument: XYZ, economicTime: '2026-10-12T14:00:00Z', side: 'Sell', quantity: '-5', reason: 'NonpositiveQuantity' },
    ]);
  });

  it('should name a duplicated Position Change identity with kind PositionChange and its Economic Time, and a duplicated Execution identity with kind Execution and its details', () => {
    const samePc = positionChange('pc-1', 9, [execution('ex-n', '2026-10-12T16:00:00Z', 10, '10', '50', '0')]);
    expect(findingsOf(derive({ record: referenceRecord([PC1, samePc]) }))).toEqual([
      { factId: 'pc-1', kind: 'PositionChange', economicTime: '2026-10-12T16:00:00Z', reason: 'DuplicateFactId' },
    ]);
    const sameEx = positionChange('pc-9', 9, [sellExecution('ex-1', '2026-10-12T16:00:00Z', 10, '10', '50', '0')]);
    expect(findingsOf(derive({ record: referenceRecord([PC1, sameEx]) }))).toEqual([
      { factId: 'ex-1', kind: 'Execution', instrument: XYZ, economicTime: '2026-10-12T16:00:00Z', side: 'Sell', quantity: '10', reason: 'DuplicateFactId' },
    ]);
  });
});
