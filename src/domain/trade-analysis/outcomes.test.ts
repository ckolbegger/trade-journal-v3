import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/index.ts';
import { Rational } from '../values/index.ts';
import { derive, type CalculationResult } from './index.ts';
import { evaluate, type ObservationFrame, type TradeEvaluation, type TradeStandingReading } from './evaluate.ts';
import { CORV_PUT, K_SALE, R_BREN_U, R_CORV_D, R_DALE_D } from './option-trade.ts';
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
  if (held.kind === 'Stock') return evaluate({ state, frame: frameOf(held, date, series.held[i]!) });
  return evaluate({
    state,
    frame: frameOf(held, date, series.held[i]!),
    underlyingFrame: frameOf({ kind: 'Stock', symbol: series.record.plan.underlying }, date, series.underlying[i]!),
  });
}

const frac = (r: Rational) => `${r.numerator}/${r.denominator}`;
const dollars = (n: bigint, cents = 0n) => frac(Rational.of(n * 100n + cents, 100n));
function exact(result: CalculationResult<Rational>) {
  return result.kind === 'Value' ? frac(result.value) : result;
}

describe("evaluate: the Trade's result at each boundary (A248)", () => {
  it('should give R-AXIO-U on Mon 11-02 a result of -300.00 at the Stop and +600.00 at the Target, for the 100 shares held', () => {
    const { outcomes } = evaluateAt(R_AXIO_U, '2026-11-02');
    expect(exact(outcomes!.atStop)).toBe(dollars(-300n));
    expect(exact(outcomes!.atTarget)).toBe(dollars(600n));
  });

  it('should step both when the second lot is bought, to -740.00 and +1,060.00 on Fri 11-06', () => {
    const { outcomes } = evaluateAt(R_AXIO_U, '2026-11-06');
    expect(exact(outcomes!.atStop)).toBe(dollars(-740n));
    expect(exact(outcomes!.atTarget)).toBe(dollars(1060n));
  });

  it('should include what is banked: R-BREN-U after the sale gives +316.00 at the Stop and +956.00 at the Target', () => {
    const { outcomes } = evaluateAt(R_BREN_U, '2026-11-12');
    expect(exact(outcomes!.atStop)).toBe(dollars(316n));
    expect(exact(outcomes!.atTarget)).toBe(dollars(956n));
  });

  it('should measure an Underlying-price Stop at its frozen amount: R-DALE-D gives -1,536.00 at the Stop on Mon 11-09', () => {
    const { outcomes } = evaluateAt(R_DALE_D, '2026-11-09');
    expect(exact(outcomes!.atStop)).toBe(dollars(-1536n));
    expect(exact(outcomes!.atTarget)).toBe(dollars(444n));
  });

  it('should give the same two results on a session whose Mark is missing (R-CORV-D Tue 11-10: -318.00 and +867.00)', () => {
    const e = evaluateAt(R_CORV_D, '2026-11-10');
    expect(e.currentMarkedPnl.kind).toBe('Unavailable');
    expect(exact(e.outcomes!.atStop)).toBe(dollars(-318n));
    expect(exact(e.outcomes!.atTarget)).toBe(dollars(867n));
  });

  it('should give a result at the Worst case of -5,000.00 for R-AXIO-U on Mon 11-02 and -33,936.00 for R-DALE-D on Mon 11-09', () => {
    expect(exact(evaluateAt(R_AXIO_U, '2026-11-02').outcomes!.atWorstCase)).toBe(dollars(-5000n));
    expect(exact(evaluateAt(R_DALE_D, '2026-11-09').outcomes!.atWorstCase)).toBe(dollars(-33936n));
  });

  it('should give a result at the Max reward that is Unbounded above for stock and a long Call, and +564.00 for R-DALE-D', () => {
    expect(evaluateAt(R_AXIO_U, '2026-11-02').outcomes!.atMaxReward).toMatchObject({ kind: 'Unbounded', direction: 'Above' });
    expect(evaluateAt(R_BREN_U, '2026-11-02').outcomes!.atMaxReward).toMatchObject({ kind: 'Unbounded', direction: 'Above' });
    expect(exact(evaluateAt(R_DALE_D, '2026-11-09').outcomes!.atMaxReward)).toBe(dollars(564n));
  });

  it('should give all four Not applicable, No remaining Position, once nothing is held', () => {
    const { outcomes } = evaluateAt(K_SALE, '2026-11-13');
    const none = { kind: 'NotApplicable', reason: 'NoRemainingPosition' };
    expect(outcomes).toEqual({ atStop: none, atTarget: none, atWorstCase: none, atMaxReward: none });
  });
});

// The reading of a standing that holds a value.
function standingOf(series: ReplayTestSeries, date: string): TradeStandingReading {
  const { standing } = evaluateAt(series, date);
  if (standing?.kind !== 'Value') throw new Error(`expected a standing Value, got ${JSON.stringify(standing)}`);
  return standing.value;
}

describe('evaluate: standing (A249)', () => {
  it('should place R-BREN-U on Mon 11-02 between the lines, 28/956 of the way to the Target', () => {
    const standing = standingOf(R_BREN_U, '2026-11-02');
    expect(standing.zone).toBe('Between');
    expect(frac(standing.share!)).toBe(frac(Rational.of(28n, 956n)));
  });

  it('should place R-AXIO-D on Fri 11-06 380/600 of the way to the Stop', () => {
    const standing = standingOf(R_AXIO_D, '2026-11-06');
    expect(standing.zone).toBe('Between');
    expect(frac(standing.share!)).toBe(frac(Rational.of(380n, 600n)));
  });

  it('should give past the Stop by the Overrun once breached: R-AXIO-D Mon 11-09, 180.00 and 0.30R, crossed', () => {
    const standing = standingOf(R_AXIO_D, '2026-11-09');
    expect(standing.zone).toBe('PastStop');
    expect(standing.pastBy && { dollars: frac(standing.pastBy.dollars), r: frac(standing.pastBy.r), crossed: standing.pastBy.crossed }).toEqual({
      dollars: dollars(180n),
      r: frac(Rational.of(3n, 10n)),
      crossed: true,
    });
  });

  it('should give past the Target by the Target Overrun: R-BREN-U Thu 11-12, 26.00, crossed', () => {
    const standing = standingOf(R_BREN_U, '2026-11-12');
    expect(standing.zone).toBe('PastTarget');
    expect(standing.pastBy && { dollars: frac(standing.pastBy.dollars), crossed: standing.pastBy.crossed }).toEqual({ dollars: dollars(26n), crossed: true });
  });

  it("should give past an Underlying Stop's planned amount while the Stop is still Active: R-DALE-D Thu 11-12, 9.00, not crossed", () => {
    const standing = standingOf(R_DALE_D, '2026-11-12');
    expect(standing.zone).toBe('PastStop');
    expect(standing.pastBy && { dollars: frac(standing.pastBy.dollars), crossed: standing.pastBy.crossed }).toEqual({ dollars: dollars(9n), crossed: false });
  });

  it('should give no share at break-even, or once the result is past a line', () => {
    // R-AXIO-U's first lot with AXIO still at its $50.00 fill: a Trade P&L of exactly zero.
    const atBreakEven = standingOf({ ...R_AXIO_U, underlying: ['50.00'], held: ['50.00'] }, '2026-11-02');
    expect(atBreakEven.zone).toBe('Between');
    expect(atBreakEven.share).toBeUndefined();
    expect(standingOf(R_AXIO_D, '2026-11-09').share).toBeUndefined();
    expect(standingOf(R_BREN_U, '2026-11-12').share).toBeUndefined();
  });

  it('should give the open profit inside the Risk to stop: R-BREN-U Mon 11-16, 510.00 of 672.00', () => {
    const evaluation = evaluateAt(R_BREN_U, '2026-11-16');
    expect(exact(evaluation.ongoingRiskToStop)).toBe(dollars(672n));
    expect(frac(standingOf(R_BREN_U, '2026-11-16').openProfitAtRisk!)).toBe(dollars(510n));
  });

  it("should be Unavailable with the evaluation's own reason when the Mark is missing", () => {
    const evaluation = evaluateAt(R_CORV_D, '2026-11-10');
    expect(evaluation.standing).toEqual({ kind: 'Unavailable', reason: 'MarkMissing', instrument: CORV_PUT, date: '2026-11-10' });
    expect(evaluation.standing).toEqual(evaluation.currentMarkedPnl);
  });

  it("should be Unavailable naming the Underlying when only its Mark is missing, as the Risk to stop is", () => {
    const evaluation = evaluateAt({ ...R_DALE_D, underlying: R_DALE_D.underlying.map((u, i) => (i === 8 ? null : u)) }, '2026-11-12');
    expect(evaluation.ongoingRiskToStop.kind).toBe('Unavailable');
    expect(evaluation.standing).toEqual(evaluation.ongoingRiskToStop);
  });
});
