import { describe, expect, it } from 'vitest'
import * as close from '../../src/domain/close'

describe('D6 terminal vocabulary (S3 structural)', () => {
  it('should expose only derived terminal vocabulary and no lifecycle setter', () => {
    for (const name of ['resolveCloseReason', 'deriveTerminalDisposition', 'deriveCloseReasonRequirement']) {
      expect(typeof (close as Record<string, unknown>)[name]).toBe('function')
    }
    for (const forbidden of ['setLifecycle', 'closeTrade', 'captureDisposition']) {
      expect(Object.keys(close)).not.toContain(forbidden)
    }
  })

  it('should derive Terminal Disposition only from facts and never accept a stored disposition field', () => {
    const result = close.deriveTerminalDisposition([], false)
    expect(result).toEqual({ applicable: false, kind: 'NotApplicable', mechanisms: [] })
    expect(JSON.stringify(result)).not.toContain('closeReason')
  })
})
