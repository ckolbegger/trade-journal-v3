import Decimal from 'decimal.js'
import type { ExecutionFact } from './derive'
import type { Result } from './types'

// ReferenceCatalog.resolve(CloseReason) over the seeded, active values. A
// Close Reason is a single-valued trader fact; settlement mechanisms are not.
export type SeededReason = { id: string; label: string; origin?: string; active?: boolean }
export type ResolvedCloseReason = { id: string; label: string }
export type CloseReasonIssue = 'CloseReasonMissing' | 'CloseReasonUnknown' | 'CloseReasonInactive'

export function resolveCloseReason(
  label: string,
  catalog: { closeReasons: SeededReason[] } | undefined,
): Result<ResolvedCloseReason, { issue: CloseReasonIssue }> {
  if (!label || !catalog) return { ok: false, error: { issue: 'CloseReasonMissing' } }
  const matches = catalog.closeReasons.filter(r => r.label === label && r.active !== false)
  if (matches.length === 0) {
    const inactive = catalog.closeReasons.some(r => r.label === label && r.active === false)
    return { ok: false, error: { issue: inactive ? 'CloseReasonInactive' : 'CloseReasonUnknown' } }
  }
  if (matches.length !== 1) return { ok: false, error: { issue: 'CloseReasonUnknown' } }
  return { ok: true, value: { id: matches[0].id, label: matches[0].label } }
}

// Terminal Disposition is derived from effective disposing facts and is never
// an authoritative captured field (ADR 0003).
export type TerminalDisposition =
  | { applicable: false; kind: 'NotApplicable'; mechanisms: [] }
  | {
      applicable: true
      kind: 'FullyDisposedByExecution'
      disposedQuantity: string
      mechanisms: { kind: 'Execution'; quantity: string }[]
    }

export function deriveTerminalDisposition(facts: ExecutionFact[], closed: boolean): TerminalDisposition {
  if (!closed) return { applicable: false, kind: 'NotApplicable', mechanisms: [] }
  const disposed = facts.filter(f => f.action === 'Sell')
  if (disposed.length === 0) return { applicable: false, kind: 'NotApplicable', mechanisms: [] }
  const quantity = disposed.reduce((sum, f) => sum.plus(f.quantity), new Decimal(0))
  const amount = quantity.toString()
  return {
    applicable: true,
    kind: 'FullyDisposedByExecution',
    disposedQuantity: amount,
    mechanisms: [{ kind: 'Execution', quantity: amount }],
  }
}

export type CloseReasonRequirement = 'RequiresCloseReason' | 'RequiresNoCloseReason' | 'NotApplicable'

export function deriveCloseReasonRequirement(facts: ExecutionFact[], closed: boolean): CloseReasonRequirement {
  if (!closed) return 'NotApplicable'
  return facts.some(f => f.action === 'Sell') ? 'RequiresCloseReason' : 'RequiresNoCloseReason'
}
