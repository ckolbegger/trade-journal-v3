import { describe, it, expect } from 'vitest'
import { isMarketClosed, bridgesOnlyClosure } from './dates'

describe('domain/dates.isMarketClosed', () => {
  it('returns true for Saturday and Sunday', () => {
    expect(isMarketClosed('2026-07-11')).toBe(true) // Saturday
    expect(isMarketClosed('2026-07-12')).toBe(true) // Sunday
  })

  it('returns false for a weekday', () => {
    expect(isMarketClosed('2026-07-13')).toBe(false) // Monday
  })
})

describe('domain/dates.bridgesOnlyClosure', () => {
  it('returns true when the only dates strictly between are a weekend', () => {
    // Friday 07-10 -> Monday 07-13: Saturday and Sunday lie strictly between.
    expect(bridgesOnlyClosure('2026-07-10', '2026-07-13')).toBe(true)
  })

  it('returns true for adjacent dates (nothing strictly between)', () => {
    expect(bridgesOnlyClosure('2026-07-13', '2026-07-14')).toBe(true)
  })

  it('returns false when a weekday lies strictly between', () => {
    // Friday 07-10 -> Tuesday 07-14: Monday 07-13 lies strictly between.
    expect(bridgesOnlyClosure('2026-07-10', '2026-07-14')).toBe(false)
  })
})
