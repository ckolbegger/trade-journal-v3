import { describe, expect, it } from 'vitest';
import { Rational } from '../domain/values/index.ts';
import { money, netCost, ratio, rMultiple, tradeSummary } from './format.ts';

const r = (numerator: bigint, denominator: bigint) => Rational.of(numerator, denominator);

describe('R multiple format', () => {
  it('should format an R multiple with exactly two decimals', () => {
    expect(rMultiple(r(13n, 10n))).toBe('1.30R');
    expect(rMultiple(r(27n, 25n))).toBe('1.08R');
    expect(rMultiple(r(1n, 1n))).toBe('1.00R');
  });

  it('should round half away from zero at the second decimal, matching money', () => {
    expect(rMultiple(r(1005n, 1000n))).toBe('1.01R');
    expect(rMultiple(r(-1005n, 1000n))).toBe('−1.01R');
    expect(rMultiple(r(1004n, 1000n))).toBe('1.00R');
    expect(rMultiple(r(-1005n, 1000n)).replace('R', '')).toBe(money(r(-1005n, 1000n)).replace('$', ''));
  });

  it('should leave Reward : risk and the other ratios as they are', () => {
    expect(ratio(r(13n, 10n))).toBe('1.3');
    expect(ratio(r(1n, 1n))).toBe('1');
    expect(ratio(r(12n, 5n))).toBe('2.4');
  });
});

describe('Trade Summary text', () => {
  it('should format a Stock summary as Long 60 shares @ $50.10 using the money format for the price', () => {
    expect(tradeSummary({ kind: 'Stock', direction: 'Long', quantity: r(60n, 1n), price: r(5010n, 100n) })).toBe('Long 60 shares @ $50.10');
  });

  it('should keep a fractional share quantity exact', () => {
    expect(tradeSummary({ kind: 'Stock', direction: 'Long', quantity: r(25n, 2n), price: r(40n, 1n) })).toBe('Long 12.5 shares @ $40.00');
  });

  it('should format a Net cost debit as $3,007.00 and a credit as $212.00 credit', () => {
    expect(netCost(r(3007n, 1n))).toBe('$3,007.00');
    expect(netCost(r(-212n, 1n))).toBe('$212.00 credit');
  });
});
