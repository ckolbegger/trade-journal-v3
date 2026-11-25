import { describe, expect, it } from 'vitest'
import {
  deriveCloseReasonRequirement, deriveTerminalDisposition, resolveCloseReason,
  type SeededReason,
} from '../../src/domain/close'
import type { ExecutionFact } from '../../src/domain/derive'

const catalog = {
  closeReasons: [
    { id: 'seed-target-reached', label: 'Target Reached', origin: 'product' },
    { id: 'seed-stop-triggered', label: 'Stop Triggered', origin: 'product' },
    { id: 'seed-rolled', label: 'Rolled', origin: 'product' },
    { id: 'retired', label: 'Old Exit', origin: 'product', active: false },
  ] satisfies SeededReason[],
}

const buy = (id: string): ExecutionFact => ({
  id, instrument: 'AAPL', action: 'Buy', quantity: '10', price: '100', fee: '1',
  economicTime: '2026-11-24T20:00:00Z', recordedSequence: 1,
})
const sell = (id: string): ExecutionFact => ({
  id, instrument: 'AAPL', action: 'Sell', quantity: '10', price: '110', fee: '1',
  economicTime: '2026-11-25T20:00:00Z', recordedSequence: 1,
})

describe('terminal Close Reason', () => {
  it('should resolve exactly one active seeded Close Reason to its stable identity', () => {
    const result = resolveCloseReason('Target Reached', catalog)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({ id: 'seed-target-reached', label: 'Target Reached' })
  })

  it('should reject an unknown, non-active or non-seeded Close Reason without a write', () => {
    for (const label of ['', 'Expired', 'Assigned', 'Other', 'Old Exit']) {
      const result = resolveCloseReason(label, catalog)
      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(result.error.issue).toBeTruthy()
    }
  })

  it('should require exactly one Close Reason for trader agency and none for no-agency settlement', () => {
    expect(deriveCloseReasonRequirement([buy('b'), sell('s')], true)).toBe('RequiresCloseReason')
    expect(deriveCloseReasonRequirement([buy('b')], true)).toBe('RequiresNoCloseReason')
    expect(deriveCloseReasonRequirement([buy('b'), sell('s')], false)).toBe('NotApplicable')
  })

  it('should derive Terminal Disposition from disposing mechanisms only and keep it separate from the Close Reason', () => {
    expect(deriveTerminalDisposition([buy('b')], false)).toEqual({
      applicable: false, kind: 'NotApplicable', mechanisms: [],
    })
    expect(deriveTerminalDisposition([buy('b'), sell('s')], true)).toEqual({
      applicable: true,
      kind: 'FullyDisposedByExecution',
      disposedQuantity: '10',
      mechanisms: [{ kind: 'Execution', quantity: '10' }],
    })
    const resolved = resolveCloseReason('Target Reached', catalog)
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.value).not.toHaveProperty('disposition')
  })
})
