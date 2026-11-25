import { describe, expect, it } from 'vitest'
import {
  applyActionOutcome, dailyActionKey, prepareAction, unsavedActionView,
  type DailyActionForm,
} from '../../src/domain/daily-action'

const hold: DailyActionForm = { action: 'Hold' }

describe('Daily Trade Review Action', () => {
  it('should accept one-click unchanged Hold and require Intent for Exit, Roll and Adjust', () => {
    const result = prepareAction(hold, 'D1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.snapshot.answers.Action).toBe('Hold')
    expect(result.value.snapshot.definitionRevision).toBe('D1')
    for (const action of ['Exit', 'Roll', 'Adjust'] as const) {
      expect(prepareAction({ action }, 'D1').ok).toBe(false)
    }
    expect(prepareAction({ action: 'Exit', intent: 'thesis broke' }, 'D1').ok).toBe(true)
  })

  it('should preselect Hold only in unsaved view state and record nothing until explicit Save', () => {
    expect(unsavedActionView().action).toBe('Hold')
    expect(dailyActionKey('trade-aapl', '2026-11-23')).toBe('DailyReview:trade-aapl:2026-11-23')
  })

  it('should keep exactly one Action outcome per Trade and Review Date under retries', () => {
    const prepared = prepareAction(hold, 'D1')
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const first = applyActionOutcome(undefined, prepared.value, 'entry-1', undefined)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.value.revision).toBe('1')
    const duplicate = applyActionOutcome(first.value.entry, prepared.value, 'entry-2', '1')
    expect(duplicate.ok).toBe(false)
    if (duplicate.ok) return
    expect(duplicate.error.issue).toBe('DuplicateOutcome')
  })

  it('should edit the same Entry identity under the expected revision rather than duplicate it', () => {
    const prepared = prepareAction(hold, 'D1')
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const first = applyActionOutcome(undefined, prepared.value, 'entry-1', undefined)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const edited = applyActionOutcome(first.value.entry, prepared.value, 'entry-1', '2')
    expect(edited.ok).toBe(false)
    if (edited.ok) return
    expect(edited.error.issue).toBe('StaleRevision')
  })
})
