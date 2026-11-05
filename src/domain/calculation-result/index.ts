// One independently useful calculation: a Value, an Unbounded result, or no number because the
// evidence is Unavailable or the method is NotApplicable. Reasons are stable codes in two unions;
// a figure narrows the type parameters to the reasons it can return.

// Temporary form until T7P.4: an Unavailable result holds the reason code plus a loose detail.
// T7P.4 turns each case into { reason, instrument, date } / { reason: 'AwaitingClose', after } /
// { reason: 'FactsIncoherent', findings } and drops `detail`.
export type UnavailableReason =
  | { readonly reason: 'MarkMissing' }
  | { readonly reason: 'AcknowledgedUnavailable' }
  | { readonly reason: 'SessionPolicyNotCovered' }
  | { readonly reason: 'AwaitingClose' }
  | { readonly reason: 'FactsIncoherent' };

export type NotApplicableReason =
  | { readonly reason: 'NoRemainingPosition' }
  | { readonly reason: 'NotClosed' }
  | { readonly reason: 'EntryNotResolved' }
  | { readonly reason: 'NoOngoingRisk' }
  | { readonly reason: 'EntryAtOrBeyondStop' }
  | { readonly reason: 'EntryAtOrBeyondTarget' }
  | { readonly reason: 'NonPositiveAtEntry'; readonly side: 'Losing' | 'Winning' };

// What an Unavailable result names: the Instrument and date lacking an exact Mark, or the close
// still awaited. Temporary, with the Unavailable form above.
export type UnavailableDetail =
  | { readonly instrument: { readonly kind: 'Stock'; readonly symbol: string }; readonly date: string }
  | { readonly after: string };

export type CalculationResult<
  T,
  U extends UnavailableReason = UnavailableReason,
  N extends NotApplicableReason = NotApplicableReason,
> =
  | { readonly kind: 'Value'; readonly value: T }
  | { readonly kind: 'Unbounded'; readonly direction: 'Above' | 'Below'; readonly explanation: string }
  | (N extends unknown ? { readonly kind: 'NotApplicable' } & N : never)
  | (U extends unknown ? { readonly kind: 'Unavailable'; readonly reason: U['reason']; readonly detail: UnavailableDetail } : never);
