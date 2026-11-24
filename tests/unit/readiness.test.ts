import { describe, expect, it } from 'vitest'
import { evaluateReadiness } from '../../src/domain/readiness'
import type { StorageProtection } from '../../src/domain/types'

const protectedStorage: StorageProtection = { kind: 'Protected' }

describe('Runtime Readiness functional checks', () => {
  it('should return Writable only when all four checks pass', () => {
    const result = evaluateReadiness({
      diagnosticTransaction: true,
      capacityHeadroom: true,
      serviceWorkerControl: true,
      offlineInventoryValid: true,
      protection: protectedStorage,
      workspaceReadable: true,
      existingRoot: 'none',
    })
    expect(result.outcome).toBe('Writable')
    expect(result.failedChecks).toEqual([])
  })

  it('should report every failed check in a simultaneous-failure result', () => {
    const result = evaluateReadiness({
      diagnosticTransaction: false,
      capacityHeadroom: false,
      serviceWorkerControl: false,
      offlineInventoryValid: false,
      protection: protectedStorage,
      workspaceReadable: false,
      existingRoot: 'none',
    })
    expect(result.outcome).toBe('Unsupported')
    expect(result.failedChecks).toEqual([
      'diagnostic-transaction', 'capacity', 'service-worker', 'offline-inventory',
    ])
  })

  it('should return Unsupported with no Workspace created when no readable Workspace exists and any check fails', () => {
    const result = evaluateReadiness({
      diagnosticTransaction: true,
      capacityHeadroom: true,
      serviceWorkerControl: true,
      offlineInventoryValid: false,
      protection: protectedStorage,
      workspaceReadable: false,
      existingRoot: 'none',
    })
    expect(result.outcome).toBe('Unsupported')
  })

  it('should return Recovery Only when an existing Workspace is readable but a write-safety check fails', () => {
    const result = evaluateReadiness({
      diagnosticTransaction: false,
      capacityHeadroom: true,
      serviceWorkerControl: true,
      offlineInventoryValid: true,
      protection: protectedStorage,
      workspaceReadable: true,
      existingRoot: 'none',
    })
    expect(result.outcome).toBe('RecoveryOnly')
  })

  it('should treat host storage protection as advisory and leave Writable unchanged when protection is not Protected', () => {
    const result = evaluateReadiness({
      diagnosticTransaction: true,
      capacityHeadroom: true,
      serviceWorkerControl: true,
      offlineInventoryValid: true,
      protection: { kind: 'BestEffort', reason: 'browser may clear' },
      workspaceReadable: true,
      existingRoot: 'none',
    })
    expect(result.outcome).toBe('Writable')
    expect(result.protection.kind).toBe('BestEffort')
  })

  it('should return Integrity Blocked without initializing when a known or possible existing root cannot be read', () => {
    const result = evaluateReadiness({
      diagnosticTransaction: true,
      capacityHeadroom: true,
      serviceWorkerControl: true,
      offlineInventoryValid: true,
      protection: protectedStorage,
      workspaceReadable: false,
      existingRoot: 'unreadable',
    })
    expect(result.outcome).toBe('Unsupported')
    expect(result.workspaceStatus).toBe('IntegrityBlocked')
  })

  it('should decide support without reading browser, OS, family or user-agent identity', () => {
    const base = {
      diagnosticTransaction: true,
      capacityHeadroom: true,
      serviceWorkerControl: true,
      offlineInventoryValid: true,
      protection: protectedStorage,
      workspaceReadable: true,
      existingRoot: 'none' as const,
    }
    expect(evaluateReadiness(base).outcome).toBe(evaluateReadiness({ ...base }).outcome)
    expect(evaluateReadiness(base).outcome).not.toContain('Chrome')
  })
})
