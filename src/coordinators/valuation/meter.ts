import type { CalculationResult, TradeEvaluation } from '../../domain/trade-analysis/index.ts';
import type { TradeStandingReading } from '../../domain/trade-analysis/evaluate.ts';
import { Rational } from '../../domain/values/index.ts';

// A260: the Trade's result as the meter reads it.
export interface MeterNowReading {
  readonly pnl: Rational;
  readonly zone: TradeStandingReading['zone'];
  readonly pastBy?: TradeStandingReading['pastBy'];
  // Between the rails only, and absent at break-even: the share of the way to the rail the result is on, exact and in whole
  // percent (half-up), and which rail that is.
  readonly share?: { readonly fraction: Rational; readonly percent: Rational; readonly toward: 'Stop' | 'Target' };
}

export interface MeterPreviousReading {
  readonly tradingDate: string;
  readonly pnl: Rational;
  // The result now against this one; present exactly when now is a Value.
  readonly direction?: 'Up' | 'Down' | 'Level';
}

export interface MeterReading {
  readonly stop: CalculationResult<Rational>;
  readonly target: CalculationResult<Rational>;
  readonly banked: CalculationResult<Rational>;
  readonly now: CalculationResult<MeterNowReading>;
  readonly previous?: MeterPreviousReading;
}

// The share is the result over the result at the rail it runs to (A249): toward the Target above break-even, the Stop below.
function shareOf(pnl: Rational, fraction: Rational): NonNullable<MeterNowReading['share']> {
  const scaled = fraction.mul(Rational.of(100n)).add(Rational.of(1n, 2n));
  return { fraction, percent: Rational.of(scaled.numerator / scaled.denominator), toward: pnl.compare(Rational.of(0n)) > 0 ? 'Target' : 'Stop' };
}

const directionOf = (now: Rational, then: Rational): 'Up' | 'Down' | 'Level' => ['Down' as const, 'Level' as const, 'Up' as const][now.compare(then) + 1]!;

export function meterReadingOf(evaluation: TradeEvaluation, before?: { readonly tradingDate: string; readonly evaluation: TradeEvaluation }): MeterReading {
  const { outcomes, standing } = evaluation;
  if (!outcomes || !standing) throw new Error('meterReadingOf: the evaluation carries no outcomes or standing');
  const now: MeterReading['now'] =
    standing.kind === 'Value' && evaluation.currentMarkedPnl.kind === 'Value'
      ? { kind: 'Value', value: { pnl: evaluation.currentMarkedPnl.value, zone: standing.value.zone, ...(standing.value.pastBy && { pastBy: standing.value.pastBy }), ...(standing.value.share && { share: shareOf(evaluation.currentMarkedPnl.value, standing.value.share) }) } }
      : (standing as Exclude<typeof standing, { kind: 'Value' }>);
  const earlier = before?.evaluation.currentMarkedPnl;
  const previous: MeterPreviousReading | undefined =
    before && earlier?.kind === 'Value' ? { tradingDate: before.tradingDate, pnl: earlier.value, ...(now.kind === 'Value' && { direction: directionOf(now.value.pnl, earlier.value) }) } : undefined;
  return { stop: outcomes.atStop, target: outcomes.atTarget, banked: evaluation.realizedToDate, now, ...(previous && { previous }) };
}
