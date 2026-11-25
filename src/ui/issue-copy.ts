// Presentation-only translation of typed domain tokens. The domain results
// keep their stable keys; the UI owes the trader understandable prose.
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

export function formatIssues(issues: string[]): string {
  return issues.map(issue => COPY[issue] ?? `${issue}.`).join(' ')
}
