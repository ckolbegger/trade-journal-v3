import { describe, expect, it } from 'vitest'
import {
  CLOSE_REVIEW_DEFINITION, closeReviewObligationKey, nextReviewDate,
} from '../../src/domain/close-review'
import { positionChangeObligationKey } from '../../src/domain/position-change-reflection'
import { dailyActionKey } from '../../src/domain/daily-action'

describe('D7 exact Close Review definition (S3 structural)', () => {
  it('should declare the exact D1 prompts and options from the frozen journal spec', () => {
    expect(CLOSE_REVIEW_DEFINITION.type).toBe('Close Review')
    expect(CLOSE_REVIEW_DEFINITION.revision).toBe('D1')
    expect(CLOSE_REVIEW_DEFINITION.prompts).toEqual([
      { id: 'takeAgain', role: 'TakeAgain', required: true, kind: 'SingleSelect',
        options: ['Yes, as planned', 'Yes, with changes', 'No', 'Unsure'] },
      { id: 'workedAndDidNot', role: 'WorkedAndDidNot', required: false, kind: 'Text' },
      { id: 'keyLesson', role: 'KeyLesson', required: false, kind: 'Text' },
    ])
  })

  it('should use an obligation key family distinct from Position Change and Daily Review', () => {
    expect(closeReviewObligationKey('trade-x')).toBe('CloseReview:trade-x')
    expect(closeReviewObligationKey('trade-x')).not.toBe(positionChangeObligationKey('trade-x'))
    expect(closeReviewObligationKey('trade-x')).not.toBe(dailyActionKey('trade-x', '2026-11-23'))
  })

  it('should derive the next Review Date from the explicit close instant', () => {
    expect(nextReviewDate('2026-11-23T20:00:00Z')).toBe('2026-11-23')
    expect(nextReviewDate('2026-11-24T17:00:00Z')).toBe('2026-11-23')
  })
})
