import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/index.ts';
import { Rational } from '../values/index.ts';
import { derive } from './index.ts';
import { evaluate, type ObservationFrame, type TradeEvaluation } from './evaluate.ts';
import { R_BREN_U, R_CORV_D, R_DALE_D } from './option-trade.ts';
import { R_AXIO_D, R_AXIO_U, REPLAY_SESSION_DATES, type ReplayTestSeries } from './reference-trade.ts';

// Every session closes at 16:00 New York, EST from Sun 2026-11-01.
const closeOf = (date: string) => `${date}T21:00:00Z`;

const frameOf = (instrument: Instrument, date: string, price: string | null): ObservationFrame => ({
  instrument,
  tradingDate: date,
  closeInstant: closeOf(date),
  resolution: price === null ? { kind: 'Missing' } : { kind: 'Available', mark: { revisionId: `rev-${date}`, revisionNumber: 1, price } },
});

// The Trade evaluated at one session's close with that session's observed Marks.
function evaluateAt(series: ReplayTestSeries, date: string): TradeEvaluation {
  const i = REPLAY_SESSION_DATES.indexOf(date as (typeof REPLAY_SESSION_DATES)[number]);
  const state = derive({ record: series.record, cutoff: closeOf(date), valuationDate: date });
  if (state.kind !== 'Derived') throw new Error(`expected Derived, got ${JSON.stringify(state)}`);
  const held = state.positions[0]?.instrument ?? series.record.plan.legs[0]!.instrument;
  const heldPrice = series.held[i] ?? null;
  if (held.kind === 'Stock') return evaluate({ state, frame: frameOf(held, date, heldPrice) });
  return evaluate({
    state,
    frame: frameOf(held, date, heldPrice),
    underlyingFrame: frameOf({ kind: 'Stock', symbol: series.record.plan.underlying }, date, series.underlying[i] ?? null),
  });
}

const frac = (r: Rational) => `${r.numerator}/${r.denominator}`;

describe('evaluate: the estimated odds (A267)', () => {
  it('should give R-DALE-D on Wed 11-11 a chance of the Target first of 78/990 and of the Stop first of 912/990, from $78.00 at risk and $912.00 to gain', () => {
    const odds = evaluateAt(R_DALE_D, '2026-11-11').rewardRiskOdds;
    expect(odds?.kind).toBe('Value');
    if (odds?.kind !== 'Value') return;
    expect(frac(odds.value.targetFirst)).toBe(frac(Rational.of(78n, 990n)));
    expect(frac(odds.value.stopFirst)).toBe(frac(Rational.of(912n, 990n)));
  });

  it('should give the pair as whole percents that add to 100, a half going to the Target: 8 and 92 for R-DALE-D on Wed 11-11, 28 and 72 for R-BREN-U on Mon 11-02 (27.5%)', () => {
    const percentOf = (series: ReplayTestSeries, date: string) => {
      const odds = evaluateAt(series, date).rewardRiskOdds;
      if (odds?.kind !== 'Value') throw new Error('expected a Value');
      return [frac(odds.value.percent.targetFirst), frac(odds.value.percent.stopFirst)];
    };
    expect(percentOf(R_DALE_D, '2026-11-11')).toEqual(['8/1', '92/1']);
    expect(percentOf(R_BREN_U, '2026-11-02')).toEqual(['28/1', '72/1']);
  });

  it("should give the ratio's own result when the ratio is not a Value: Not applicable, No ongoing risk, for R-AXIO-D on Mon 11-09, and the Mark's Unavailable reason for R-CORV-D on Tue 11-10", () => {
    const noRisk = evaluateAt(R_AXIO_D, '2026-11-09');
    expect(noRisk.rewardRiskNow).toEqual({ kind: 'NotApplicable', reason: 'NoOngoingRisk' });
    expect(noRisk.rewardRiskOdds).toEqual(noRisk.rewardRiskNow);
    const noMark = evaluateAt(R_CORV_D, '2026-11-10');
    expect(noMark.rewardRiskNow.kind).toBe('Unavailable');
    expect(noMark.rewardRiskOdds).toEqual(noMark.rewardRiskNow);
  });

  it("should give the Plan's own odds from 1R and the Original Planned Reward, 1,536/1,980 for R-DALE-D (78 and 22), on a session with no Mark and after the buyback alike", () => {
    const noMarkSeries = { ...R_DALE_D, held: R_DALE_D.held.map((h, i) => (i === 7 ? null : h)) };
    for (const evaluation of [evaluateAt(R_DALE_D, '2026-11-02'), evaluateAt(R_DALE_D, '2026-11-11'), evaluateAt(noMarkSeries, '2026-11-11')]) {
      const odds = evaluation.planOdds;
      if (odds?.kind !== 'Value') throw new Error('expected a Value');
      expect(frac(odds.value.targetFirst)).toBe(frac(Rational.of(1536n, 1980n)));
      expect(frac(odds.value.stopFirst)).toBe(frac(Rational.of(444n, 1980n)));
      expect([frac(odds.value.percent.targetFirst), frac(odds.value.percent.stopFirst)]).toEqual(['78/1', '22/1']);
    }
  });
});

describe("evaluate: the extremes' weight (A268)", () => {
  it('should call the extremes Remote for long stock (R-AXIO-U), a long Call (R-BREN-U) and a long Put (R-CORV-D)', () => {
    expect(evaluateAt(R_AXIO_U, '2026-11-02').extremes).toBe('Remote');
    expect(evaluateAt(R_BREN_U, '2026-11-02').extremes).toBe('Remote');
    expect(evaluateAt(R_CORV_D, '2026-11-02').extremes).toBe('Remote');
  });

  it('should call them Main for the Cash-Secured Put (R-DALE-D)', () => {
    expect(evaluateAt(R_DALE_D, '2026-11-02').extremes).toBe('Main');
  });

  it('should give the weight from the Plan before any Execution: Remote for a long-stock Plan, Main for a Cash-Secured Put Plan', () => {
    const unfilled = (series: ReplayTestSeries): ReplayTestSeries => ({ ...series, record: { ...series.record, positionChanges: [] } });
    expect(evaluateAt(unfilled(R_AXIO_U), '2026-11-02').extremes).toBe('Remote');
    expect(evaluateAt(unfilled(R_DALE_D), '2026-11-02').extremes).toBe('Main');
  });
});
