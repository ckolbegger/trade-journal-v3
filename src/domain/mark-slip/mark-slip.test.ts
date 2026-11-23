import { describe, expect, it } from 'vitest'
import { checkMarkSlip, markChange, MARK_SLIP_LIMITS } from './index.ts'
import { Rational } from '../values/index.ts'
import type { Instrument } from '../instrument/index.ts'

const stock: Instrument = { kind: 'Stock', symbol: 'XYZ' }
const option: Instrument = { kind: 'Option', symbol: 'XYZ', root: 'XYZ', expiration: '2026-11-20', strike: '55', right: 'Call', multiplier: 100 }

describe('The Mark slip check (P167)', () => {
  it('should pass a stock or Underlying Mark within 5% of the last Mark', () => {
    expect(checkMarkSlip({ instrument: stock, entry: '47.35', lastMark: '45.10' })).toEqual({ kind: 'Pass' })
    expect(checkMarkSlip({ instrument: stock, entry: '47.36', lastMark: '45.10' }).kind).toBe('Moved')
    expect(checkMarkSlip({ instrument: stock, entry: '42.845', lastMark: '45.10' })).toEqual({ kind: 'Pass' })
    expect(checkMarkSlip({ instrument: stock, entry: '45.10', lastMark: '45.10' })).toEqual({ kind: 'Pass' })
  })
  it('should ask about one more than 5% above or below, giving the move in percent', () => {
    expect(checkMarkSlip({ instrument: stock, entry: '49.00', lastMark: '45.10' })).toEqual({ kind: 'Moved', percent: '+8.6' })
    expect(checkMarkSlip({ instrument: stock, entry: '42.00', lastMark: '45.10' })).toEqual({ kind: 'Moved', percent: '−6.9' })
  })
  it('should pass an option Mark up to 100% above or 50% below the last, and ask beyond either', () => {
    expect(checkMarkSlip({ instrument: option, entry: '90.00', lastMark: '45.00' })).toEqual({ kind: 'Pass' })
    expect(checkMarkSlip({ instrument: option, entry: '22.50', lastMark: '45.00' })).toEqual({ kind: 'Pass' })
    expect(checkMarkSlip({ instrument: option, entry: '100.00', lastMark: '45.00' })).toEqual({ kind: 'Moved', percent: '+122.2' })
    expect(checkMarkSlip({ instrument: option, entry: '22.49', lastMark: '45.00' }).kind).toBe('Moved')
  })
  it('should offer the price ten times smaller or larger when that lands near the last Mark, and the same for a hundred times', () => {
    expect(checkMarkSlip({ instrument: stock, entry: '440.00', lastMark: '45.10' })).toEqual({ kind: 'Scaled', factor: 10, candidate: '44.00' })
    expect(checkMarkSlip({ instrument: stock, entry: '4.40', lastMark: '45.10' })).toEqual({ kind: 'Scaled', factor: 10, candidate: '44.00' })
    expect(checkMarkSlip({ instrument: stock, entry: '4510.00', lastMark: '45.10' })).toEqual({ kind: 'Scaled', factor: 100, candidate: '45.10' })
    expect(checkMarkSlip({ instrument: stock, entry: '0.451', lastMark: '45.10' })).toEqual({ kind: 'Scaled', factor: 100, candidate: '45.10' })
    expect(checkMarkSlip({ instrument: option, entry: '0.44', lastMark: '4.50' })).toEqual({ kind: 'Scaled', factor: 10, candidate: '4.40' })
    expect(checkMarkSlip({ instrument: stock, entry: '880.00', lastMark: '45.10' }).kind).toBe('Moved')
  })
  it('should offer a ten or hundred times reading only when the price it shows lies within the limits', () => {
    // 0.000115 / 10 = 0.0000115 is within 5% of 0.000011, but the shown 0.000012 is 9.1% above it.
    expect(checkMarkSlip({ instrument: stock, entry: '0.000115', lastMark: '0.000011' }).kind).toBe('Moved')
  })

  it('should ask whether an option is worth nothing at zero, and refuse a zero share price', () => {
    expect(checkMarkSlip({ instrument: option, entry: '0', lastMark: '0.45' })).toEqual({ kind: 'WorthNothing' })
    expect(checkMarkSlip({ instrument: option, entry: '0.00', lastMark: '0.45' })).toEqual({ kind: 'WorthNothing' })
    expect(checkMarkSlip({ instrument: stock, entry: '0.00', lastMark: '45.10' })).toEqual({ kind: 'ZeroSharePrice' })
    expect(checkMarkSlip({ instrument: stock, entry: '0' })).toEqual({ kind: 'ZeroSharePrice' })
  })
  it('should not ask whether an option is worth nothing on its expiration day', () => {
    expect(checkMarkSlip({ instrument: option, entry: '0.00', lastMark: '0.45', expiresOnReviewDate: true })).toEqual({ kind: 'Pass' })
    expect(checkMarkSlip({ instrument: option, entry: '0.00', lastMark: '0.45', expiresOnReviewDate: false })).toEqual({ kind: 'WorthNothing' })
  })
  it('should refuse an entry that is not a price', () => {
    for (const entry of ['', 'abc', '45,10', '$45.10', '1e3', '-5', '45.1234567', ' 45.10']) {
      expect(checkMarkSlip({ instrument: stock, entry, lastMark: '45.10' })).toEqual({ kind: 'NotAPrice' })
    }
    expect(checkMarkSlip({ instrument: option, entry: 'x' })).toEqual({ kind: 'NotAPrice' })
  })
  it('should pass any Mark when there is no last Mark', () => {
    expect(checkMarkSlip({ instrument: stock, entry: '4500.00' })).toEqual({ kind: 'Pass' })
    expect(checkMarkSlip({ instrument: option, entry: '0' })).toEqual({ kind: 'Pass' })
    expect(checkMarkSlip({ instrument: option, entry: '12.00', lastMark: '0' })).toEqual({ kind: 'Pass' })
  })
  it('should apply a fractional limit, such as 5.5 percent, without throwing', () => {
    const fractional = { stock: { up: 5.5, down: 5.5 }, option: { up: 100, down: 50 } }
    expect(checkMarkSlip({ instrument: stock, entry: '47.53', lastMark: '45.10' }, fractional)).toEqual({ kind: 'Pass' })
    expect(checkMarkSlip({ instrument: stock, entry: '47.64', lastMark: '45.10' }, fractional)).toEqual({ kind: 'Moved', percent: '+5.6' })
    expect(checkMarkSlip({ instrument: stock, entry: '42.62', lastMark: '45.10' }, fractional)).toEqual({ kind: 'Pass' })
    expect(checkMarkSlip({ instrument: stock, entry: '42.60', lastMark: '45.10' }, fractional)).toEqual({ kind: 'Moved', percent: '−5.5' })
  })
  it('should take every limit from one exported constant', () => {
    expect(MARK_SLIP_LIMITS).toEqual({ stock: { up: 5, down: 5 }, option: { up: 100, down: 50 } })
    const wide = { stock: { up: 10, down: 10 }, option: { up: 200, down: 80 } }
    expect(checkMarkSlip({ instrument: stock, entry: '48.00', lastMark: '45.10' }).kind).toBe('Moved')
    expect(checkMarkSlip({ instrument: stock, entry: '48.00', lastMark: '45.10' }, wide)).toEqual({ kind: 'Pass' })
    expect(checkMarkSlip({ instrument: option, entry: '130.00', lastMark: '45.00' }, wide)).toEqual({ kind: 'Pass' })
    expect(checkMarkSlip({ instrument: option, entry: '10.00', lastMark: '45.00' }, wide)).toEqual({ kind: 'Pass' })
  })
})

describe('The change from the previous Mark (T95.12, P167)', () => {
  it('should give the change from the previous Mark in dollars and percent', () => {
    const down = markChange({ entry: '44.00', previous: '45.10' })
    expect(down?.dollars.equals(Rational.of(-110n, 100n))).toBe(true)
    expect(down?.percent).toBe('−2.4')
    const up = markChange({ entry: '49.00', previous: '45.10' })
    expect(up?.dollars.equals(Rational.of(390n, 100n))).toBe(true)
    expect(up?.percent).toBe('+8.6')
    expect(markChange({ entry: '45.10', previous: '45.10' })?.percent).toBe('0.0')
  })
  it('should give dollars alone when the previous Mark is zero, and nothing for an entry or a previous Mark that is not a price', () => {
    const fromZero = markChange({ entry: '0.45', previous: '0' })
    expect(fromZero?.dollars.equals(Rational.of(45n, 100n))).toBe(true)
    expect(fromZero?.percent).toBeUndefined()
    expect(markChange({ entry: 'abc', previous: '45.10' })).toBeUndefined()
    expect(markChange({ entry: '', previous: '45.10' })).toBeUndefined()
    expect(markChange({ entry: '-5', previous: '45.10' })).toBeUndefined()
    expect(markChange({ entry: '44.00', previous: 'x' })).toBeUndefined()
  })
})
