import { describe, expect, it } from 'vitest';
import { Rational } from '../values/index.ts';
import { derive, type DerivationResult, type DerivedTradeState, type TradeAnalysisRecord } from './index.ts';
import { EXPIRATION_CLOSE, OC_CONTRACT, OC_E1, OC_PC1, OC_PC2, OC_X1, OS_B1, OS_CONTRACT, OS_ES, OS_S1, expirationChange, ocChange, ocRecord, opChange, opRecord, osRecord } from './option-trade.ts';
import { PC1, PC2, X1, X2, referenceRecord } from './reference-trade.ts';

function derivedState(record: TradeAnalysisRecord): DerivedTradeState {
  const result = derive({ record });
  if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${result.kind}: ${result.findings.map((f) => f.reason).join(', ')}`);
  return result;
}

const frac = (r: Rational) => `${r.numerator}/${r.denominator}`;
const exact = (result: { kind: string; value?: Rational }) => (result.kind === 'Value' ? frac(result.value!) : result);

describe('Expiration member (A106, P26)', () => {
  it("should consume O-C's remaining Lot with E1 as Lot Match PC2 ← E1 realizing −190.65, with no price or fee on the settlement fact, and expect Closed with terminal time Friday 16:00, realized −101.95, and Realized R −2039/8000", () => {
    const record = ocRecord([OC_PC1, OC_PC2, OC_X1, OC_E1]);
    const state = derivedState(record);
    expect(state.lotMatches.slice(1)).toEqual([{ openingExecutionId: 'ex-pc-2', disposingExecutionId: 'exp-pc-e1', quantity: Rational.of(1n), policy: 'FIFO' }]);
    expect(state.lotMatchResults.slice(1).map((m) => exact(m.realized))).toEqual([frac(Rational.of(-19065n, 100n))]);
    const settlement = record.positionChanges[3]!.settlements![0]!;
    expect('price' in settlement || 'fee' in settlement).toBe(false);
    expect(frac(state.fees.incurred)).toBe(frac(Rational.of(195n, 100n)));
    expect(state.expectedLifecycle).toBe('Closed');
    expect(state.terminalTime).toBe('2026-11-20T21:00:00Z');
    expect(frac(state.realizedToDate)).toBe(frac(Rational.of(-10195n, 100n)));
    expect(exact(state.realizedR)).toBe('-2039/8000');
  });

  it("should return ExpirationMustSettleAllOpen for 1 of O-S's 2 contracts, SettlementTimeInvalid for a settlement time dated 2026-11-23 or before an Execution on the contract, and NotAnOption for an Expiration on XYZ stock", () => {
    const findings = (record: TradeAnalysisRecord) => {
      const result: DerivationResult = derive({ record });
      if (result.kind !== 'IncoherentFacts') throw new Error(`expected IncoherentFacts, got ${result.kind}`);
      return result.findings.map((f) => ({ factId: f.factId, kind: f.kind, reason: f.reason, ...('available' in f && { available: frac(f.available) }) }));
    };
    const partial = expirationChange('pc-part', EXPIRATION_CLOSE, 3, OS_CONTRACT, '1');
    expect(findings(osRecord([OS_S1, partial]))).toEqual([{ factId: 'exp-pc-part', kind: 'Expiration', reason: 'ExpirationMustSettleAllOpen', available: '2/1' }]);
    const late = expirationChange('pc-late', '2026-11-23T21:00:00Z', 3, OS_CONTRACT, '2');
    expect(findings(osRecord([OS_S1, late]))).toEqual([{ factId: 'exp-pc-late', kind: 'Expiration', reason: 'SettlementTimeInvalid' }]);
    const early = expirationChange('pc-early', '2026-10-12T13:00:00Z', 3, OS_CONTRACT, '2');
    expect(findings(osRecord([OS_S1, early]))).toEqual([{ factId: 'exp-pc-early', kind: 'Expiration', reason: 'SettlementTimeInvalid' }]);
    const stock = expirationChange('pc-stock', EXPIRATION_CLOSE, 3, { kind: 'Stock', symbol: 'XYZ' }, '100');
    expect(findings(ocRecord([OC_PC1, stock]))).toEqual([{ factId: 'exp-pc-stock', kind: 'Expiration', reason: 'NotAnOption' }]);
  });

  it('should return DuplicateFactId for an Expiration that reuses an Execution fact id, rather than a Derived state', () => {
    const clash = expirationChange('pc-clash', EXPIRATION_CLOSE, 5, OS_CONTRACT, '1');
    const reused = { ...clash, settlements: clash.settlements!.map((s) => ({ ...s, factId: 'ex-pc-b1' })) };
    const result: DerivationResult = derive({ record: osRecord([OS_S1, OS_B1, reused]) });
    if (result.kind !== 'IncoherentFacts') throw new Error(`expected IncoherentFacts, got ${result.kind}`);
    expect(result.findings.map((f) => ({ factId: f.factId, kind: f.kind, reason: f.reason }))).toEqual([{ factId: 'ex-pc-b1', kind: 'Expiration', reason: 'DuplicateFactId' }]);
  });

  it('should return NonpositiveQuantity for a zero or negative Expiration quantity after the position is flat, rather than a Derived state', () => {
    for (const quantity of ['0', '-1']) {
      const settle = expirationChange('pc-zero', EXPIRATION_CLOSE, 7, OC_CONTRACT, quantity);
      const result: DerivationResult = derive({ record: ocRecord([OC_PC1, OC_X1, settle]) });
      if (result.kind !== 'IncoherentFacts') throw new Error(`expected IncoherentFacts, got ${result.kind}`);
      expect(result.findings.map((f) => ({ factId: f.factId, kind: f.kind, reason: f.reason }))).toEqual([{ factId: 'exp-pc-zero', kind: 'Expiration', reason: 'NonpositiveQuantity' }]);
    }
  });

  it('should report the close requirement TerminalWithoutAgency for E1, where X2 in D6 is TerminalWithAgency A107', () => {
    const digest = 'a'.repeat(64);
    const closeRequirement = (before: TradeAnalysisRecord, candidate: TradeAnalysisRecord) => {
      const result = derive({ record: candidate, candidate: { digest, before } });
      if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${JSON.stringify(result)}`);
      return result.reconciliation?.closeRequirement;
    };
    const before = ocRecord([OC_PC1, OC_PC2, OC_X1]);
    expect(closeRequirement(before, ocRecord([OC_PC1, OC_PC2, OC_X1, OC_E1]))).toBe('TerminalWithoutAgency');
    const sellLast = ocChange('pc-x2', '2026-11-19T15:00:00Z', 7, 'Sell', '1', '3.50', '0.65');
    expect(closeRequirement(before, ocRecord([OC_PC1, OC_PC2, OC_X1, sellLast]))).toBe('TerminalWithAgency');
  });
});

describe('Terminal Disposition and Option Disposition Timing (A108)', () => {
  const mechanisms = (state: DerivedTradeState) => {
    if (state.terminalDisposition.kind !== 'Value') throw new Error(`expected a Terminal Disposition, got ${JSON.stringify(state.terminalDisposition)}`);
    return state.terminalDisposition.value.map((m) => `${m.mechanism}: ${frac(m.quantity)}`);
  };
  const timing = (state: DerivedTradeState) => {
    const t = state.optionDispositionTiming;
    if (t.kind !== 'Value') throw new Error(`expected a timing, got ${JSON.stringify(t)}`);
    return [t.value.timing, frac(t.value.disposedByExecutions), frac(t.value.disposedBySettlement)];
  };

  it("should derive O-C as Executions 1 contract and Expiration 1 contract with Mixed 1 and 1, O-S after E-S as Expiration 2 contracts and FullyHeldToExpirationSettlement with Realized R 829/1200, and O-P after Q1 on the expiration date as FullyDisposedPreExpiration, with Open option Trades and T-A NotApplicable", () => {
    const mixed = derivedState(ocRecord([OC_PC1, OC_PC2, OC_X1, OC_E1]));
    expect(mechanisms(mixed)).toEqual(['Executions: 1/1', 'Expiration: 1/1']);
    expect(timing(mixed)).toEqual(['Mixed', '1/1', '1/1']);

    const held = derivedState(osRecord([OS_S1, OS_ES]));
    expect(mechanisms(held)).toEqual(['Expiration: 2/1']);
    expect(timing(held)).toEqual(['FullyHeldToExpirationSettlement', '0/1', '2/1']);
    expect(exact(held.realizedR)).toBe('829/1200');

    const bought = opChange('pc-p1', '2026-10-12T14:00:00Z', 1, 'Buy', '1', '1.50', '0.65');
    const q1 = opChange('pc-q1', '2026-11-20T15:00:00Z', 3, 'Sell', '1', '0.80', '0.65');
    const pre = derivedState(opRecord([bought, q1]));
    expect(mechanisms(pre)).toEqual(['Executions: 1/1']);
    expect(timing(pre)).toEqual(['FullyDisposedPreExpiration', '1/1', '0/1']);

    expect(derivedState(ocRecord([OC_PC1, OC_PC2])).optionDispositionTiming).toEqual({ kind: 'NotApplicable', reason: 'NotClosed' });
    expect(derivedState(osRecord([OS_S1])).optionDispositionTiming).toEqual({ kind: 'NotApplicable', reason: 'NotClosed' });
    expect(derivedState(referenceRecord([PC1, PC2, X1, X2], 'Closed')).optionDispositionTiming).toEqual({ kind: 'NotApplicable', reason: 'NoOptionExpirationAnchor' });
  });
});
