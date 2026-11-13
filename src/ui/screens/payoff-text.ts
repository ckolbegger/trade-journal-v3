import type { Attainment, CalculationResult, ExpirationPayoffView, PayoffExtremum, PayoffSegment, PayoffZero } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { payoffUnboundedWords, text } from '../calculation-words.ts';
import { signed } from '../figures.ts';
import { money, underlyingPrice } from '../format.ts';

// The words of a payoff view (rows 22.5 to 22.13); every Underlying price has two decimals (C3) and every
// value with a sign is `signed(money)` (C7).
const ZERO = Rational.of(0n);
export const signedMoney = signed(money);

// "0.00 to 55.00" for a closed segment, "55.00 and above" for the final ray.
export const rangeText = (from: Rational, to: Rational | null): string =>
  to ? `${underlyingPrice(from)} to ${underlyingPrice(to)}` : `${underlyingPrice(from)} and above`;

// A zero of the curve, as the zero-set row and the chart label word it.
export const zeroText = (zero: PayoffZero): string => {
  switch (zero.kind) {
    case 'Crossing':
      return `Breakeven ${underlyingPrice(zero.price)}`;
    case 'Touch':
      return `Breakeven at ${underlyingPrice(zero.price)}, touched without crossing`;
    case 'ZeroRange':
      if (!zero.to) throw new Error('a Zero Range with no upper end has no approved words');
      return `Breakeven from ${underlyingPrice(zero.from)} to ${underlyingPrice(zero.to)}`;
    default:
      return zero satisfies never;
  }
};

const attainmentText = (attainment: Attainment): string => {
  switch (attainment.kind) {
    case 'Point':
      return `at ${underlyingPrice(attainment.at)}`;
    case 'Interval':
      return `from ${underlyingPrice(attainment.from)} to ${underlyingPrice(attainment.to)}`;
    case 'Ray':
      return `at ${underlyingPrice(attainment.from)} and above`;
    default:
      return attainment satisfies never;
  }
};

// An extremum without where it is attained: "Max loss $400.00", the signs per row 22.12 (conflict K3).
function extremumLead(side: 'Maximum' | 'Minimum', result: CalculationResult<PayoffExtremum, never, never>): string {
  if (result.kind === 'Unbounded') return text(payoffUnboundedWords(result.direction));
  if (result.kind !== 'Value') throw new Error('a payoff extremum is a value or unbounded');
  const { value } = result.value;
  const sense = value.compare(ZERO);
  if (side === 'Maximum') return sense > 0 ? `Max profit ${money(value)}` : `No profit: at best ${signedMoney(value)}`;
  return sense < 0 ? `Max loss ${money(ZERO.sub(value))}` : `No loss: at worst ${signedMoney(value)}`;
}

// An extremum row: "Max loss $400.00 for XYZ from 0.00 to 55.00".
export function extremumText(side: 'Maximum' | 'Minimum', result: CalculationResult<PayoffExtremum, never, never>, symbol: string): string {
  const lead = extremumLead(side, result);
  if (result.kind !== 'Value') return lead;
  return `${lead} for ${symbol} ${result.value.attainedOn.map(attainmentText).join(' and ')}`;
}

const lowerFirst = (words: string): string => words.charAt(0).toLowerCase() + words.slice(1);

// The card's one-line Current payoff (row 24.8): "At expiration: breakeven 43.76 · max profit $248.70 · max loss $8,751.30".
export function payoffSummary(view: ExpirationPayoffView): string {
  const breakeven = view.zeroSet.length === 0 ? 'No breakeven' : view.zeroSet.map(zeroText).join(' and ');
  return `At expiration: ${[breakeven, extremumLead('Maximum', view.maximum), extremumLead('Minimum', view.minimum)].map(lowerFirst).join(' · ')}`;
}

// "If XYZ is at 57.50 at expiration: +$148.05" (A122), the figure beside the Current chart and the card's payoff summary.
export const valueAtCloseText = (symbol: string, atClose: { readonly underlyingPrice: Rational; readonly value: Rational }): string =>
  `If ${symbol} is at ${underlyingPrice(atClose.underlyingPrice)} at expiration: ${signedMoney(atClose.value)}`;

// "Value at expiration at XYZ's latest Mark" (W18), the term of the figure that says why there is no number; Trade Detail and the Review card both use it.
export const valueAtCloseTerm = (symbol: string): string => `Value at expiration at ${symbol}'s latest Mark`;

// The chart text at the last ray: a rising ray continues rising, a flat one stays at its value (row 22.13).
export function lastRayText(last: PayoffSegment): string {
  const sense = last.slope.compare(ZERO);
  if (sense > 0) return 'continues rising';
  if (sense === 0) return `stays at ${signedMoney(last.valueAtStart)}`;
  throw new Error('a falling final ray has no approved words');
}
