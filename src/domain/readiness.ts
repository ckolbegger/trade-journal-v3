import type {
  ReadinessEvidence,
  RuntimeReadinessFailure,
  StorageProtection,
} from './types'

export type ReadinessInput = {
  diagnosticTransaction: boolean
  capacityHeadroom: boolean
  serviceWorkerControl: boolean
  offlineInventoryValid: boolean
  protection: StorageProtection
  workspaceReadable: boolean
  existingRoot: 'none' | 'unreadable'
}

const CHECKS: { key: keyof ReadinessInput; failure: RuntimeReadinessFailure }[] = [
  { key: 'diagnosticTransaction', failure: 'diagnostic-transaction' },
  { key: 'capacityHeadroom', failure: 'capacity' },
  { key: 'serviceWorkerControl', failure: 'service-worker' },
  { key: 'offlineInventoryValid', failure: 'offline-inventory' },
]

export function evaluateReadiness(input: ReadinessInput): ReadinessEvidence & {
  workspaceStatus: 'RecoveryOnly' | 'IntegrityBlocked' | 'None'
} {
  const failedChecks = CHECKS
    .filter(c => input[c.key] === false)
    .map(c => c.failure)

  const writable = failedChecks.length === 0

  let outcome: ReadinessEvidence['outcome']
  let workspaceStatus: 'RecoveryOnly' | 'IntegrityBlocked' | 'None'

  if (input.existingRoot === 'unreadable') {
    outcome = 'Unsupported'
    workspaceStatus = 'IntegrityBlocked'
  } else if (writable) {
    outcome = 'Writable'
    workspaceStatus = 'None'
  } else if (input.workspaceReadable) {
    outcome = 'RecoveryOnly'
    workspaceStatus = 'RecoveryOnly'
  } else {
    outcome = 'Unsupported'
    workspaceStatus = 'None'
  }

  return {
    outcome,
    passed: writable && input.existingRoot !== 'unreadable',
    failedChecks,
    protection: input.protection,
    workspaceStatus,
  }
}
