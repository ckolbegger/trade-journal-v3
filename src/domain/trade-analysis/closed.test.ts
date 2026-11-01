import { describe, expect, it } from 'vitest';
import { Rational } from '../values/index.ts';
import { derive, type DerivationResult, type DerivedTradeState, type TradeAnalysisRecord } from './index.ts';
import { PC1, PC2, positionChange, referenceRecord, sellExecution, X1, X2 } from './reference-trade.ts';

// The derived state of a coherent record.
function derivedState(record: TradeAnalysisRecord): DerivedTradeState {
  const result = derive({ record });
  if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${JSON.stringify(result)}`);
  return result;
}

// Rationals compared as exact fractions, so a failure names the value rather than the object.
const q = (r: Rational) => `${r.numerator}/${r.denominator}`;

describe('Closed lifecycle and Terminal Disposition AC-LIFE-001', () => {
  it('should expect Closed with terminal time Tuesday 14:00 and Terminal Disposition Executions 100 shares after X2, and Open with Terminal Disposition NotApplicable NotClosed after X1', () => {
    // A stored Closed lifecycle agrees with the facts after X2 (ocr finding 1: a Position of 0 used to derive Open).
    const afterX2 = derivedState(referenceRecord([PC1, PC2, X1, X2], 'Closed'));
    expect(afterX2.expectedLifecycle).toBe('Closed');
    expect(afterX2.agreement).toEqual({ kind: 'Agrees' });
    expect(afterX2.findings).toEqual([]);
    expect(afterX2.terminalTime).toBe('2026-10-13T18:00:00Z');
    expect(
      afterX2.terminalDisposition.kind === 'Value'
        ? afterX2.terminalDisposition.value.map((d) => [d.mechanism, q(d.quantity)])
        : afterX2.terminalDisposition,
    ).toEqual([['Executions', '100/1']]);

    // A stored Open lifecycle on the same facts is a disagreement, not the expectation.
    expect(derivedState(referenceRecord([PC1, PC2, X1, X2], 'Open')).agreement).toEqual({
      kind: 'LifecycleDisagreement',
      stored: 'Open',
      expected: 'Closed',
    });

    const afterX1 = derivedState(referenceRecord([PC1, PC2, X1]));
    expect(afterX1.expectedLifecycle).toBe('Open');
    expect(afterX1.terminalTime).toBeNull();
    expect(afterX1.terminalDisposition).toEqual({ kind: 'NotApplicable', reason: 'NotClosed' });
  });
});

describe('Realized R', () => {
  it('should report Realized R 124/125 for the Closed reference Trade, and NotApplicable NotClosed after X1', () => {
    const closed = derivedState(referenceRecord([PC1, PC2, X1, X2], 'Closed'));
    expect(closed.realizedR.kind === 'Value' ? q(closed.realizedR.value) : closed.realizedR).toBe('124/125');
    expect(derivedState(referenceRecord([PC1, PC2, X1])).realizedR).toEqual({ kind: 'NotApplicable', reason: 'NotClosed' });
  });
});

describe('close requirement A77', () => {
  it('should report for a candidate whether its new Position Change is terminal and carries trader agency: TerminalWithAgency for X2, NotTerminal for X1', () => {
    const digest = 'a'.repeat(64);
    const closeRequirement = (before: TradeAnalysisRecord, candidate: TradeAnalysisRecord) => {
      const result = derive({ record: candidate, candidate: { digest, before } });
      if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${JSON.stringify(result)}`);
      return result.reconciliation?.closeRequirement;
    };
    expect(closeRequirement(referenceRecord([PC1, PC2, X1]), referenceRecord([PC1, PC2, X1, X2]))).toBe('TerminalWithAgency');
    expect(closeRequirement(referenceRecord([PC1, PC2]), referenceRecord([PC1, PC2, X1]))).toBe('NotTerminal');
  });
});

describe('position paths P22', () => {
  const incoherent = (result: DerivationResult) => {
    if (result.kind !== 'IncoherentFacts') throw new Error(`expected IncoherentFacts, got ${result.kind}`);
    return result.findings.map((f) => ({ ...f, ...('available' in f && { available: q(f.available) }) }));
  };
  const sell = (quantity: string, at: string, sequence: number) =>
    positionChange('pc-s', sequence, [sellExecution('ex-s', at, sequence + 1, quantity, '52.00', '0.60')]);

  it('should return ExceedsOpenQuantity naming the available quantity for a Sell of 101 after PC2 available 100 and for a Sell of 70 dated Monday 10:30 available 60 at that time', () => {
    // ocr finding 2: a Sell beyond the open quantity used to drop its remainder and still derive.
    expect(incoherent(derive({ record: referenceRecord([PC1, PC2, sell('101', '2026-10-13T14:00:00Z', 7)]) }))).toEqual([
      { factId: 'ex-s', reason: 'ExceedsOpenQuantity', available: '100/1' },
    ]);
    expect(incoherent(derive({ record: referenceRecord([PC1, PC2, sell('70', '2026-10-12T14:30:00Z', 7)]) }))).toEqual([
      { factId: 'ex-s', reason: 'ExceedsOpenQuantity', available: '60/1' },
    ]);
  });

  it('should return FlatBeforeLaterFacts for a Sell of 60 dated Monday 10:30, which leaves the Position flat before PC2 at 11:00', () => {
    expect(incoherent(derive({ record: referenceRecord([PC1, PC2, sell('60', '2026-10-12T14:30:00Z', 7)]) }))).toEqual([
      { factId: 'ex-s', reason: 'FlatBeforeLaterFacts' },
    ]);
  });
});
