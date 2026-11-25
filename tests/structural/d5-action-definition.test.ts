import { describe, expect, it } from 'vitest'
import { DAILY_ACTION_DEFINITION, dailyActionKey } from '../../src/domain/daily-action'

describe('D5 Action definition and policy vocabulary (S3 structural)', () => {
  it('should define Hold/Exit/Roll/Adjust with Intent required only for non-Hold', () => {
    expect(DAILY_ACTION_DEFINITION.type).toBe('Daily Trade Review')
    expect(DAILY_ACTION_DEFINITION.prompts[0].options).toEqual(['Hold', 'Exit', 'Roll', 'Adjust'])
    expect(DAILY_ACTION_DEFINITION.prompts[1]).toMatchObject({
      id: 'intent', requiredWhen: ['Exit', 'Roll', 'Adjust'],
    })
    expect(dailyActionKey('trade-aapl', '2026-11-23')).toBe('DailyReview:trade-aapl:2026-11-23')
  })

  it('should expose stable completion and P1/P2 reason codes', async () => {
    const review = await import('../../src/domain/review-completion')
    expect(review.COMPLETION_STATES).toEqual(['Incomplete', 'Complete', 'CompleteWithUnavailableMarks'])
    expect(review.SETTLEMENT_SUBSTATE).toBe('Complete, settlement to record')
    expect(review.REASON_CODES).toContain('MarkMissing')
    expect(review.REASON_CODES).toContain('AcknowledgedUnavailable')
  })
})
