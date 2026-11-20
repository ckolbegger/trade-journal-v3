// D9 A258, A259, P121: the estimates of one option session, from exact inputs read once into plain numbers (the conversion goes one
// way). This file alone reads option-pricing; replay-series.ts alone reads this file.
import type { OptionInstrument } from '../instrument/index.ts';
import { impliedVolatility, optionDelta, optionPrice, rateForDays } from '../option-pricing/index.ts';
import type { Rational } from '../values/index.ts';
import type { Estimate, EstimateSplit } from './estimate.ts';

// One session's exact inputs for an option: its days to expiration (the Instrument module's count) and the two Marks, null where missing.
export interface EstimateSession {
  readonly date: string;
  readonly days: number;
  readonly underlying: Rational | null;
  readonly mark: Rational | null;
}

const toNumber = (value: Rational): number => Number(value.numerator) / Number(value.denominator);

// The Marks of a session that has both, as numbers.
function marksOf(session: EstimateSession): { readonly underlying: number; readonly mark: number } | null {
  return session.underlying && session.mark ? { underlying: toNumber(session.underlying), mark: toNumber(session.mark) } : null;
}

// A258: the volatility (a fraction) that explains the session's Mark, or why there is none.
export function volatilityOf(option: OptionInstrument, session: EstimateSession): Estimate {
  const marks = marksOf(session);
  if (!marks) return { kind: 'Unavailable', reason: 'MarkMissing' };
  const found = impliedVolatility(option.right, marks.mark, marks.underlying, Number(option.strike), session.days, rateForDays(session.days));
  return found.kind === 'Volatility' ? { kind: 'Estimate', value: found.value } : found;
}

// A258: delta x contracts x multiplier, the contracts signed (a short position is negative). Unavailable with the implied volatility's own reason.
// A258: a stock Position's share equivalent is its shares, exact.
export function stockShareEquivalent(shares: Rational): Estimate {
  return { kind: 'Estimate', value: toNumber(shares), exact: true };
}

// The rate and the days to expiration the session's estimates use.
export function rateAndDays(session: EstimateSession): { readonly rate: number; readonly days: number } {
  return { rate: rateForDays(session.days), days: session.days };
}

export function optionShareEquivalent(option: OptionInstrument, session: EstimateSession, contracts: Rational): Estimate {
  const volatility = volatilityOf(option, session);
  const marks = marksOf(session);
  if (volatility.kind !== 'Estimate' || !marks) return volatility.kind === 'Estimate' ? { kind: 'Unavailable', reason: 'MarkMissing' } : volatility;
  const delta = optionDelta(option.right, marks.underlying, Number(option.strike), session.days, volatility.value, rateForDays(session.days));
  return { kind: 'Estimate', value: delta * toNumber(contracts) * option.multiplier };
}

// A259: the change in the Mark since the session before, per share, in the order Underlying, time, volatility, priced from the earlier
// session's implied volatility. The change is measured from the last session that had a Mark.
export function markChangeSplit(option: OptionInstrument, earlier: readonly EstimateSession[], later: EstimateSession): EstimateSplit {
  const to = marksOf(later);
  if (!to) return { kind: 'Unavailable', reason: 'MarkMissing', session: later.date };
  const before = earlier[earlier.length - 1];
  if (!before) return { kind: 'Unavailable', reason: 'NoEarlierFigure', session: later.date };
  const volatilityBefore = volatilityOf(option, before);
  const from = marksOf(before);
  if (volatilityBefore.kind !== 'Estimate' || !from) {
    const reason = volatilityBefore.kind === 'Unavailable' ? volatilityBefore.reason : 'MarkMissing';
    const marked = [...earlier].reverse().find((session) => marksOf(session));
    const last = marked && marksOf(marked);
    const unavailable = { kind: 'Unavailable', reason, session: before.date } as const;
    return marked && last ? { ...unavailable, since: marked.date, change: to.mark - last.mark } : unavailable;
  }
  const strike = Number(option.strike);
  const priceAt = (underlying: number, days: number, volatility: number) =>
    optionPrice(option.right, underlying, strike, days, volatility, rateForDays(days));
  const afterTheMove = priceAt(to.underlying, before.days, volatilityBefore.value);
  const afterTheTime = priceAt(to.underlying, later.days, volatilityBefore.value);
  const underlying = afterTheMove - priceAt(from.underlying, before.days, volatilityBefore.value);
  const volatilityAfter = volatilityOf(option, later);
  // Without a volatility for the later session, time and volatility cannot be told apart: they are the rest of the change.
  if (volatilityAfter.kind !== 'Estimate') return { kind: 'Split', underlying, timeAndVolatility: to.mark - from.mark - underlying, remainder: 0 };
  const time = afterTheTime - afterTheMove;
  const volatility = priceAt(to.underlying, later.days, volatilityAfter.value) - afterTheTime;
  return { kind: 'Split', underlying, time, volatility, remainder: to.mark - from.mark - underlying - time - volatility };
}
