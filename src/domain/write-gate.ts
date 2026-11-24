import type { ReadinessEvidence, Result, RuntimeNotWritable } from './types'

export type WriteGateError = {
  operation: string
  runtimeNotWritable: RuntimeNotWritable
}

// Every authoritative mutation calls this before beginning a write transaction.
// requestDurability is explicitly exempt: it requests host protection without
// mutating authoritative Workspace data.
export function guardWrite(
  evidence: ReadinessEvidence,
  operation: string,
): Result<void, WriteGateError> {
  if (evidence.outcome === 'Writable') return { ok: true, value: undefined }
  if (operation === 'Workspace.requestDurability') return { ok: true, value: undefined }

  const runtimeNotWritable: RuntimeNotWritable = {
    runtimeReadiness: evidence.outcome,
    failedChecks: evidence.failedChecks,
    workspaceStatus: 'workspaceStatus' in evidence ? evidence.workspaceStatus : 'None',
    safeActions: [
      'Read current journal data and history',
      'Download a backup if the Workspace is readable',
      'Retry the readiness checks',
    ],
  }
  return { ok: false, error: { operation, runtimeNotWritable } }
}
