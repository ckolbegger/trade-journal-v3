import { describe, expect, it } from 'vitest'
import {
  POSITION_CHANGE_REFLECTION_DEFINITION, applyReflectionOutcome,
  positionChangeObligationKey, preparePositionChangeReflection, reopenDebtOnVoid,
  type ReflectionOutcome,
} from '../../src/domain/position-change-reflection'

const complete = {
  kind: 'Complete' as const,
  form: { decisionMode: 'As Planned', primaryEmotion: 'Calm', decisionConfidence: 4, note: 'Sized in' },
}
const base = { positionChangeId: 'pc-1', tradeId: 'trade-aapl', definitionRevision: 'D1' }

describe('Position Change Reflection', () => {
  it('should return the exact initial Position Change Reflection definition with its four prompts and requiredness', () => {
    expect(POSITION_CHANGE_REFLECTION_DEFINITION.type).toBe('Position Change Reflection')
    expect(POSITION_CHANGE_REFLECTION_DEFINITION.prompts.map(p => [p.id, p.required])).toEqual([
      ['decisionMode', true], ['primaryEmotion', true], ['decisionConfidence', true], ['note', false],
    ])
    expect(positionChangeObligationKey('pc-1')).toBe('PositionChange:pc-1')
  })

  it('should snapshot the exact definition revision shown for a completed Entry', () => {
    const result = preparePositionChangeReflection({ ...base, disposition: complete })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.kind).toBe('Entry')
    if (result.value.kind !== 'Entry') return
    expect(result.value.snapshot.definitionRevision).toBe('D1')
    expect(result.value.snapshot.answers).toEqual({
      DecisionMode: 'As Planned', PrimaryEmotion: 'Calm', DecisionConfidence: 4, Note: 'Sized in',
    })
    expect(result.value.snapshot.source).toBe('Position Change')
  })

  it('should prepare an explicit decline with reason and no Entry', () => {
    const result = preparePositionChangeReflection({ ...base, disposition: { kind: 'Decline', reason: 'No time' } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({ kind: 'Decline', reason: 'No time', obligationKey: 'PositionChange:pc-1' })
    expect(result.value.kind).not.toBe('Entry')
  })

  it('should prepare a Defer as one Outstanding Debt with the trigger-time definition snapshot and no blank Entry', () => {
    const result = preparePositionChangeReflection({ ...base, disposition: { kind: 'Defer' } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.kind).toBe('Debt')
    if (result.value.kind !== 'Debt') return
    expect(result.value.obligationKey).toBe('PositionChange:pc-1')
    expect(result.value.snapshot.definitionRevision).toBe('D1')
    expect(result.value.snapshot.prompts).toHaveLength(4)
    expect(result.value.snapshot.answers).toBeUndefined()
  })

  it('should keep exactly one current outcome for an obligation key under repeated complete/decline/defer attempts', () => {
    const first = preparePositionChangeReflection({ ...base, disposition: { kind: 'Defer' } })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const applied = applyReflectionOutcome(undefined, first.value, 'attempt-1')
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    const retry = applyReflectionOutcome(applied.value.outcome, first.value, 'attempt-2')
    expect(retry.ok).toBe(false)
    if (retry.ok) return
    expect(retry.error.issue).toBe('ObligationAlreadySettled')
  })

  it('should reject a missing required answer for a completed form with typed issues and no prepared effect', () => {
    const result = preparePositionChangeReflection({
      ...base,
      disposition: { kind: 'Complete', form: { decisionMode: 'As Planned', primaryEmotion: 'Calm', decisionConfidence: 0 } },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues).toContain('DecisionConfidence')
  })

  it('should reopen the same Debt when the sole Debt-settlement Entry is Voided', () => {
    const settled: ReflectionOutcome = {
      kind: 'Entry',
      obligationKey: 'PositionChange:pc-1',
      snapshot: { definitionRevision: 'D1', answers: { DecisionMode: 'As Planned' }, source: 'Position Change' },
      settledDebtId: 'debt-1',
      debtSnapshot: { definitionRevision: 'D1', prompts: POSITION_CHANGE_REFLECTION_DEFINITION.prompts },
    }
    const reopened = reopenDebtOnVoid(settled, 'debt-1')
    expect(reopened.kind).toBe('Debt')
    if (reopened.kind !== 'Debt') return
    expect(reopened.obligationKey).toBe('PositionChange:pc-1')
    expect(reopened.snapshot.definitionRevision).toBe('D1')
    expect(reopenDebtOnVoid(settled, 'debt-other')).toBe(settled)
  })
})
