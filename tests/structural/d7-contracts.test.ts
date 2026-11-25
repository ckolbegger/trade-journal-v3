import { describe, expect, it } from 'vitest'
import * as closeReview from '../../src/domain/close-review'

describe('D7 public contract (S4 structural)', () => {
  it('should expose only Journal outcome operations and no Trade writer or lifecycle setter', () => {
    for (const name of [
      'prepareCloseReview', 'applyCloseReviewOutcome', 'reopenCloseReviewDebt', 'answerCloseReviewDebt',
    ]) {
      expect(typeof (closeReview as Record<string, unknown>)[name]).toBe('function')
    }
    for (const forbidden of [
      'writeTrade', 'setLifecycle', 'recordExecution', 'applyPreparedChange', 'closeTrade', 'setCloseReason',
    ]) {
      expect(Object.keys(closeReview)).not.toContain(forbidden)
    }
  })

  it('should return a revision-bound outcome from one preparation call', () => {
    const result = closeReview.prepareCloseReview({
      tradeId: 'trade-x', definitionRevision: 'D1', economicTime: '2026-11-23T20:00:00Z',
      disposition: { kind: 'Defer' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.kind).toBe('Debt')
    expect(result.value).toHaveProperty('dueAt')
  })
})
