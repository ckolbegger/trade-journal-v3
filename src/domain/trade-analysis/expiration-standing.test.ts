import { describe, expect, it } from 'vitest';
import type { OptionInstrument } from '../instrument/index.ts';
import { Rational } from '../values/index.ts';
import { expirationStanding, type ExpirationStandingFigures } from './expiration-standing.ts';

const r = (n: bigint | number, d: bigint | number = 1) => Rational.of(BigInt(n), BigInt(d));
const frac = (x: Rational) => `${x.numerator}/${x.denominator}`;

const contract = (symbol: string, strike: string, right: 'Call' | 'Put'): OptionInstrument => ({
  kind: 'Option',
  symbol,
  root: symbol,
  expiration: '2026-11-20',
  strike,
  right,
  multiplier: 100,
});

const XYZ_CALL = contract('XYZ', '55', 'Call');

// R-CORV-D: long 3 Puts at 2.11, strike 80, 1R 318.
const CORV_PUT = contract('CORV', '80', 'Put');
const corv = (underlyingMark?: string) => ({
  contract: CORV_PUT,
  exposure: { lots: [{ instrument: CORV_PUT, quantity: r(3), basis: r(211, 100), unconsumedOpeningFee: r(0) }], realizedToDate: r(0) },
  oneR: r(318),
  ...(underlyingMark !== undefined && { underlyingMark }),
});

function figures(result: ReturnType<typeof expirationStanding>): ExpirationStandingFigures {
  if (result.kind !== 'Value') throw new Error(`expected a Value, got ${result.kind}`);
  return result.value;
}

describe('An expired contract standing (A314)', () => {
  it('should give a put in the money by the strike less the Underlying Mark at the expiration session', () => {
    const standing = figures(expirationStanding(corv('73.00')));
    expect(standing.inTheMoney).toBe(true);
    expect(frac(standing.amount)).toBe(frac(r(7)));
  });

  it('should give a call the other way, and out of the money by how much', () => {
    const call = (mark: string) => ({ ...corv(mark), contract: XYZ_CALL, exposure: { lots: [{ instrument: XYZ_CALL, quantity: r(2), basis: r(2), unconsumedOpeningFee: r(0) }], realizedToDate: r(0) } });
    const inside = figures(expirationStanding(call('58.00')));
    expect([inside.inTheMoney, frac(inside.amount)]).toEqual([true, frac(r(3))]);
    const outside = figures(expirationStanding(call('52.00')));
    expect([outside.inTheMoney, frac(outside.amount)]).toEqual([false, frac(r(3))]);
    const putOut = figures(expirationStanding(corv('83.50')));
    expect([putOut.inTheMoney, frac(putOut.amount)]).toEqual([false, frac(r(7, 2))]);
  });

  it('should give the worth at expiration of what is held', () => {
    expect(frac(figures(expirationStanding(corv('73.00'))).worth)).toBe(frac(r(2100)));
    expect(frac(figures(expirationStanding(corv('83.50'))).worth)).toBe('0/1');
    // A short Put is owed: 2 contracts at strike 45 finishing at 40 owe 1000.
    const MNO_PUT = contract('MNO', '45', 'Put');
    const short = { ...corv('40.00'), contract: MNO_PUT, exposure: { lots: [{ instrument: MNO_PUT, quantity: r(-2), basis: r(6, 5), unconsumedOpeningFee: r(0) }], realizedToDate: r(0) } };
    expect(frac(figures(expirationStanding(short)).worth)).toBe(frac(r(-1000)));
  });

  it('should give the Trade result if it settled at that worth, in dollars and R', () => {
    const settled = figures(expirationStanding(corv('73.00'))).ifSettled;
    expect([frac(settled.dollars), frac(settled.r)]).toEqual([frac(r(1467)), frac(r(1467, 318))]);
    // Realized to date and unconsumed opening fees count: 1467 + 100 - 1.30.
    const carried = corv('73.00');
    const withHistory = { ...carried, exposure: { lots: [{ ...carried.exposure.lots[0]!, unconsumedOpeningFee: r(13, 10) }], realizedToDate: r(100) } };
    expect(frac(figures(expirationStanding(withHistory)).ifSettled.dollars)).toBe(frac(r(15657, 10)));
  });

  it('should give the Trade result if it is recorded as expired worthless', () => {
    const worthless = figures(expirationStanding(corv('73.00'))).ifExpiredWorthless;
    expect([frac(worthless.dollars), frac(worthless.r)]).toEqual([frac(r(-633)), frac(r(-633, 318))]);
    // A short Put keeps its premium: 2 contracts at 1.20 is 240.
    const MNO_PUT = contract('MNO', '45', 'Put');
    const short = { ...corv('40.00'), contract: MNO_PUT, oneR: r(480), exposure: { lots: [{ instrument: MNO_PUT, quantity: r(-2), basis: r(6, 5), unconsumedOpeningFee: r(0) }], realizedToDate: r(0) } };
    expect(frac(figures(expirationStanding(short)).ifExpiredWorthless.dollars)).toBe(frac(r(240)));
  });

  it('should be Unavailable with no Underlying Mark for the expiration session', () => {
    expect(expirationStanding(corv())).toEqual({ kind: 'Unavailable', reason: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'CORV' }, date: '2026-11-20' });
  });

  it('should give a contract at its strike as not in the money', () => {
    const put = figures(expirationStanding(corv('80.00')));
    expect([put.inTheMoney, frac(put.amount)]).toEqual([false, '0/1']);
    const call = figures(expirationStanding({ ...corv('55'), contract: XYZ_CALL }));
    expect([call.inTheMoney, frac(call.amount)]).toEqual([false, '0/1']);
  });
});
