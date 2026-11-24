// Canonical value shapes for D1. Stable identity and revision are distinct.

export type Revision = string

export type Institution = {
  id: string
  label: string
  active: boolean
  revision: Revision
  history: { label: string; active: boolean; recordedAt: string }[]
}

export type Account = {
  id: string
  institutionId: string
  label: string
  active: boolean
  revision: Revision
  history: { label: string; active: boolean; recordedAt: string }[]
}

export type WorkspaceStatus =
  | 'Ready'
  | 'NeedsInstitutionAndAccount'
  | 'InitializationRequired'
  | 'RecoveryOnly'
  | 'Unsupported'
  | 'IntegrityBlocked'

export type RuntimeReadiness = 'Writable' | 'RecoveryOnly' | 'Unsupported'

export type RuntimeReadinessFailure =
  | 'diagnostic-transaction'
  | 'capacity'
  | 'service-worker'
  | 'offline-inventory'

export type StorageProtection =
  | { kind: 'Protected' }
  | { kind: 'BestEffort'; reason: string }
  | { kind: 'Unavailable'; reason: string }

export type ReadinessEvidence = {
  outcome: RuntimeReadiness
  passed: boolean
  failedChecks: RuntimeReadinessFailure[]
  protection: StorageProtection
}

export type RuntimeNotWritable = {
  runtimeReadiness: Exclude<RuntimeReadiness, 'Writable'>
  failedChecks: RuntimeReadinessFailure[]
  workspaceStatus: 'RecoveryOnly' | 'IntegrityBlocked' | 'None'
  safeActions: string[]
}

export type Result<T, E = never> = { ok: true; value: T } | { ok: false; error: E }
