import { describe, expect, it } from 'vitest';
import {
  ExactNumber,
  add,
  cmp,
  div,
  fromDecimalString,
  fromInteger,
  mul,
  sub,
  toDecimalString,
  toMoneyString,
  toRatioString,
} from '../../src/shared/exact-number';

describe('ExactNumber (BigInt Rational) seam', () => {
  it('avoids floating-point drift on 0.1 + 0.2 and preserves exact 1/3 * 3 === 1', () => {
    const a = fromDecimalString('0.1');
    const b = fromDecimalString('0.2');
    const sum = add(a, b);
    expect(toDecimalString(sum, 2)).toBe('0.30');
    expect(cmp(sum, fromDecimalString('0.3'))).toBe(0);

    const oneThird = div(fromInteger(1), fromInteger(3));
    const backToOne = mul(oneThird, fromInteger(3));
    expect(cmp(backToOne, fromInteger(1))).toBe(0);
    expect(toDecimalString(backToOne, 4)).toBe('1.0000');
  });

  it('computes exact stock risk, reward, and R:R formatting with half-up rounding only at display', () => {
    const entry = fromDecimalString('182.50');
    const stop = fromDecimalString('175.25');
    const target = fromDecimalString('204.25');
    const qty = fromInteger(40);

    const riskPerShare = sub(entry, stop);
    const oneR = mul(riskPerShare, qty);
    const reward = mul(sub(target, entry), qty);
    const rr = div(reward, oneR);

    expect(toMoneyString(oneR)).toBe('$290.00');
    expect(toMoneyString(reward)).toBe('$870.00');
    expect(toRatioString(rr)).toBe('3.00R');

    const serialized = ExactNumber.toJSON(rr);
    const restored = ExactNumber.fromJSON(serialized);
    expect(cmp(restored, rr)).toBe(0);
  });

  it('rejects malformed decimal strings, bad comma grouping, and division by zero', () => {
    expect(() => fromDecimalString('')).toThrow();
    expect(() => fromDecimalString('12.3.4')).toThrow();
    expect(() => fromDecimalString('abc')).toThrow();
    expect(() => fromDecimalString('1,8,2.50')).toThrow();
    expect(() => fromDecimalString('1,,000')).toThrow();
    expect(() => div(fromInteger(1), fromInteger(0))).toThrow();
  });
});
