import { describe, expect, it } from 'vitest';
import { DivisionByZero, formatMoney, parseDecimal, Rational } from './index.ts';

function parsed(input: string, options?: { positive?: boolean }) {
  const result = parseDecimal(input, options);
  if (!result.ok) throw new Error(`expected ${input} to parse, got ${result.reason}`);
  return result;
}

describe('parsing finite decimal input', () => {
  it('should parse "100", "50.25", and "0.000001" into exact rationals equal to 100, 5025/100, and 1/1000000', () => {
    expect(parsed('100').value.equals(Rational.of(100n))).toBe(true);
    expect(parsed('50.25').value.equals(Rational.of(5025n, 100n))).toBe(true);
    expect(parsed('0.000001').value.equals(Rational.of(1n, 1000000n))).toBe(true);
  });

  it('should normalize "50.250" and "050.25" to the stored string "50.25"', () => {
    expect(parsed('50.250').normalized).toBe('50.25');
    expect(parsed('050.25').normalized).toBe('50.25');
  });

  it('should reject "", "1e3", "NaN", "Infinity", "+5", "1,000", and a 7th fractional digit, each with a typed InvalidDecimal reason', () => {
    for (const input of ['', '1e3', 'NaN', 'Infinity', '+5', '1,000', '1.0000001']) {
      expect(parseDecimal(input), input).toEqual({ ok: false, reason: 'InvalidDecimal' });
    }
  });

  it('should reject zero and negative values where the caller requests a positive decimal, with a typed NotPositive reason', () => {
    for (const input of ['0', '0.000', '-5', '-0.25']) {
      expect(parseDecimal(input, { positive: true }), input).toEqual({ ok: false, reason: 'NotPositive' });
    }
    expect(parsed('-0.25').value.equals(Rational.of(-1n, 4n))).toBe(true);
  });
});

describe('rational arithmetic', () => {
  it('should add 0.1 and 0.2 to exactly 0.3', () => {
    expect(parsed('0.1').value.add(parsed('0.2').value).equals(parsed('0.3').value)).toBe(true);
  });

  it('should return exactly 1 for (1/3) × 3', () => {
    expect(Rational.of(1n, 3n).mul(Rational.of(3n)).equals(Rational.of(1n))).toBe(true);
  });

  it('should compare and order rationals with different denominators correctly, including equality', () => {
    const third = Rational.of(1n, 3n);
    const half = Rational.of(2n, 4n);
    expect(third.compare(half)).toBe(-1);
    expect(half.compare(third)).toBe(1);
    expect(half.compare(Rational.of(3n, 6n))).toBe(0);
    expect(Rational.of(-1n, 2n).compare(Rational.of(-1n, 3n))).toBe(-1);
    const sorted = [half, Rational.of(-2n), third].sort((a, b) => a.compare(b));
    expect(sorted.map((r) => `${r.numerator}/${r.denominator}`)).toEqual(['-2/1', '1/3', '1/2']);
  });

  it('should throw a typed DivisionByZero programming error when dividing by zero', () => {
    expect(Rational.of(6n).div(Rational.of(4n)).equals(Rational.of(3n, 2n))).toBe(true);
    expect(() => Rational.of(1n).div(Rational.of(0n))).toThrow(DivisionByZero);
  });
});

describe('presentation formatting', () => {
  it('should format 1/3 dollar as "$0.33" and 2/3 as "$0.67" (half away from zero) without changing the exact value', () => {
    const third = Rational.of(1n, 3n);
    expect(formatMoney(third)).toBe('$0.33');
    expect(formatMoney(Rational.of(2n, 3n))).toBe('$0.67');
    expect(formatMoney(Rational.of(1n, 200n))).toBe('$0.01');
    expect(third.equals(Rational.of(1n, 3n))).toBe(true);
  });

  it('should format negative Money with a leading minus and the dollar sign ("−$12.50")', () => {
    expect(formatMoney(Rational.of(-1250n, 100n))).toBe('\u2212$12.50');
    expect(formatMoney(Rational.of(-1n, 200n))).toBe('\u2212$0.01');
    expect(formatMoney(Rational.of(-1n, 1000n))).toBe('$0.00');
  });
});
