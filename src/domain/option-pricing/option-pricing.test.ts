import { describe, expect, it } from 'vitest'
import { impliedVolatility, optionDelta, optionPrice, rateForDays } from './index'

// R-BREN-U: BREN, a $100 call expiring Fri 11-20, sessions Mon 11-02 (18 days), Wed 11-11 (9), Tue 11-17 (3).
const BREN = { strike: 100, rate: 0.04 }
describe('option pricing (A258)', () => {
  it('should price a Call and a Put so that Call − Put = Underlying − strike discounted, to nine decimal places', () => {
    for (const [s, k, days, vol, r] of [[97.2, 100, 18, 0.32, 0.04], [76.5, 80, 14, 0.4, 0.04], [56.9, 57.5, 400, 0.5, 0.0525], [150, 100, 3, 0.2, 0.04]] as const) {
      const call = optionPrice('Call', s, k, days, vol, r)
      const put = optionPrice('Put', s, k, days, vol, r)
      expect(call - put).toBeCloseTo(s - k * Math.exp(-r * (days / 365)), 9)
      expect(optionDelta('Call', s, k, days, vol, r) - optionDelta('Put', s, k, days, vol, r)).toBeCloseTo(1, 9)
    }
  })
  it('should price an option at 0 days at its exercise value', () => {
    expect(optionPrice('Call', 105, 100, 0, 0.3, 0.04)).toBe(5)
    expect(optionPrice('Call', 95, 100, 0, 0.3, 0.04)).toBe(0)
    expect(optionPrice('Put', 95, 100, 0, 0.3, 0.04)).toBe(5)
    expect(optionPrice('Put', 105, 100, 0, 0.3, 0.04)).toBe(0)
  })
})

describe('implied volatility (A258)', () => {
  it('should read 32.0% for R-BREN-U on Mon 11-02: BREN 97.20, the call 1.68, 18 days, 4%', () => {
    const result = impliedVolatility('Call', 1.68, 97.2, BREN.strike, 18, BREN.rate)
    expect(result.kind).toBe('Volatility')
    if (result.kind === 'Volatility') expect(Math.round(result.value * 1000) / 10).toBe(32.0)
  })
  it('should return a volatility that prices back to the Mark within half a cent', () => {
    const rows = [
      ['Call', 1.68, 97.2, 100, 18],
      ['Call', 2.91, 101.8, 100, 9],
      ['Put', 5.2, 76.5, 80, 14],
      ['Put', 2.14, 56.9, 57.5, 11],
      ['Put', 0.35, 100, 80, 200],
    ] as const
    for (const [kind, mark, s, k, days] of rows) {
      const result = impliedVolatility(kind, mark, s, k, days, 0.04)
      expect(result.kind).toBe('Volatility')
      if (result.kind === 'Volatility') expect(Math.abs(optionPrice(kind, s, k, days, result.value, 0.04) - mark)).toBeLessThan(0.005)
    }
  })
  it('should be Unavailable, expiration session, at 0 days', () => {
    expect(impliedVolatility('Call', 5.25, 105.2, 100, 0, 0.04)).toEqual({ kind: 'Unavailable', reason: 'ExpirationSession' })
  })
  it('should be Unavailable, at or below exercise value, when the Mark is within half a cent of its floor', () => {
    expect(impliedVolatility('Call', 0.004, 90, 100, 18, 0.04)).toEqual({ kind: 'Unavailable', reason: 'AtOrBelowExerciseValue' })
    expect(impliedVolatility('Call', 5.003, 105, 100, 18, 0.04)).toEqual({ kind: 'Unavailable', reason: 'AtOrBelowExerciseValue' })
    expect(impliedVolatility('Put', 4.803, 95, 100, 18, 0.04)).toEqual({ kind: 'Unavailable', reason: 'AtOrBelowExerciseValue' })
  })
  it('should be Unavailable, no volatility fits, when the Mark is above the price at 500%', () => {
    expect(optionPrice('Call', 100, 100, 18, 5, 0.04)).toBeLessThan(60)
    expect(impliedVolatility('Call', 60, 100, 100, 18, 0.04)).toEqual({ kind: 'Unavailable', reason: 'NoVolatilityFits' })
  })
  it('should be Unavailable, insensitive to volatility, when one volatility point moves the price by under half a cent, R-BREN-U Tue 11-17', () => {
    expect(impliedVolatility('Call', 5.25, 105.2, BREN.strike, 3, BREN.rate)).toEqual({ kind: 'Unavailable', reason: 'InsensitiveToVolatility' })
  })
})

describe('the assumed rate (P122)', () => {
  it('should use 4% up to 365 days to expiration and 5.25% beyond', () => {
    expect(rateForDays(0)).toBe(0.04)
    expect(rateForDays(365)).toBe(0.04)
    expect(rateForDays(366)).toBe(0.0525)
    expect(rateForDays(900)).toBe(0.0525)
  })
})
