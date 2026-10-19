import { Rational } from './rational.ts';

export type ParseDecimalResult =
  | { readonly ok: true; readonly value: Rational; readonly normalized: string }
  | { readonly ok: false; readonly reason: 'InvalidDecimal' | 'NotPositive' };

// A finite decimal with at most 6 fractional digits and an optional leading minus.
const DECIMAL = /^(-?)(\d+)(?:\.(\d{1,6}))?$/;

export function parseDecimal(input: string, options?: { positive?: boolean }): ParseDecimalResult {
  const match = DECIMAL.exec(input);
  if (!match) return { ok: false, reason: 'InvalidDecimal' };
  const whole = (match[2] ?? '0').replace(/^0+(?=\d)/, '');
  const fraction = (match[3] ?? '').replace(/0+$/, '');
  const magnitude = BigInt(whole + fraction);
  const negative = match[1] === '-' && magnitude !== 0n;
  if (options?.positive && (negative || magnitude === 0n)) return { ok: false, reason: 'NotPositive' };
  const value = Rational.of(negative ? -magnitude : magnitude, 10n ** BigInt(fraction.length));
  const digits = fraction ? `${whole}.${fraction}` : whole;
  return { ok: true, value, normalized: negative ? `-${digits}` : digits };
}
