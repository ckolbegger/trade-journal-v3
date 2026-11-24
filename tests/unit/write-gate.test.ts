import { describe, expect, it } from 'vitest'
import { guardWrite } from '../../src/domain/write-gate'
import type { ReadinessEvidence } from '../../src/domain/types'

const evidence = (overrides: Partial<ReadinessEvidence> = {}): ReadinessEvidence => ({
  outcome: 'Writable',
  passed: true,
  failedChecks: [],
  protection: { kind: 'Protected' },
  ...overrides,
})

describe('RuntimeNotWritable write gate', () => {
  it('should return the RuntimeNotWritable branch when the session is not Writable', () => {
    const result = guardWrite(evidence({ outcome: 'RecoveryOnly', passed: false }), 'Workspace.initialize')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.operation).toBe('Workspace.initialize')
  })

  it('should carry readiness outcome, every failed check, status and safe actions', () => {
    const result = guardWrite(
      evidence({
        outcome: 'Unsupported',
        passed: false,
        failedChecks: ['capacity', 'service-worker'],
      }),
      'ReferenceCatalog.save',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.runtimeNotWritable.runtimeReadiness).toBe('Unsupported')
      expect(result.error.runtimeNotWritable.failedChecks).toEqual(['capacity', 'service-worker'])
      expect(result.error.runtimeNotWritable.workspaceStatus).toBe('None')
      expect(result.error.runtimeNotWritable.safeActions.length).toBeGreaterThan(0)
    }
  })

  it('should allow the write when the session is Writable', () => {
    expect(guardWrite(evidence(), 'Workspace.initialize').ok).toBe(true)
  })

  it('should exempt requestDurability from the write gate', () => {
    expect(guardWrite(evidence({ outcome: 'RecoveryOnly', passed: false }), 'Workspace.requestDurability').ok).toBe(true)
  })
})
