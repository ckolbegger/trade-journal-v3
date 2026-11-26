// D8aR R6 — one home for error meaning. Controllers keep typed failures;
// handlers ask this module for wording and surface. Both local field alerts
// and the global banner adapters use the same interface.
const COPY: Record<string, string> = {
  Reflection: 'Decision mode is required.',
  'Reflection:DecisionMode': 'Decision mode is required.',
  'Reflection:PrimaryEmotion': 'Primary emotion is required.',
  'Reflection:DecisionConfidence': 'Decision confidence must be between 1 and 5.',
  DecisionMode: 'Decision mode is required.',
  PrimaryEmotion: 'Primary emotion is required.',
  DecisionConfidence: 'Decision confidence must be between 1 and 5.',
  Note: 'The note is not valid.',
  Invalidation: 'Invalidation is required.',
  Thesis: 'Thesis is required.',
  InvalidExecution: 'Check the quantity, price and fee for every execution.',
  InstrumentMismatch: 'The instrument must match the planned underlying unless explicitly unplanned.',
  MissingPlannedLegIntent: 'Assign each execution to a planned leg or mark it explicitly unplanned.',
  NoExecutions: 'Enter at least one execution.',
  StaleRevision: 'This Plan changed since you opened it; review it and try again.',
  NotPlanned: 'This Trade is not Planned.',
  NotFound: 'Trade not found.',
  InvalidPrice: 'Enter a positive numeric price.',
  MissingReason: 'A reason is required.',
  ExactMarkExists: 'An exact Mark already exists for this date.',
  MissingCorrectionReason: 'A correction reason is required.',
  ManualSticky: 'The effective Manual Mark is sticky; a provider close cannot replace it.',
  NotOpen: 'This Trade is not Open.',
  CloseReasonMissing: 'Close Reason is required to close a Trade.',
  CloseReasonUnknown: 'Choose a seeded Close Reason.',
  CloseReasonInactive: 'That Close Reason is no longer available.',
  CloseReasonNotApplicable: 'This closure has no trader agency, so it takes no Close Reason.',
  IncoherentEconomicFacts: 'The closing quantity exceeds the remaining open exposure.',
  NotFlat: 'The Trade is not flat; record the remaining disposal.',
  NoDisposingFacts: 'Record at least one disposing Execution.',
}

export type ErrorSurface = 'field' | 'global'

export type ControllerFailure = {
  kind: string
  issues?: string[]
  message?: string
  reason?: string
}

const KIND_MESSAGE: Record<string, string> = {
  RuntimeNotWritable: 'Writes are disabled until Runtime Readiness is Writable.',
  Conflict: 'This Close Review already has an outcome.',
  MarkMissing: 'An exact Mark is required before saving an Action.',
  ReviewChanged: 'Evidence changed; review it and save again.',
  NeedsTradeWorkflow: 'This Debt must be resolved in its Trade Workflow.',
}

export function formatIssues(issues: string[]): string {
  return issues.map(issue => COPY[issue] ?? `${issue}.`).join(' ')
}

function failureOf(value: unknown): ControllerFailure | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const candidate = value as Partial<ControllerFailure>
  if (typeof candidate.kind === 'string') return candidate as ControllerFailure
  // Pure domain commands return a bare { issues } failure without a kind.
  if (Array.isArray(candidate.issues)) return { kind: 'Validation', issues: candidate.issues }
  return undefined
}

export function messageFor(value: unknown): string {
  if (value instanceof Error) return value.message || 'Unexpected error'
  if (typeof value === 'string') return value || 'Unexpected error'
  const failure = failureOf(value)
  if (!failure) return 'Unexpected error'
  if (failure.kind === 'Validation') return formatIssues(failure.issues ?? [])
  if (failure.kind === 'NotFound') return COPY.NotFound
  return KIND_MESSAGE[failure.kind] ?? failure.message ?? failure.reason ?? `${failure.kind}.`
}

export function surfaceFor(value: unknown): ErrorSurface {
  const failure = failureOf(value)
  if (!failure) return 'global'
  if (failure.kind === 'Validation') return 'field'
  return failure.kind in KIND_MESSAGE || failure.kind === 'NotFound' ? 'field' : 'global'
}
