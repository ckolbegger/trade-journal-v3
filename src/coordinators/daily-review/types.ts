import type { Instant } from '../../domain/time/index.ts';
import type { IncoherentFacts, IntegrityFinding } from '../../domain/trade-analysis/index.ts';
import type { Rational } from '../../domain/values/index.ts';
import type { WorkspaceSnapshotBinding } from '../../persistence/index.ts';
import type { MarketDataIssue, MarkResolution } from '../../modules/market-data/index.ts';

// The request names the date and the as-of instant (Daily Review, "Date, eligibility, and ordering").
// D4 opens LatestCompleted only (P15); an exact date arrives in D15.
export interface OpenDailyReviewRequest {
  readonly date: { readonly kind: 'LatestCompleted' };
  readonly asOf: Instant;
}

// The attention bands, highest first (Daily Review, "Date, eligibility, and ordering"): factual or
// management blocker, boundary reached, evidence limited, quantified pressure, routine.
export type AttentionBand = 'Blocker' | 'BoundaryReached' | 'EvidenceLimited' | 'QuantifiedPressure' | 'Routine';

// Why a Trade is in its band; figures are in the basis.
export type AttentionReason =
  | { readonly code: 'IntegrityDisagreement'; readonly findings: readonly IntegrityFinding[] }
  // The recorded facts cannot be replayed, so nothing about the Trade is derived.
  | { readonly code: 'IncoherentFacts'; readonly findings: IncoherentFacts['findings'] }
  | { readonly code: 'StopBreached' | 'TargetReached'; readonly conditionId: string; readonly overrun: Rational }
  | { readonly code: 'MarkMissing' | 'AcknowledgedUnavailable'; readonly instrumentKey: string; readonly date: string }
  | { readonly code: 'AwaitingClose'; readonly after: string }
  | { readonly code: 'PressureTowardStop' | 'PressureTowardTarget' }
  | { readonly code: 'NoPressure' };

// The pressure a Trade is ranked by: the share of its planned range travelled since entry, with the
// risk (toward the Stop) or reward (toward the Target) at entry and now, or the missing input.
export type PressureBasis =
  | {
      readonly kind: 'Comparable';
      readonly side: 'Losing' | 'Winning';
      readonly share: Rational;
      readonly atEntry: Rational;
      readonly now: Rational;
    }
  // Marked at its average open cost: no distance travelled toward either boundary (pressure 0).
  | { readonly kind: 'Comparable'; readonly side: 'None'; readonly share: Rational }
  | { readonly kind: 'NotComparable'; readonly reason: 'MissingInput'; readonly instrumentKey: string; readonly date: string }
  | { readonly kind: 'NotComparable'; readonly reason: 'AwaitingClose'; readonly after: string }
  | { readonly kind: 'NotComparable'; readonly reason: 'FactsIncoherent' }
  // The risk (Losing) or reward (Winning) at entry was not positive on the side the Trade moved toward.
  | { readonly kind: 'NotComparable'; readonly reason: 'NonPositiveAtEntry'; readonly side: 'Losing' | 'Winning' };

// One eligible Trade in the walk.
export interface ReviewTradeItem {
  readonly tradeId: string;
  readonly underlying: string;
  // The latest activity on the Trade (the Plan time before its first Position Change).
  readonly lastActivity: Instant;
  readonly band: AttentionBand;
  readonly reasons: readonly AttentionReason[];
  readonly basis: PressureBasis;
}

// One Instrument needing the Review-date Mark, with the eligible Trades that hold it. The task is
// Manual while the Mark is Missing; an exact Mark or an acknowledgment resolves it.
export interface MarkRow {
  readonly instrumentKey: string;
  readonly tradingDate: string;
  readonly trades: readonly string[];
  readonly resolution: MarkResolution;
  readonly task: 'Manual' | null;
}

// Sessions before the Review Date without an effective Mark, for one Instrument. They are shown and
// can be filled, but never block the Review (P15, AC-MARK-004).
export interface HistoricalGapGroup {
  readonly instrumentKey: string;
  readonly missing: readonly string[];
  // Sessions the trader acknowledged as unavailable; also listed apart from the Missing ones.
  readonly acknowledged: readonly string[];
  readonly blocking: false;
}

// The task families in their normative order (Daily Review, "Date, eligibility, and ordering").
// D4 has Marks and Trades; Debt and settlement arrive in D5 and D7.
export type ReviewFamily =
  | { readonly family: 'Marks'; readonly today: readonly MarkRow[]; readonly earlier: readonly HistoricalGapGroup[] }
  | { readonly family: 'Trades'; readonly trades: readonly ReviewTradeItem[] };

// What keeps the Review from being complete, Marks first and then the Trades in the walk's order.
export type IncompleteReason =
  | { readonly code: 'MarkMissing'; readonly instrumentKey: string; readonly tradingDate: string; readonly trades: readonly string[] }
  | { readonly code: 'ActionMissing'; readonly tradeId: string }
  // An Action can be saved, but completion waits until a Trade mutation repairs the disagreement (A59).
  | { readonly code: 'IntegrityDisagreement'; readonly tradeId: string; readonly findings: readonly IntegrityFinding[] }
  | { readonly code: 'IncoherentFacts'; readonly tradeId: string; readonly findings: IncoherentFacts['findings'] };

// The groups of Mark-dependent calculations an unavailable Mark leaves without a Value.
export type CalculationFamily = 'Valuation' | 'Risk' | 'Reward' | 'ConditionStatus';

// Derived from facts each time; nothing about it is stored (Daily Review, "Completion and resumption").
export type ReviewCompletion = { readonly kind: 'Incomplete'; readonly reasons: readonly IncompleteReason[] } | { readonly kind: 'Complete' }
  // Every obligation is resolved, but a required Instrument has only an acknowledgment, never a price.
  | {
      readonly kind: 'CompleteWithUnavailableMarks';
      readonly instruments: readonly string[];
      readonly trades: readonly string[];
      readonly families: readonly CalculationFamily[];
    };

// What one Review read represents; getTrade and save compare against it (A46, AC-REV-005).
export interface ReviewBinding {
  readonly workspace: WorkspaceSnapshotBinding;
  readonly catalogRevision: number;
  readonly journalRevision: number;
  readonly marketDataSnapshotId: string;
  // The FactRevision of each eligible Trade, by Trade identity.
  readonly factRevisions: Readonly<Record<string, number>>;
}

export type OpenDailyReviewResult =
  // No Trade is eligible and no other task is required.
  | { readonly kind: 'Empty'; readonly reviewDate: string; readonly cutoff: Instant }
  | { readonly kind: 'Ready'; readonly reviewDate: string; readonly cutoff: Instant; readonly families: readonly ReviewFamily[]; readonly completion: ReviewCompletion; readonly binding: ReviewBinding }
  // Writes kept landing between the read phases; nothing incoherent is returned (A46).
  | { readonly kind: 'ChangedDuringAssembly' }
  | { readonly kind: 'Rejected'; readonly issues: readonly MarketDataIssue[] };
