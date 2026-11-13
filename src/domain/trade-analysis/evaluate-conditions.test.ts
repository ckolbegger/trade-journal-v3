import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/index.ts';
import { Rational } from '../values/index.ts';
import { derive, type CalculationResult, type DerivedTradeState, type TradeAnalysisRecord } from './index.ts';
import { evaluate, type ConditionStatus, type ObservationFrame } from './evaluate.ts';
import { NVDA_CALL, OC2_CONTRACT, OC2_P1, OS2_CONTRACT, OS2_S1, OS_LEG_ID, nvdaRecord, oc2Record, optionExecution, os2Record } from './option-trade.ts';
import { positionChange } from './reference-trade.ts';

const XYZ = { kind: 'Stock', symbol: 'XYZ' } as const;
const MNO = { kind: 'Stock', symbol: 'MNO' } as const;
// Closes at 16:00 New York (20:00Z) on Monday 10-12 to Thursday 10-15.
const CLOSE: Record<string, string> = {
  '2026-10-12': '2026-10-12T20:00:00Z',
  '2026-10-13': '2026-10-13T20:00:00Z',
  '2026-10-14': '2026-10-14T20:00:00Z',
  '2026-10-15': '2026-10-15T20:00:00Z',
};

function derivedState(record: TradeAnalysisRecord, valuationDate: string): DerivedTradeState {
  const result = derive({ record, valuationDate });
  if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${JSON.stringify(result)}`);
  return result;
}

function frameOf(instrument: Instrument, date: string, price?: string): ObservationFrame {
  const closeInstant = CLOSE[date]!;
  return price === undefined
    ? { instrument, tradingDate: date, closeInstant, resolution: { kind: 'Missing' } }
    : { instrument, tradingDate: date, closeInstant, resolution: { kind: 'Available', mark: { revisionId: `mark-${instrument.kind}`, revisionNumber: 1, price } } };
}

const frac = (r: Rational) => `${r.numerator}/${r.denominator}`;
const q = (n: bigint, d = 1n) => frac(Rational.of(n, d));
const exact = (result: CalculationResult<Rational>) => (result.kind === 'Value' ? frac(result.value) : result);

// A condition's reading, or the result itself when it holds no number.
function reading(condition: ConditionStatus) {
  if (condition.result.kind !== 'Value') return condition.result;
  const r = condition.result.value;
  return {
    id: condition.id,
    kind: condition.kind,
    status: r.status,
    risk: frac(r.distance.dollars),
    overrun: r.overrun ? { dollars: frac(r.overrun.dollars), planR: frac(r.overrun.planR) } : null,
    underlying: r.underlying && { distance: frac(r.underlying.distance), beyond: r.underlying.beyond ? frac(r.underlying.beyond) : null },
  };
}

// O-S2 after S1' on a session date, with the put's and MNO's Marks (undefined: Missing).
function os2On(date: string, put: string | undefined, mno: string | undefined) {
  return evaluate({ state: derivedState(os2Record([OS2_S1]), date), frame: frameOf(OS2_CONTRACT, date, put), underlyingFrame: frameOf(MNO, date, mno) });
}

describe('evaluate: option-price conditions (A198)', () => {
  it("should read O-S2 on Wednesday as four conditions in Plan order with their kinds: S-u Active $60 with MNO 2.20 away, S-o Breached at the put's 3.70 with Overrun $20 (1/24 R) and the contract's Mark as evidence and no Underlying part, T-u Active $640, T-o Active $680", () => {
    const e = os2On('2026-10-14', '3.70', '43.20');
    expect(e.conditions.map(reading)).toEqual([
      { id: 'stop-1', kind: 'UnderlyingPrice', status: 'Active', risk: q(60n), overrun: null, underlying: { distance: q(11n, 5n), beyond: null } },
      { id: 'stop-2', kind: 'StructureValue', status: 'Breached', risk: q(0n), overrun: { dollars: q(20n), planR: q(1n, 24n) }, underlying: undefined },
      { id: 'target-1', kind: 'UnderlyingPrice', status: 'Active', risk: q(640n), overrun: null, underlying: { distance: q(13n, 10n), beyond: null } },
      { id: 'target-2', kind: 'StructureValue', status: 'Active', risk: q(680n), overrun: null, underlying: undefined },
    ]);
    const stopO = e.conditions[1]!;
    expect(stopO.boundary).toBe('3.60');
    expect(stopO.result.kind === 'Value' && stopO.result.value.evidence).toEqual({
      instrument: OS2_CONTRACT,
      date: '2026-10-14',
      mark: { revisionId: 'mark-Option', revisionNumber: 1, price: '3.70' },
    });
  });

  it("should read O-C2 after P1' with the call at 0.95 as its option-price Stop Breached with Overrun $10 and its XYZ Stop Active, and with the call at exactly 4.00 as its option-price Target Reached", () => {
    const at = (call: string) =>
      evaluate({ state: derivedState(oc2Record([OC2_P1]), '2026-10-12'), frame: frameOf(OC2_CONTRACT, '2026-10-12', call), underlyingFrame: frameOf(XYZ, '2026-10-12', '52.00') });
    const low = at('0.95').conditions.map(reading);
    expect(low[0]).toMatchObject({ id: 'stop-1', kind: 'UnderlyingPrice', status: 'Active' });
    expect(low[1]).toMatchObject({ id: 'stop-2', kind: 'StructureValue', status: 'Breached', risk: q(0n), overrun: { dollars: q(10n), planR: q(1n, 20n) } });
    const high = at('4.00').conditions.map(reading);
    expect(high[3]).toMatchObject({ id: 'target-2', kind: 'StructureValue', status: 'Reached', risk: q(0n), overrun: { dollars: q(0n), planR: q(0n) } });
    expect(high[2]).toMatchObject({ id: 'target-1', kind: 'UnderlyingPrice', status: 'Active' });
  });
});

describe('evaluate: the headline across conditions (P91, A197)', () => {
  it("should take O-S2's Tuesday Ongoing Risk to Stop $360 (3/4 R) from S-o, nearer than S-u's $440, and Incremental Reward $260 (13/24 R) from T-u, with Reward : risk now 13/18", () => {
    const e = os2On('2026-10-13', '1.80', '44.00');
    expect(e.conditions.map((c) => (c.result.kind === 'Value' ? frac(c.result.value.distance.dollars) : c.result))).toEqual([q(440n), q(360n), q(260n), q(300n)]);
    expect(exact(e.ongoingRiskToStop)).toBe(q(360n));
    expect(exact(e.ongoingRiskToStopInPlanR)).toBe(q(3n, 4n));
    expect(exact(e.incrementalRewardToTarget)).toBe(q(260n));
    expect(exact(e.incrementalRewardToTargetInPlanR)).toBe(q(13n, 24n));
    expect(exact(e.rewardRiskNow)).toBe(q(13n, 18n));
  });

  it("should return Ongoing Risk to Stop zero for O-S2 on Wednesday with the put's Mark and no MNO Mark, because S-o is Breached, while Incremental Reward is Unavailable(MarkMissing) naming MNO and 2026-10-14; and on Tuesday with no MNO Mark return Ongoing Risk Unavailable(MarkMissing) naming MNO", () => {
    const wednesday = os2On('2026-10-14', '3.70', undefined);
    expect(exact(wednesday.ongoingRiskToStop)).toBe(q(0n));
    expect(wednesday.incrementalRewardToTarget).toEqual({ kind: 'Unavailable', reason: 'MarkMissing', instrument: MNO, date: '2026-10-14' });
    const tuesday = os2On('2026-10-13', '1.80', undefined);
    expect(tuesday.ongoingRiskToStop).toEqual({ kind: 'Unavailable', reason: 'MarkMissing', instrument: MNO, date: '2026-10-13' });
  });

  it("should measure O-S2's at-entry line from S-o and T-u: on Monday 10-12 with the put's Mark Missing and no earlier Mark, so S1' is at entry, risk from entry 470 dollars and reward from entry 150 dollars", () => {
    const e = os2On('2026-10-12', undefined, '44.00');
    expect(e.atEntry).toMatchObject({ label: 'AtEntry', riskFromEntry: Rational.of(470n), rewardFromEntry: Rational.of(150n) });
  });

  it("should return the value at expiration at MNO's latest close for an option Plan whose only conditions are option prices, not NotApplicable(NoOptionExpirationAnchor)", () => {
    const onlyOptionPrices: TradeAnalysisRecord = {
      ...os2Record([OS2_S1]),
      plan: {
        ...os2Record().plan,
        stops: [{ factId: 'stop-s2', kind: 'StructureValue', price: '3.60' }],
        targets: [{ factId: 'target-s2', kind: 'StructureValue', price: '0.30' }],
      },
    };
    const e = evaluate({ state: derivedState(onlyOptionPrices, '2026-10-13'), frame: frameOf(OS2_CONTRACT, '2026-10-13', '1.80'), underlyingFrame: frameOf(MNO, '2026-10-13', '44.00') });
    // Short 2 puts struck 45 at MNO 44.00 are worth the intrinsic 1.00 each, with S1' opened at 1.25 less its fee.
    expect(e.expirationValueAtUnderlyingClose).toMatchObject({ kind: 'Value', value: { underlyingPrice: Rational.of(44n) } });
    expect(e.expirationValueAtUnderlyingClose.kind === 'Value' && frac(e.expirationValueAtUnderlyingClose.value.value)).toBe(q(4870n, 100n));
  });
});

// BUG-3, decision 109: the at-entry line is measured to the nearest condition of each role still ahead of the fill.
const NVDA = { kind: 'Stock', symbol: 'NVDA' } as const;
const nvdaAtEntry = (fill: string, ...laterFills: readonly string[]) =>
  evaluate({ state: derivedState(nvdaRecord(fill, ...laterFills),'2026-10-12'), frame: frameOf(NVDA_CALL, '2026-10-12'), underlyingFrame: frameOf(NVDA, '2026-10-12') }).atEntry;

describe('evaluate: the at-entry line past a crossed condition (BUG-3, decision 109)', () => {
  it('should measure a Long Call filled at 7.35, beyond its 7.50 option Stop, to the NVDA 140 Stop at value 0: risk from entry $735.00, 0.98 R of 1R $750', () => {
    const atEntry = nvdaAtEntry('7.35');
    expect(atEntry?.riskFromEntry).toEqual(Rational.of(735n));
    expect(atEntry && frac(atEntry.riskFromEntryInPlanR)).toBe(q(49n, 50n));
  });

  it('should still measure the same Plan filled at 14.00 to the 7.50 option Stop: risk from entry $650.00', () => {
    expect(nvdaAtEntry('14.00')?.riskFromEntry).toEqual(Rational.of(650n));
  });

  it('should measure O-S2 sold 2 at 3.70, beyond its 3.60 option Stop, to the MNO 41 Stop at value 4.00: risk from entry $60.00', () => {
    const sold = positionChange('pc-s1', 1, [optionExecution(OS_LEG_ID, OS2_CONTRACT, 'ex-pc-s1', '2026-10-12T14:00:00Z', 2, 'Sell', '2', '3.70', '0')]);
    const e = evaluate({ state: derivedState(os2Record([sold]), '2026-10-12'), frame: frameOf(OS2_CONTRACT, '2026-10-12'), underlyingFrame: frameOf(MNO, '2026-10-12', '44.00') });
    expect(e.atEntry?.riskFromEntry).toEqual(Rational.of(60n));
  });
});

// BUG-3-B1: each lot's term is clamped at zero before the lots are summed.
describe('evaluate: the at-entry line per lot (BUG-3-B1, decision 109)', () => {
  it('should give an O-S2 lot sold at 4.10, past both Stops 3.60 and 4.00, a zero risk term, so the lot sold at 3.50 shows its full risk to the 3.60 Stop: risk from entry 10 dollars, 1/48 R of 1R 480 dollars', () => {
    const sale = (id: string, seq: number, time: string, price: string) =>
      positionChange(id, seq, [optionExecution(OS_LEG_ID, OS2_CONTRACT, `ex-${id}`, time, seq + 1, 'Sell', '1', price, '0')]);
    const changes = [sale('pc-s1', 1, '2026-10-12T14:00:00Z', '3.50'), sale('pc-s2', 2, '2026-10-12T14:01:00Z', '4.10')];
    const e = evaluate({ state: derivedState(os2Record(changes), '2026-10-12'), frame: frameOf(OS2_CONTRACT, '2026-10-12'), underlyingFrame: frameOf(MNO, '2026-10-12', '44.00') });
    expect(e.atEntry?.riskFromEntry).toEqual(Rational.of(10n));
    expect(e.atEntry && frac(e.atEntry.riskFromEntryInPlanR)).toBe(q(1n, 48n));
  });

  it('should give a NVDA lot filled at 55.00, past both Targets at value 50.00, a zero reward term, so the lot filled at 14.00 shows its full reward: reward from entry 3600 dollars, 4.80 R of 1R 750 dollars', () => {
    const atEntry = nvdaAtEntry('14.00', '55.00');
    expect(atEntry?.rewardFromEntry).toEqual(Rational.of(3600n));
    expect(atEntry && frac(atEntry.rewardFromEntryInPlanR)).toBe(q(24n, 5n));
  });
});
