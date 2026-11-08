import type { Attainment, CalculationResult, PayoffExtremum, PayoffSegment, PayoffZero } from '../../app/types.ts';
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

// An extremum row: "Max loss $400.00 for XYZ from 0.00 to 55.00", the signs per row 22.12 (conflict K3).
export function extremumText(side: 'Maximum' | 'Minimum', result: CalculationResult<PayoffExtremum, never, never>, symbol: string): string {
  if (result.kind === 'Unbounded') return text(payoffUnboundedWords(result.direction));
  if (result.kind !== 'Value') throw new Error('a payoff extremum is a value or unbounded');
  const { value, attainedOn } = result.value;
  const where = `${symbol} ${attainedOn.map(attainmentText).join(' and ')}`;
  const sense = value.compare(ZERO);
  if (side === 'Maximum') return sense > 0 ? `Max profit ${money(value)} for ${where}` : `No profit: at best ${signedMoney(value)} for ${where}`;
  return sense < 0 ? `Max loss ${money(ZERO.sub(value))} for ${where}` : `No loss: at worst ${signedMoney(value)} for ${where}`;
}

// The chart text at the last ray: a rising ray continues rising, a flat one stays at its value (row 22.13).
export function lastRayText(last: PayoffSegment): string {
  const sense = last.slope.compare(ZERO);
  if (sense > 0) return 'continues rising';
  if (sense === 0) return `stays at ${signedMoney(last.valueAtStart)}`;
  throw new Error('a falling final ray has no approved words');
}
