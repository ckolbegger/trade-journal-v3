import { describe, expect, it } from 'vitest'
import { orderTaskFamilies, resolveReviewDate } from '../../src/domain/review-order'

describe('D5 exact-date eligibility and task order (S4 structural)', () => {
  it('should resolve the latest completed session as the Review Date', () => {
    expect(resolveReviewDate(new Date('2026-11-24T17:00:00Z'))).toBe('2026-11-23')
  })

  it('should order Marks, Debt, settlement and the Trade walk without a stored list', () => {
    expect(orderTaskFamilies({
      missingMarks: ['AAPL'], dueDebt: ['Debt:1'], settlementDue: ['SPY'],
      trades: ['trade-aapl'],
    })).toEqual([
      { kind: 'Marks', items: ['AAPL'] },
      { kind: 'Debt', items: ['Debt:1'] },
      { kind: 'Settlement', items: ['SPY'] },
      { kind: 'Trades', items: ['trade-aapl'] },
    ])
  })

  it('should report Empty when no task family has items', () => {
    expect(orderTaskFamilies({ missingMarks: [], dueDebt: [], settlementDue: [], trades: [] })).toEqual([])
  })
})
