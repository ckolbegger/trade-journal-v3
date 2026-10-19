import { Rational } from './rational.ts';

const MINUS = '−';

// Presentation only: rounds half away from zero to a fixed number of fractional digits.
// The exact value is never changed and rounding never drives classification.
function rounded(value: Rational, fractionDigits: number): { negative: boolean; digits: string } {
  const scale = 10n ** BigInt(fractionDigits);
  const magnitude = value.numerator < 0n ? -value.numerator : value.numerator;
  const units = (magnitude * scale * 2n + value.denominator) / (value.denominator * 2n);
  const whole = (units / scale).toString();
  const fraction = (units % scale).toString().padStart(fractionDigits, '0');
  return {
    negative: value.numerator < 0n && units !== 0n,
    digits: fractionDigits > 0 ? `${whole}.${fraction}` : whole,
  };
}

export function formatDecimal(value: Rational, fractionDigits: number): string {
  const { negative, digits } = rounded(value, fractionDigits);
  return negative ? `${MINUS}${digits}` : digits;
}

export function formatMoney(value: Rational): string {
  const { negative, digits } = rounded(value, 2);
  return negative ? `${MINUS}$${digits}` : `$${digits}`;
}
