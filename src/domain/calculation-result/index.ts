import type { Instrument } from '../instrument'
import type { Instant } from '../time/index.ts'
import type { Rational } from '../values/index.ts'

// One independently useful calculation: a Value, an Unbounded result, or no number because the
// evidence is Unavailable or the method is NotApplicable. Reasons are stable codes in two unions;
// a figure narrows the type parameters to the reasons it can return.

// Facts that cannot be replayed are a typed rejection naming each fact, never a number.
// Each finding describes itself (P69). An Execution's quantity is the recorded decimal text, since a
// nonpositive one is itself a finding; Economic Time is the fact's Instant.
export interface ExecutionDescription {
  readonly factId: string;
  readonly kind: 'Execution';
  readonly instrument: Instrument;
  readonly economicTime: Instant;
  readonly side: 'Buy' | 'Sell';
  readonly quantity: string;
}

// An Expiration has no side (A106, decision 83): its own description kind.
export interface ExpirationDescription {
  readonly factId: string;
  readonly kind: 'Expiration';
  readonly instrument: Instrument;
  readonly economicTime: Instant;
  readonly quantity: string;
}

export type IncoherentFact =
  | (ExecutionDescription & {
      readonly reason: 'UnknownPlannedLeg' | 'NonpositiveQuantity' | 'DuplicateFactId' | 'AfterExpiration' | 'ContractQuantityNotWhole';
    })
  // P22: a Sell above the quantity open at its own point in Fact Order; names that quantity.
  | (ExecutionDescription & { readonly reason: 'ExceedsOpenQuantity'; readonly available: Rational })
  // P22: a Sell that leaves the Position flat although a later fact follows it.
  | (ExecutionDescription & { readonly reason: 'FlatBeforeLaterFacts' })
  // A106: an Expiration that settles less or more than the quantity open, one dated after the contract's
  // expiration or not after every Execution on it, and one on a stock Instrument.
  | (ExpirationDescription & { readonly reason: 'ExpirationMustSettleAllOpen'; readonly available: Rational })
  | (ExpirationDescription & { readonly reason: 'SettlementTimeInvalid' | 'NotAnOption' })
  | { readonly factId: string; readonly kind: 'PositionChange'; readonly economicTime: Instant; readonly reason: 'DuplicateFactId' };

// Each case is a reason with its own details, carried flat in the result.
export type UnavailableReason =
  | { readonly reason: 'MarkMissing'; readonly instrument: Instrument; readonly date: string }
  | { readonly reason: 'AcknowledgedUnavailable'; readonly instrument: Instrument; readonly date: string }
  | { readonly reason: 'SessionPolicyNotCovered'; readonly instrument: Instrument; readonly date: string }
  | { readonly reason: 'AwaitingClose'; readonly after: string }
  | { readonly reason: 'FactsIncoherent'; readonly findings: readonly IncoherentFact[] };

export type NotApplicableReason =
  | { readonly reason: 'NoRemainingPosition' }
  | { readonly reason: 'NoOptionExpirationAnchor' }
  | { readonly reason: 'NotClosed' }
  | { readonly reason: 'EntryNotResolved' }
  | { readonly reason: 'NoOngoingRisk' }
  | { readonly reason: 'EntryAtOrBeyondStop' }
  | { readonly reason: 'EntryAtOrBeyondTarget' }
  | { readonly reason: 'NonPositiveAtEntry'; readonly side: 'Losing' | 'Winning' };

export type CalculationResult<
  T,
  U extends UnavailableReason = UnavailableReason,
  N extends NotApplicableReason = NotApplicableReason,
> =
  | { readonly kind: 'Value'; readonly value: T }
  | { readonly kind: 'Unbounded'; readonly direction: 'Above' | 'Below'; readonly explanation: string }
  | (N extends unknown ? { readonly kind: 'NotApplicable' } & N : never)
  | (U extends unknown ? { readonly kind: 'Unavailable' } & U : never);
