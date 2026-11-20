import { describe, expect, it } from 'vitest';
import { daysToExpiration, type OptionInstrument } from '../instrument/index.ts';
import { parseDecimal, type Rational } from '../values/index.ts';
import { BREN_CALL, CORV_PUT, DALE_PUT, R_BREN_U, R_CORV_D, R_DALE_D } from './option-trade.ts';
import { REPLAY_SESSION_DATES, type ReplayTestSeries } from './reference-trade.ts';
import { optionShareEquivalent, markChangeSplit, rateAndDays, stockShareEquivalent, type EstimateSession } from './replay-estimates.ts';

const rational = (text: string): Rational => {
  const parsed = parseDecimal(text);
  if (!parsed.ok) throw new Error(text);
  return parsed.value;
};

// The session of a test series on a date: its Marks are the section 5 table's, its days those to the 11-20 expiration at the 4 pm close.
function sessionOf(series: ReplayTestSeries, contract: OptionInstrument, date: string): EstimateSession {
  const i = REPLAY_SESSION_DATES.indexOf(date as (typeof REPLAY_SESSION_DATES)[number]);
  const underlying = series.underlying[i];
  const mark = series.held[i];
  return {
    date,
    days: daysToExpiration(contract, `${date}T21:00:00Z`),
    underlying: underlying == null ? null : rational(underlying),
    mark: mark == null ? null : rational(mark),
  };
}
const cents = (value: number) => Math.round(value * 100) / 100;
const before = (series: ReplayTestSeries, contract: OptionInstrument, date: string) =>
  REPLAY_SESSION_DATES.filter((d) => d < date).map((d) => sessionOf(series, contract, d));

describe('share equivalent (A258)', () => {
  it("should give R-BREN-U's 4 contracts on Mon 11-02 about 147 shares", () => {
    const shares = optionShareEquivalent(BREN_CALL, sessionOf(R_BREN_U, BREN_CALL, '2026-11-02'), rational('4'));
    expect(shares.kind === 'Estimate' && Math.round(shares.value)).toBe(147);
    expect(shares.kind === 'Estimate' && shares.exact).toBeUndefined();
  });

  it('should be negative for a long Put (R-CORV-D Mon 11-02, about −122) and positive for a short Put (R-DALE-D Mon 11-02, about 189)', () => {
    const long = optionShareEquivalent(CORV_PUT, sessionOf(R_CORV_D, CORV_PUT, '2026-11-02'), rational('3'));
    const short = optionShareEquivalent(DALE_PUT, sessionOf(R_DALE_D, DALE_PUT, '2026-11-02'), rational('-6'));
    expect(long.kind === 'Estimate' && Math.round(long.value)).toBe(-122);
    expect(short.kind === 'Estimate' && Math.round(short.value)).toBe(189);
  });

  it("should be Unavailable with the implied volatility's reason when there is none", () => {
    const insensitive = optionShareEquivalent(BREN_CALL, sessionOf(R_BREN_U, BREN_CALL, '2026-11-17'), rational('2'));
    expect(insensitive).toEqual({ kind: 'Unavailable', reason: 'InsensitiveToVolatility' });
  });

  it("should give a stock Position's share equivalent as its shares, marked exact", () => {
    expect(stockShareEquivalent(rational('200'))).toEqual({ kind: 'Estimate', value: 200, exact: true });
  });

  it('should return the assumed rate and the days to expiration used with a session (4% and 18 days on Mon 11-02)', () => {
    expect(rateAndDays(sessionOf(R_BREN_U, BREN_CALL, '2026-11-02'))).toEqual({ rate: 0.04, days: 18 });
  });
});

describe('the Mark Change Split (A259)', () => {
  it("should split R-CORV-D's Mon 11-09 change of −0.95 a share into −0.19 from CORV, −0.32 from time and −0.44 from volatility", () => {
    const split = markChangeSplit(CORV_PUT, before(R_CORV_D, CORV_PUT, '2026-11-09'), sessionOf(R_CORV_D, CORV_PUT, '2026-11-09'));
    if (split.kind !== 'Split' || !('time' in split)) throw new Error(JSON.stringify(split));
    expect([split.underlying, split.time, split.volatility].map(cents)).toEqual([-0.19, -0.32, -0.44]);
  });
  it("should return a remainder so that the four parts add to the Mark's real change exactly", () => {
    const split = markChangeSplit(CORV_PUT, before(R_CORV_D, CORV_PUT, '2026-11-09'), sessionOf(R_CORV_D, CORV_PUT, '2026-11-09'));
    if (split.kind !== 'Split' || !('time' in split)) throw new Error(JSON.stringify(split));
    expect(split.underlying + split.time + split.volatility + split.remainder).toBeCloseTo(4.25 - 5.2, 12);
  });

  it('should use the real days between sessions over a weekend (R-BREN-U Mon 11-09: time −0.27)', () => {
    const split = markChangeSplit(BREN_CALL, before(R_BREN_U, BREN_CALL, '2026-11-09'), sessionOf(R_BREN_U, BREN_CALL, '2026-11-09'));
    if (split.kind !== 'Split' || !('time' in split)) throw new Error(JSON.stringify(split));
    expect(cents(split.time)).toBe(-0.27);
  });

  it("should return the Underlying's part and one part for time and volatility together when the later session has no implied volatility (R-BREN-U Tue 11-17: +1.13 and −0.04)", () => {
    const split = markChangeSplit(BREN_CALL, before(R_BREN_U, BREN_CALL, '2026-11-17'), sessionOf(R_BREN_U, BREN_CALL, '2026-11-17'));
    if (split.kind !== 'Split' || !('timeAndVolatility' in split)) throw new Error(JSON.stringify(split));
    expect([split.underlying, split.timeAndVolatility].map(cents)).toEqual([1.13, -0.04]);
    expect(split.underlying + split.timeAndVolatility + split.remainder).toBeCloseTo(5.25 - 4.16, 12);
    expect(split.remainder).toBe(0);
  });
  it('should not split when the earlier session has no implied volatility, naming that session', () => {
    const split = markChangeSplit(BREN_CALL, before(R_BREN_U, BREN_CALL, '2026-11-18'), sessionOf(R_BREN_U, BREN_CALL, '2026-11-18'));
    expect(split).toMatchObject({ kind: 'Unavailable', reason: 'InsensitiveToVolatility', session: '2026-11-17' });
  });
  it('should not split across a missing Mark, and measure the change from the last session that had one (R-CORV-D Wed 11-11, since 11-09)', () => {
    const split = markChangeSplit(CORV_PUT, before(R_CORV_D, CORV_PUT, '2026-11-11'), sessionOf(R_CORV_D, CORV_PUT, '2026-11-11'));
    expect(split).toMatchObject({ kind: 'Unavailable', reason: 'MarkMissing', session: '2026-11-10', since: '2026-11-09' });
    expect(split.kind === 'Unavailable' && split.change).toBeCloseTo(5.12 - 4.25, 12);
  });
  it('should not split the first session, which has no earlier figure', () => {
    const split = markChangeSplit(CORV_PUT, [], sessionOf(R_CORV_D, CORV_PUT, '2026-11-02'));
    expect(split).toEqual({ kind: 'Unavailable', reason: 'NoEarlierFigure', session: '2026-11-02' });
  });

  it('should not split a session whose own Mark is missing, naming it (R-CORV-D Tue 11-10)', () => {
    const split = markChangeSplit(CORV_PUT, before(R_CORV_D, CORV_PUT, '2026-11-10'), sessionOf(R_CORV_D, CORV_PUT, '2026-11-10'));
    expect(split).toEqual({ kind: 'Unavailable', reason: 'MarkMissing', session: '2026-11-10' });
  });
});
