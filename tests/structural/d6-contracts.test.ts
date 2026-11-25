import { describe, expect, it } from 'vitest'
import * as workflow from '../../src/domain/record-close'

describe('D6 public contract (S4 structural)', () => {
  it('should expose one terminal command and no lifecycle setter or generic close operation', () => {
    expect(typeof workflow.recordClose).toBe('function')
    for (const forbidden of ['setLifecycle', 'closeTrade', 'captureDisposition', 'formula']) {
      expect(Object.keys(workflow)).not.toContain(forbidden)
    }
  })

  it('should derive a receipt and post-commit projection from one command call', () => {
    expect(typeof workflow.recordClose).toBe('function')
    expect(Object.keys(workflow)).not.toContain('applyPreparedChangeDirectly')
  })
})
