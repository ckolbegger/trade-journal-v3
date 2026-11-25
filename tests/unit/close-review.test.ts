import { describe, expect, it } from 'vitest'
import {
  applyCloseReviewOutcome, answerCloseReviewDebt, closeReviewObligationKey,
  prepareCloseReview, reopenCloseReviewDebt,
  type CloseReviewOutcome,
} from '../../src/domain/close-review'

const command = (disposition: Parameters<typeof prepareCloseReview>[0]['disposition'], revision = 'D1') => ({
  tradeId: 'trade-close', definitionRevision: revision, economicTime: '2026-11-23T20:00:00Z',
  authoredAt: '2026-11-23T20:05:00Z', disposition,
})

const complete = { kind: 'Complete' as const, form: { takeAgain: 'No', workedAndDidNot: 'Entry was late', keyLesson: 'Wait for confirmation' } }

describe('Close Review preparation', () => {
  it('should snapshot the exact D1 definition and role-keyed answers for a completed review with Source Trade Close', () => {
    const result = prepareCloseReview(command(complete))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({
      kind: 'Entry', obligationKey: 'CloseReview:trade-close', revision: '1', status: 'Saved',
    })
    if (result.value.kind !== 'Entry') return
    expect(result.value.snapshot).toMatchObject({
      definitionRevision: 'D1', definitionType: 'Close Review',
      answers: { TakeAgain: 'No', WorkedAndDidNot: 'Entry was late', KeyLesson: 'Wait for confirmation' },
      source: 'Trade Close',
      anchor: { kind: 'Trade', tradeId: 'trade-close' },
      origin: { kind: 'TradeClose', tradeId: 'trade-close' },
      moment: '2026-11-23T20:00:00Z', authoredAt: '2026-11-23T20:05:00Z',
    })
    expect(result.value.snapshot.prompts).toHaveLength(3)
  })

  it('should require the TakeAgain answer and accept the optional text answers', () => {
    expect(prepareCloseReview(command({ kind: 'Complete', form: { takeAgain: '' } }))).toMatchObject({
      ok: false, error: { issues: ['TakeAgain'] },
    })
    const minimal = prepareCloseReview(command({ kind: 'Complete', form: { takeAgain: 'Unsure' } }))
    expect(minimal.ok).toBe(true)
    if (!minimal.ok) return
    if (minimal.value.kind !== 'Entry') return
    expect(minimal.value.snapshot.answers).toEqual({ TakeAgain: 'Unsure' })
  })

  it('should create one Outstanding Debt with the trigger-time snapshot and a next-Review due date, never a blank Entry', () => {
    const result = prepareCloseReview(command({ kind: 'Defer' }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({
      kind: 'Debt', obligationKey: 'CloseReview:trade-close', status: 'Outstanding',
      dueSemantics: 'DueAtNextDailyReview', dueAt: '2026-11-23',
      settlementRoute: 'Journal.save(ResolveDebt)',
      anchor: { kind: 'Trade', tradeId: 'trade-close' },
      origin: { kind: 'TradeClose', tradeId: 'trade-close' },
    })
    if (result.value.kind !== 'Debt') return
    expect(result.value.snapshot).toMatchObject({ definitionRevision: 'D1', definitionType: 'Close Review' })
    expect(result.value.snapshot.answers).toBeUndefined()
  })

  it('should record a distinct JournalDecline with a reason and no Entry', () => {
    const result = prepareCloseReview(command({ kind: 'Decline', reason: 'not useful right now' }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({
      kind: 'JournalDecline', obligationKey: 'CloseReview:trade-close',
      reason: 'not useful right now', status: 'Declined',
    })
    expect(result.value).not.toHaveProperty('snapshot.answers')
  })

  it('should reject a form bound to the wrong definition revision with no outcome', () => {
    expect(prepareCloseReview(command(complete, 'D2'))).toMatchObject({
      ok: false, error: { issues: ['DefinitionRevision'] },
    })
  })
})

describe('Close Review obligations', () => {
  const prepared = (): CloseReviewOutcome => {
    const result = prepareCloseReview(command(complete))
    if (!result.ok) throw new Error('fixture')
    return result.value
  }

  it('should keep exactly one current outcome per obligation key under repeated attempts', () => {
    expect(applyCloseReviewOutcome(undefined, prepared(), 'attempt-1').ok).toBe(true)
    expect(applyCloseReviewOutcome(prepared(), prepared(), 'attempt-2')).toMatchObject({
      ok: false, error: { issue: 'ObligationAlreadySettled' },
    })
  })

  it('should return Conflict with no write when the existing outcome revision is stale', () => {
    expect(applyCloseReviewOutcome(prepared(), prepared(), 'attempt-3', '9')).toMatchObject({
      ok: false, error: { issue: 'StaleRevision' },
    })
  })

  it('should keep the Close Review key distinct from the Position Change Reflection and Daily Review keys', () => {
    expect(closeReviewObligationKey('trade-close')).toBe('CloseReview:trade-close')
    expect(closeReviewObligationKey('trade-close')).not.toContain('PositionChange')
    expect(closeReviewObligationKey('trade-close')).not.toContain('DailyReview')
  })

  it('should reopen the same Debt when the sole Debt-settlement Entry is voided', () => {
    const debtResult = prepareCloseReview(command({ kind: 'Defer' }))
    expect(debtResult.ok).toBe(true)
    if (!debtResult.ok) return
    const debt = debtResult.value
    if (debt.kind !== 'Debt') return
    const answered = answerCloseReviewDebt(debt, { takeAgain: 'Yes, as planned' }, '2026-11-23T20:10:00Z')
    expect(answered.ok).toBe(true)
    if (!answered.ok) return
    const entry = answered.value
    if (entry.kind !== 'Entry') return
    expect(entry.settlesDebtId).toBe(debt.id)
    const reopened = reopenCloseReviewDebt(entry, debt.id)
    expect(reopened).toMatchObject({ kind: 'Debt', obligationKey: debt.obligationKey, dueAt: debt.dueAt })
  })

  it('should answer a deferred Debt against its original snapshot and settle the same obligation', () => {
    const debtResult = prepareCloseReview(command({ kind: 'Defer' }))
    expect(debtResult.ok).toBe(true)
    if (!debtResult.ok) return
    const debt = debtResult.value
    if (debt.kind !== 'Debt') return
    const answered = answerCloseReviewDebt(debt, { takeAgain: 'Yes, with changes' }, '2026-11-23T20:10:00Z')
    expect(answered.ok).toBe(true)
    if (!answered.ok) return
    expect(answered.value).toMatchObject({
      kind: 'Entry', obligationKey: debt.obligationKey, settlesDebtId: debt.id,
    })
    if (answered.value.kind !== 'Entry') return
    expect(answered.value.snapshot.answers).toEqual({ TakeAgain: 'Yes, with changes' })
    expect(answered.value.snapshot.definitionRevision).toBe(debt.snapshot.definitionRevision)
  })
})
