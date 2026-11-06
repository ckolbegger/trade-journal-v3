import { describe, expect, it } from 'vitest';
import { Rational } from '../values/index.ts';
import { derive, type DerivationResult, type DerivedTradeState, type TradeAnalysisRecord } from './index.ts';
import { OC_PC1, OC_PC2, OC_X1, OS_B1, OS_S1, ocChange, ocRecord, osChange, osRecord } from './option-trade.ts';

function derivedState(record: TradeAnalysisRecord): DerivedTradeState {
  const result = derive({ record });
  if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${result.kind}: ${result.findings.map((f) => f.reason).join(', ')}`);
  return result;
}

// A Rational as an exact fraction in lowest terms, so a failure names the value.
const frac = (r: Rational) => `${r.numerator}/${r.denominator}`;
const money = (cents: bigint) => frac(Rational.of(cents, 100n));
const exact = (result: { kind: string; value?: Rational }) => (result.kind === 'Value' ? frac(result.value!) : result);

describe('option Lots and FIFO with the multiplier (A102, A104)', () => {
  it('should derive O-C after X1 as Position 1 contract, Lot Match PC1 ← X1 realizing 88.70, and the remaining Lot PC2 1 @ 1.90 with fee 0.65', () => {
    const state = derivedState(ocRecord([OC_PC1, OC_PC2, OC_X1]));
    expect(state.positions.map((p) => frac(p.quantity))).toEqual(['1/1']);
    expect(state.lotMatches).toEqual([{ openingExecutionId: 'ex-pc-1', disposingExecutionId: 'ex-pc-x1', quantity: Rational.of(1n), policy: 'FIFO' }]);
    expect(state.lotMatchResults.map((m) => exact(m.realized))).toEqual([money(8870n)]);
    expect(state.positions[0]!.openLots.map((l) => [l.openingExecutionId, frac(l.quantity), frac(l.price), frac(l.unconsumedOpeningFee)])).toEqual([
      ['ex-pc-2', '1/1', frac(Rational.of(190n, 100n)), frac(Rational.of(65n, 100n))],
    ]);
  });

  it("should derive O-S's short Lot −2 @ 1.25 with fee 1.30 and, after B1, Lot Match S1 ← B1 realizing 63.70, with the remaining short Lot of 1 keeping fee 0.65", () => {
    const lot = (state: DerivedTradeState) =>
      state.positions[0]!.openLots.map((l) => [l.openingExecutionId, frac(l.quantity), frac(l.price), frac(l.unconsumedOpeningFee)]);
    const opened = derivedState(osRecord([OS_S1]));
    expect(lot(opened)).toEqual([['ex-pc-s1', '-2/1', frac(Rational.of(125n, 100n)), frac(Rational.of(130n, 100n))]]);
    const closed = derivedState(osRecord([OS_S1, OS_B1]));
    expect(closed.lotMatchResults.map((m) => [m.openingExecutionId, m.disposingExecutionId, exact(m.realized)])).toEqual([['ex-pc-s1', 'ex-pc-b1', money(6370n)]]);
    expect(lot(closed)).toEqual([['ex-pc-s1', '-1/1', frac(Rational.of(125n, 100n)), frac(Rational.of(65n, 100n))]]);
    expect(closed.expectedLifecycle).toBe('Open');
  });
});

describe('Entry Quality for options (A105)', () => {
  const quality = (record: TradeAnalysisRecord) => {
    const q = derivedState(record).entryQuality;
    if (q.kind !== 'Value') throw new Error(`expected resolved Entry Quality, got ${JSON.stringify(q)}`);
    return q.value;
  };

  it('should resolve O-C at PC2 with risk 401.30, reward 598.70, slippage 0.00, size ratio 1, and risk 4013/4000 R, and O-S at S1 with risk 351.30, reward 248.70, and slippage −10.00', () => {
    const oc = derivedState(ocRecord([OC_PC1, OC_PC2]));
    expect(oc.entryResolution).toEqual({ kind: 'Resolved', positionChangeId: 'pc-2' });
    const c = quality(ocRecord([OC_PC1, OC_PC2]));
    expect(exact(c.actualInitialRisk)).toBe(money(40130n));
    expect(exact(c.actualInitialReward)).toBe(money(59870n));
    expect(exact(c.slippage)).toBe('0/1');
    expect(exact(c.sizeRatio)).toBe('1/1');
    expect(exact(c.riskInPlanR)).toBe('4013/4000');

    const os = derivedState(osRecord([OS_S1]));
    expect(os.entryResolution).toEqual({ kind: 'Resolved', positionChangeId: 'pc-s1' });
    const s = quality(osRecord([OS_S1]));
    expect(exact(s.actualInitialRisk)).toBe(money(35130n));
    expect(exact(s.actualInitialReward)).toBe(money(24870n));
    expect(exact(s.slippage)).toBe('-10/1');
    expect(exact(s.sizeRatio)).toBe('1/1');
  });
});

// The findings of an incoherent result, with `available` as an exact fraction.
const findingsOf = (result: DerivationResult) => {
  if (result.kind !== 'IncoherentFacts') throw new Error(`expected IncoherentFacts, got ${result.kind}`);
  return result.findings.map((f) => ({ factId: f.factId, reason: f.reason, ...('available' in f && { available: frac(f.available) }) }));
};

describe('position paths for both roles (A103)', () => {
  it('should return ExceedsOpenQuantity 2 for a Buy 3 after S1 and ExceedsOpenQuantity 0 for a Buy dated Monday 09:45 before S1, and FlatBeforeLaterFacts for a Buy 2 dated Monday 10:30 when a Sell 1 is dated Monday 11:00', () => {
    const buy3 = osChange('pc-b3', '2026-10-13T14:00:00Z', 3, 'Buy', '3', '0.60', '0.65');
    expect(findingsOf(derive({ record: osRecord([OS_S1, buy3]) }))).toEqual([{ factId: 'ex-pc-b3', reason: 'ExceedsOpenQuantity', available: '2/1' }]);
    const early = osChange('pc-early', '2026-10-12T13:45:00Z', 3, 'Buy', '1', '0.60', '0.65');
    expect(findingsOf(derive({ record: osRecord([OS_S1, early]) }))).toEqual([{ factId: 'ex-pc-early', reason: 'ExceedsOpenQuantity', available: '0/1' }]);
    const flat = osChange('pc-flat', '2026-10-12T14:30:00Z', 3, 'Buy', '2', '0.60', '0.65');
    const later = osChange('pc-later', '2026-10-12T15:00:00Z', 5, 'Sell', '1', '1.25', '0.65');
    expect(findingsOf(derive({ record: osRecord([OS_S1, flat, later]) }))).toEqual([{ factId: 'ex-pc-flat', reason: 'FlatBeforeLaterFacts' }]);
  });

  it('should return AfterExpiration for an Execution dated 2026-11-23 and ContractQuantityNotWhole for 1.5 contracts', () => {
    const late = ocChange('pc-late', '2026-11-23T15:00:00Z', 3, 'Buy', '1', '1.90', '0.65');
    expect(findingsOf(derive({ record: ocRecord([late]) }))).toEqual([{ factId: 'ex-pc-late', reason: 'AfterExpiration' }]);
    const half = ocChange('pc-half', '2026-10-12T14:00:00Z', 1, 'Buy', '1.5', '2.10', '0.65');
    expect(findingsOf(derive({ record: ocRecord([half]) }))).toEqual([{ factId: 'ex-pc-half', reason: 'ContractQuantityNotWhole' }]);
  });
});
