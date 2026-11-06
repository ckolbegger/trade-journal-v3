import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/index.ts';
import { Rational } from '../values/index.ts';
import { derive, type CalculationResult, type DerivedTradeState, type TradeAnalysisRecord } from './index.ts';
import { evaluate, type ConditionStatus, type ObservationFrame } from './evaluate.ts';
import { OC_CONTRACT, OC_PC1, OC_PC2, OP_CONTRACT, OS_CONTRACT, OS_ES, OS_S1, OC_X1, ocChange, ocRecord, opChange, opRecord, osRecord } from './option-trade.ts';
import { PC1, PC2, referenceRecord } from './reference-trade.ts';

const XYZ = { kind: 'Stock', symbol: 'XYZ' } as const;
const ABC = { kind: 'Stock', symbol: 'ABC' } as const;
const MNO = { kind: 'Stock', symbol: 'MNO' } as const;
// Monday 2026-10-12 closes at 20:00Z.
const MONDAY_CLOSE = '2026-10-12T20:00:00Z';

function derivedState(record: TradeAnalysisRecord): DerivedTradeState {
  const result = derive({ record });
  if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${JSON.stringify(result)}`);
  return result;
}

function frameOf(instrument: Instrument, price: string, tradingDate = '2026-10-12', closeInstant = MONDAY_CLOSE): ObservationFrame {
  return { instrument, tradingDate, closeInstant, resolution: { kind: 'Available', mark: { revisionId: 'mark-rev-1', revisionNumber: 1, price } } };
}

const frac = (r: Rational) => `${r.numerator}/${r.denominator}`;
const q = (n: bigint, d = 1n) => frac(Rational.of(n, d));
function exact(result: CalculationResult<Rational>) {
  return result.kind === 'Value' ? frac(result.value) : result;
}

// A condition's reading, or the result itself when it holds no number.
function reading(condition: ConditionStatus) {
  if (condition.result.kind !== 'Value') return condition.result;
  const r = condition.result.value;
  return {
    status: r.status,
    risk: frac(r.distance.dollars),
    overrun: r.overrun ? { dollars: frac(r.overrun.dollars), planR: frac(r.overrun.planR) } : null,
    underlying: r.underlying && { distance: frac(r.underlying.distance), beyond: r.underlying.beyond ? frac(r.underlying.beyond) : null },
  };
}

describe('option valuation (A109)', () => {
  it('should value O-C after PC2 at a call Mark of 2.40 as market value $480.00, remaining-open marked P&L $78.70 (787/4000 R), and incurred fees $1.30, and O-S after S1 at a put Mark of 0.80 as $88.70 with the short sign', () => {
    const call = evaluate({ state: derivedState(ocRecord([OC_PC1, OC_PC2])), frame: frameOf(OC_CONTRACT, '2.40'), underlyingFrame: frameOf(XYZ, '52.00') });
    expect(exact(call.marketValue)).toBe(q(480n));
    expect(exact(call.remainingOpenPnl)).toBe(q(7870n, 100n));
    expect(exact(call.currentMarkedPnlInPlanR)).toBe(q(787n, 4000n));
    expect(exact(call.incurredFees)).toBe(q(130n, 100n));
    const put = evaluate({ state: derivedState(osRecord([OS_S1])), frame: frameOf(OS_CONTRACT, '0.80'), underlyingFrame: frameOf(MNO, '47.00') });
    expect(exact(put.marketValue)).toBe(q(-160n));
    expect(exact(put.remainingOpenPnl)).toBe(q(8870n, 100n));
    expect(exact(put.currentMarkedPnl)).toBe(q(8870n, 100n));
  });
});

describe('risk and reward against the values at expiration (P24, A109)', () => {
  it('should return for O-C at 2.40 with XYZ 52.00 Risk to Stop $480.00 (6/5 R), Worst-Case $480.00, Reward to Target $520.00 (13/10 R), Maximum Unbounded(Above), and both conditions not crossed with Underlying distances 4.00 and 8.00', () => {
    const e = evaluate({ state: derivedState(ocRecord([OC_PC1, OC_PC2])), frame: frameOf(OC_CONTRACT, '2.40'), underlyingFrame: frameOf(XYZ, '52.00') });
    expect(exact(e.ongoingRiskToStop)).toBe(q(480n));
    expect(exact(e.ongoingRiskToStopInPlanR)).toBe(q(6n, 5n));
    expect(exact(e.worstCaseOngoingRisk)).toBe(q(480n));
    expect(exact(e.incrementalRewardToTarget)).toBe(q(520n));
    expect(exact(e.incrementalRewardToTargetInPlanR)).toBe(q(13n, 10n));
    expect(e.maximumIncrementalReward).toMatchObject({ kind: 'Unbounded', direction: 'Above' });
    expect(e.conditions.map(reading)).toEqual([
      { status: 'Active', risk: q(480n), overrun: null, underlying: { distance: q(4n), beyond: null } },
      { status: 'Active', risk: q(520n), overrun: null, underlying: { distance: q(8n), beyond: null } },
    ]);
  });

  it('should return for O-S at 0.80 with MNO 47.00 Risk to Stop $440.00 (11/9 R), Worst-Case $8,840.00, Reward to Target $160.00, and Maximum $160.00, and for O-P at 1.80 with ABC 49.00 Maximum $4,820.00', () => {
    const put = evaluate({ state: derivedState(osRecord([OS_S1])), frame: frameOf(OS_CONTRACT, '0.80'), underlyingFrame: frameOf(MNO, '47.00') });
    expect(exact(put.ongoingRiskToStop)).toBe(q(440n));
    expect(exact(put.ongoingRiskToStopInPlanR)).toBe(q(11n, 9n));
    expect(exact(put.worstCaseOngoingRisk)).toBe(q(8840n));
    expect(exact(put.incrementalRewardToTarget)).toBe(q(160n));
    expect(exact(put.maximumIncrementalReward)).toBe(q(160n));
    expect(put.conditions.map(reading).map((c) => ('status' in c ? c.status : c))).toEqual(['Active', 'Active']);
    const longPut = evaluate({ state: derivedState(opRecord([opChange('pc-p1', '2026-10-12T14:00:00Z', 1, 'Buy', '1', '1.50', '0.65')])), frame: frameOf(OP_CONTRACT, '1.80'), underlyingFrame: frameOf(ABC, '49.00') });
    expect(exact(longPut.maximumIncrementalReward)).toBe(q(4820n));
    expect(longPut.conditions.map(reading).map((c) => ('status' in c ? c.status : c))).toEqual(['Active', 'Active']);
  });

  it("should report O-C's Stop Breached at XYZ 47.50 with the call at 0.90 (Risk to Stop $0.00, Stop Overrun $0.00, Underlying 0.50 beyond), and O-S's Stop Breached at MNO 41.50 with the put at 3.80 (Risk to Stop $0.00, Stop Overrun $160.00 or 4/9 R)", () => {
    const call = evaluate({ state: derivedState(ocRecord([OC_PC1, OC_PC2])), frame: frameOf(OC_CONTRACT, '0.90'), underlyingFrame: frameOf(XYZ, '47.50') });
    expect(exact(call.ongoingRiskToStop)).toBe(q(0n));
    expect(reading(call.conditions[0]!)).toEqual({
      status: 'Breached',
      risk: q(0n),
      overrun: { dollars: q(0n), planR: q(0n) },
      underlying: { distance: q(0n), beyond: q(1n, 2n) },
    });
    const put = evaluate({ state: derivedState(osRecord([OS_S1])), frame: frameOf(OS_CONTRACT, '3.80'), underlyingFrame: frameOf(MNO, '41.50') });
    expect(exact(put.ongoingRiskToStop)).toBe(q(0n));
    expect(reading(put.conditions[0]!)).toEqual({
      status: 'Breached',
      risk: q(0n),
      overrun: { dollars: q(160n), planR: q(4n, 9n) },
      underlying: { distance: q(0n), beyond: q(1n, 2n) },
    });
  });
});

// Friday 2026-11-20 closes at 21:00Z (16:00 New York).
const FRIDAY_CLOSE = '2026-11-20T21:00:00Z';
const missingFrame = (instrument: Instrument, tradingDate: string, closeInstant: string): ObservationFrame => ({ instrument, tradingDate, closeInstant, resolution: { kind: 'Missing' } });

describe('evidence requirements and availability (A110, P27)', () => {
  it("should require both the call's and XYZ's exact Marks for frame 2026-11-20, and with XYZ Missing return condition status, Risk to Stop, and Reward to Target as Unavailable(MarkMissing XYZ) while valuation, Worst-Case, and Maximum stay Values", () => {
    const record = ocRecord([OC_PC1, OC_PC2]);
    const requirements = derive({ record, valuationDate: '2026-11-20' });
    if (requirements.kind !== 'Derived') throw new Error('expected Derived');
    expect(requirements.observationRequirements).toEqual([
      { instrument: OC_CONTRACT, valuationDate: '2026-11-20', earliestRelevance: OC_PC1.economicTime },
      { instrument: XYZ, valuationDate: '2026-11-20', earliestRelevance: OC_PC1.economicTime },
    ]);
    const e = evaluate({
      state: derivedState(record),
      frame: frameOf(OC_CONTRACT, '2.40', '2026-11-20', FRIDAY_CLOSE),
      underlyingFrame: missingFrame(XYZ, '2026-11-20', FRIDAY_CLOSE),
    });
    const missing = { kind: 'Unavailable', reason: 'MarkMissing', instrument: XYZ, date: '2026-11-20' };
    expect(e.conditions.map((c) => c.result)).toEqual([missing, missing]);
    expect(e.ongoingRiskToStop).toEqual(missing);
    expect(e.incrementalRewardToTarget).toEqual(missing);
    expect(exact(e.marketValue)).toBe(q(480n));
    expect(exact(e.worstCaseOngoingRisk)).toBe(q(480n));
    expect(e.maximumIncrementalReward.kind).toBe('Unbounded');
  });

  it('should evaluate a call Mark of exactly 0 as marked P&L −$401.30, Worst-Case $0.00, and Risk to Stop $0.00', () => {
    const e = evaluate({ state: derivedState(ocRecord([OC_PC1, OC_PC2])), frame: frameOf(OC_CONTRACT, '0'), underlyingFrame: frameOf(XYZ, '52.00') });
    expect(exact(e.currentMarkedPnl)).toBe(q(-40130n, 100n));
    expect(exact(e.worstCaseOngoingRisk)).toBe(q(0n));
    expect(exact(e.ongoingRiskToStop)).toBe(q(0n));
  });
});

// Monday 2026-11-23 and Thursday 2026-11-19 close at 21:00Z.
const NEXT_MONDAY_CLOSE = '2026-11-23T21:00:00Z';
const THURSDAY_CLOSE = '2026-11-19T21:00:00Z';

describe('Settlement Due (P25, A111)', () => {
  it('should return O-S as Due (2 contracts short, 2026-11-20) for frames 2026-11-20 and 2026-11-23, with normal figures on 2026-11-20 and, on 2026-11-23, no requirement and every current figure Unavailable(SettlementDue); NotYetDue for 2026-11-19; and nothing after E-S', () => {
    const record = osRecord([OS_S1]);
    const state = derivedState(record);
    const evaluateOn = (date: string, close: string) =>
      evaluate({ state, frame: missingFrame(OS_CONTRACT, date, close), underlyingFrame: missingFrame(MNO, date, close) });
    const item = (status: 'Due' | 'NotYetDue') => [{ instrument: OS_CONTRACT, quantity: q(-2n), expiration: '2026-11-20', status }];
    const items = (e: ReturnType<typeof evaluate>) => e.settlement.map((s) => ({ ...s, quantity: frac(s.quantity) }));
    expect(items(evaluateOn('2026-11-19', THURSDAY_CLOSE))).toEqual(item('NotYetDue'));
    const onExpiration = evaluate({ state, frame: frameOf(OS_CONTRACT, '0.50', '2026-11-20', FRIDAY_CLOSE), underlyingFrame: frameOf(MNO, '47.00', '2026-11-20', FRIDAY_CLOSE) });
    expect(items(onExpiration)).toEqual(item('Due'));
    expect(exact(onExpiration.marketValue)).toBe(q(-100n));
    expect(exact(onExpiration.ongoingRiskToStop)).toBe(q(500n));
    const requirementsOn = (valuationDate: string) => {
      const derived = derive({ record, valuationDate });
      if (derived.kind !== 'Derived') throw new Error('expected Derived');
      return derived.observationRequirements;
    };
    expect(requirementsOn('2026-11-20').map((r) => r.instrument)).toEqual([OS_CONTRACT, MNO]);
    expect(requirementsOn('2026-11-23')).toEqual([]);
    const after = evaluateOn('2026-11-23', NEXT_MONDAY_CLOSE);
    expect(items(after)).toEqual(item('Due'));
    const due = { kind: 'Unavailable', reason: 'SettlementDue', instrument: OS_CONTRACT, expiration: '2026-11-20' };
    expect(after.marketValue).toEqual(due);
    expect(after.remainingOpenPnl).toEqual(due);
    expect(after.currentMarkedPnl).toEqual(due);
    expect(after.ongoingRiskToStop).toEqual(due);
    expect(after.worstCaseOngoingRisk).toEqual(due);
    expect(after.incrementalRewardToTarget).toEqual(due);
    expect(after.maximumIncrementalReward).toEqual(due);
    expect(after.conditions.map((c) => c.result)).toEqual([due, due]);
    const expired = evaluate({ state: derivedState(osRecord([OS_S1, OS_ES])), frame: missingFrame(OS_CONTRACT, '2026-11-23', NEXT_MONDAY_CLOSE) });
    expect(expired.settlement).toEqual([]);
  });
});

describe('value at expiration at the latest close (P24, A122)', () => {
  it("should return O-C's Current payoff read at XYZ's frame Mark as −$401.30 at 52.00, Unavailable(MarkMissing XYZ) without it, and NotApplicable for T-A and for a flat Trade", () => {
    const open = derivedState(ocRecord([OC_PC1, OC_PC2]));
    const withMark = evaluate({ state: open, frame: frameOf(OC_CONTRACT, '2.40'), underlyingFrame: frameOf(XYZ, '52.00') });
    const result = withMark.expirationValueAtUnderlyingClose;
    expect(result.kind === 'Value' && { underlyingPrice: frac(result.value.underlyingPrice), value: frac(result.value.value) }).toEqual({ underlyingPrice: q(52n), value: q(-4013n, 10n) });
    const without = evaluate({ state: open, frame: frameOf(OC_CONTRACT, '2.40'), underlyingFrame: missingFrame(XYZ, '2026-10-12', MONDAY_CLOSE) });
    expect(without.expirationValueAtUnderlyingClose).toEqual({ kind: 'Unavailable', reason: 'MarkMissing', instrument: XYZ, date: '2026-10-12' });
    const stock = evaluate({ state: derivedState(referenceRecord([PC1, PC2])), frame: frameOf(XYZ, '52.00') });
    expect(stock.expirationValueAtUnderlyingClose).toEqual({ kind: 'NotApplicable', reason: 'NoOptionExpirationAnchor' });
    const flat = evaluate({ state: derivedState(ocRecord([OC_PC1, OC_X1])), frame: frameOf(OC_CONTRACT, '2.40'), underlyingFrame: frameOf(XYZ, '52.00') });
    expect(flat.expirationValueAtUnderlyingClose).toEqual({ kind: 'NotApplicable', reason: 'NoRemainingPosition' });
  });
});

describe('at-entry line for options (A110, decision 26)', () => {
  it('should return at-entry risk $190.00 and reward $310.00 for PC2 dated Tuesday 10:00 under Monday\'s frame', () => {
    const tuesdayPc2 = ocChange('pc-2', '2026-10-13T14:00:00Z', 3, 'Buy', '1', '1.90', '0.65');
    const e = evaluate({ state: derivedState(ocRecord([OC_PC1, tuesdayPc2])), frame: frameOf(OC_CONTRACT, '2.40'), underlyingFrame: frameOf(XYZ, '52.00') });
    expect(e.marketValue).toEqual({ kind: 'Unavailable', reason: 'AwaitingClose', after: '2026-10-12' });
    expect(e.atEntry && { quantity: frac(e.atEntry.quantity), averageEntry: frac(e.atEntry.averageEntry), risk: frac(e.atEntry.riskFromEntry), reward: frac(e.atEntry.rewardFromEntry) }).toEqual({
      quantity: q(1n),
      averageEntry: q(19n, 10n),
      risk: q(190n),
      reward: q(310n),
    });
  });
});
