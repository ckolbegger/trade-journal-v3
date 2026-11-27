import { describe, expect, it } from 'vitest'
import {
  daySummary, meterPercent, orderReviewItems, reviewSteps,
} from '../../src/ui/review-visual'

describe('Daily Review composition helpers', () => {
  it('should describe the day with trade, Mark and Action counts', () => {
    expect(daySummary(3, 2, 1)).toBe('3 Trades · 2 Marks, 1 Actions to go')
  })

  it('should map task families onto the three-step prototype stepper', () => {
    expect(reviewSteps([])).toEqual(['', '', ''])
    expect(reviewSteps(['Marks', 'Debt', 'Trades'])).toEqual(['now', '', ''])
    expect(reviewSteps(['Trades'])).toEqual(['ok', 'now', ''])
    expect(reviewSteps(['Debt', 'Settlement'])).toEqual(['ok', '', 'now'])
  })

  it('should order trade cards most pressing first by attention band', () => {
    const items = [
      { id: 'routine', band: 'Routine' },
      { id: 'blocker', band: 'Blocker' },
      { id: 'boundary', band: 'Boundary' },
    ]
    expect(orderReviewItems(items).map(i => i.id)).toEqual(['blocker', 'boundary', 'routine'])
  })

  it('should clamp the plan meter between Stop and Target without inventing prices', () => {
    expect(meterPercent('1', '1', '7')).toBe(0)
    expect(meterPercent('4', '1', '7')).toBe(50)
    expect(meterPercent('7', '1', '7')).toBe(100)
    expect(meterPercent('99', '1', '7')).toBe(100)
    expect(meterPercent(undefined, '1', '7')).toBeNull()
  })
})
