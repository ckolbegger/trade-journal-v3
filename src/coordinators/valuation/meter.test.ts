import { describe, expect, it } from 'vitest';
import type { Instrument } from '../../domain/instrument/index.ts';
import { derive, type CalculationResult } from '../../domain/trade-analysis/index.ts';
import { evaluate, type ObservationFrame, type TradeEvaluation } from '../../domain/trade-analysis/evaluate.ts';
import { R_BREN_U, R_CORV_D, R_DALE_D } from '../../domain/trade-analysis/option-trade.ts';
import { REPLAY_SESSION_DATES, type ReplayTestSeries } from '../../domain/trade-analysis/reference-trade.ts';
import { Rational } from '../../domain/values/index.ts';
import { meterReadingOf } from './index.ts';

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
  return evaluate({
    state,
    frame: frameOf(held, date, series.held[i] ?? null),
    underlyingFrame: frameOf({ kind: 'Stock', symbol: series.record.plan.underlying }, date, series.underlying[i] ?? null),
  });
}

const before = (series: ReplayTestSeries, date: string) => ({ tradingDate: date, evaluation: evaluateAt(series, date) });
const frac = (r: Rational) => `${r.numerator}/${r.denominator}`;
const dollars = (n: bigint, cents = 0n) => frac(Rational.of(n * 100n + cents, 100n));
function exact(result: CalculationResult<Rational>) {
  return result.kind === 'Value' ? frac(result.value) : result;
}

describe('meter reading (A260)', () => {
  it('should give R-BREN-U on Mon 11-16 the lines +$316.00 and +$956.00, the result +$988.00, banked +$478.00 and past the Target by $32.00', () => {
    const reading = meterReadingOf(evaluateAt(R_BREN_U, '2026-11-16'), before(R_BREN_U, '2026-11-13'));
    expect(exact(reading.stop)).toBe(dollars(316n));
    expect(exact(reading.target)).toBe(dollars(956n));
    expect(exact(reading.banked)).toBe(dollars(478n));
    if (reading.now.kind !== 'Value') throw new Error('expected a Value');
    expect(frac(reading.now.value.pnl)).toBe(dollars(988n));
    expect(reading.now.value.zone).toBe('PastTarget');
    expect(frac(reading.now.value.pastBy!.dollars)).toBe(dollars(32n));
  });

  it("should give the session before's result with its date (+$1,138.00 on 11-13)", () => {
    const reading = meterReadingOf(evaluateAt(R_BREN_U, '2026-11-16'), before(R_BREN_U, '2026-11-13'));
    expect(reading.previous?.tradingDate).toBe('2026-11-13');
    expect(frac(reading.previous!.pnl)).toBe(dollars(1138n));
  });

  it("should give the session before's zone with its previous reading", () => {
    // 11-13's result, +$1,138.00, is past the Target's +$956.00.
    expect(meterReadingOf(evaluateAt(R_BREN_U, '2026-11-16'), before(R_BREN_U, '2026-11-13')).previous?.zone).toBe('PastTarget');
    // The zone is the session before's own standing, not today's.
    const earlier = before(R_BREN_U, '2026-11-12');
    const standing = earlier.evaluation.standing;
    if (standing?.kind !== 'Value') throw new Error('expected a Value standing');
    expect(meterReadingOf(evaluateAt(R_BREN_U, '2026-11-16'), earlier).previous?.zone).toBe(standing.value.zone);
  });

  it('should give no earlier result when the session before has no figure', () => {
    // R-CORV-D has no put Mark on Tue 11-10.
    const reading = meterReadingOf(evaluateAt(R_CORV_D, '2026-11-11'), before(R_CORV_D, '2026-11-10'));
    expect(reading.now.kind).toBe('Value');
    expect(reading.previous).toBeUndefined();
  });

  it("should keep the lines and the earlier result when todays Mark is missing, with the reason", () => {
    const reading = meterReadingOf(evaluateAt(R_CORV_D, '2026-11-10'), before(R_CORV_D, '2026-11-09'));
    expect(reading.now).toMatchObject({ kind: 'Unavailable', reason: 'MarkMissing' });
    expect(exact(reading.stop)).toBe(dollars(-318n));
    expect(exact(reading.target)).toBe(dollars(867n));
    expect(reading.previous?.tradingDate).toBe('2026-11-09');
  });

  it('should give R-DALE-D on Thu 11-12 past the Stop line by $9.00 while the Stop is Active', () => {
    const e = evaluateAt(R_DALE_D, '2026-11-12');
    const reading = meterReadingOf(e, before(R_DALE_D, '2026-11-11'));
    if (reading.now.kind !== 'Value') throw new Error('expected a Value');
    expect(reading.now.value.zone).toBe('PastStop');
    expect(frac(reading.now.value.pastBy!.dollars)).toBe(dollars(9n));
    expect(reading.now.value.pastBy!.crossed).toBe(false);
    expect(e.conditions.find((c) => c.role === 'Stop')!.result).toMatchObject({ kind: 'Value', value: { status: 'Active' } });
  });

  it('should give the share of the way to a rail, in whole percent, and which rail', () => {
    // R-BREN-U Mon 11-09: the Trade is down -80.00 of the -324.00 at the Stop, a quarter of the way.
    const reading = meterReadingOf(evaluateAt(R_BREN_U, '2026-11-09'));
    if (reading.now.kind !== 'Value') throw new Error('expected a Value');
    expect(reading.now.value.share).toMatchObject({ toward: 'Stop' });
    expect(frac(reading.now.value.share!.percent)).toBe('25/1');
    expect(reading.now.value.pastBy).toBeUndefined();
  });

  it('should say whether the result is Up, Down or Level from the session before, and none without a Mark', () => {
    const today = evaluateAt(R_BREN_U, '2026-11-16');
    expect(meterReadingOf(today, before(R_BREN_U, '2026-11-13')).previous?.direction).toBe('Down');
    expect(meterReadingOf(evaluateAt(R_BREN_U, '2026-11-13'), before(R_BREN_U, '2026-11-12')).previous?.direction).toBe('Up');
    expect(meterReadingOf(today, { tradingDate: '2026-11-13', evaluation: today }).previous?.direction).toBe('Level');
    expect(meterReadingOf(evaluateAt(R_CORV_D, '2026-11-10'), before(R_CORV_D, '2026-11-09')).previous?.direction).toBeUndefined();
  });
});
