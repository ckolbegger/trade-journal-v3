import type { RuntimeNotWritable } from '../../delivery/runtime-not-writable.ts';
import type { Instant } from '../../domain/time/index.ts';
import type { IncoherentFacts, IntegrityFinding, TradeEvaluation } from '../../domain/trade-analysis/index.ts';
import type { TradeSummary } from '../../domain/trade-summary.ts';
import type { Rational } from '../../domain/values/index.ts';
import type { WorkspaceSnapshotBinding } from '../../persistence/index.ts';
import type { StorageFailure } from '../mutation-guard.ts';
import type { DailyAction, JournalIssue, JournalObligationKey } from '../../modules/journal/index.ts';
import type { ExpectedResolutionRevision, MarkFrame, MarketDataIssue, MarkResolution } from '../../modules/market-data/index.ts';

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
  // The revision the key was read at: the binding a save of its Mark presents.
  readonly resolutionRevision: ExpectedResolutionRevision;
  readonly task: 'Manual' | null;
}

// Sessions before the Review Date without an effective Mark, for one Instrument. They are shown and
// can be filled, but never block the Review (P15, AC-MARK-004).
export interface HistoricalGapGroup {
  readonly instrumentKey: string;
  readonly missing: readonly string[];
  // Sessions the trader acknowledged as unavailable; also listed apart from the Missing ones.
  readonly acknowledged: readonly string[];
  // The resolutionRevision of each listed date, the binding a save of its Mark presents.
  readonly revisions: Readonly<Record<string, ExpectedResolutionRevision>>;
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

// The Trade to open from an overview: its Review Date and the binding `open` returned.
export interface GetDailyTradeReviewRequest {
  readonly reviewDate: string;
  readonly tradeId: string;
  readonly binding: ReviewBinding;
}

// The Action form: the saved Action, or a new form whose Hold preselection is view state only
// (Daily Review, `getTrade`); nothing is recorded until Save.
export type ActionForm =
  | { readonly kind: 'Saved'; readonly action: DailyAction }
  | { readonly kind: 'New'; readonly viewState: { readonly selectedAction: 'Hold' } };

// What Save must present: the exact Trade revision, evidence snapshot, obligation, and rendered
// form revision (Daily Review, `save`).
export interface TradeSaveBinding {
  readonly reviewDate: string;
  readonly tradeId: string;
  readonly factRevision: number;
  readonly marketDataSnapshotId: string;
  readonly obligationKey: JournalObligationKey;
  // The revision of the saved Action being edited; absent for a new Action.
  readonly expectedEntryRevision?: number;
  readonly definitionRevision: string;
  // The Workspace database the form was rendered from; a restored or different Workspace is a changed review.
  readonly databaseName: string;
}

export interface DailyTradeReview {
  readonly tradeId: string;
  readonly underlying: string;
  readonly summary?: TradeSummary;
  // The Trade's band and reasons, as the overview lists them.
  readonly attention: ReviewTradeItem;
  readonly labels: { readonly strategy: string; readonly account: string; readonly institution: string };
  // The Review-date frame, with its Stale context when the Mark is Missing; this and the figures
  // below are absent when the Trade's facts cannot be replayed.
  readonly frame?: MarkFrame;
  // Evaluated at the Review cutoff with the Review-date frame.
  readonly evaluation?: TradeEvaluation;
  // The Position held at the Stale context's close, valued with that session's own exact Mark (P13, A54).
  readonly datedLastClose?: { readonly tradingDate: string; readonly evaluation: TradeEvaluation };
  readonly form: ActionForm;
  // The Daily Trade Review definition revision the form was rendered from.
  readonly definitionRevision: string;
  readonly saveBinding: TradeSaveBinding;
}

export type GetDailyTradeReviewResult =
  | { readonly kind: 'Ready'; readonly reviewDate: string; readonly cutoff: Instant; readonly trade: DailyTradeReview }
  // The Trade's facts or the Review-date evidence no longer match the overview's binding (A46, AC-REV-005).
  | { readonly kind: 'ReviewChanged' }
  | { readonly kind: 'ChangedDuringAssembly' }
  | { readonly kind: 'Rejected'; readonly issues: readonly MarketDataIssue[] };

// The Action the trader chose; Hold has an optional Intent, the other three require it.
export type ActionChoice = 'Hold' | 'Exit' | 'Roll' | 'Adjust';

// SaveTradeAction: the exact binding `getTrade` returned, the chosen Action, and its Intent.
export interface SaveTradeActionRequest {
  readonly kind: 'SaveTradeAction';
  readonly binding: TradeSaveBinding;
  readonly action: ActionChoice;
  readonly intent?: string;
}

// ResolveReviewDebt arrives with D5.
export type SaveDailyReviewRequest = SaveTradeActionRequest;

// How many of the eligible Trades have an Action for the Review Date.
export interface ReviewProgress {
  readonly tradesWithAction: number;
  readonly tradesEligible: number;
}

// The first obligation still open, in the normative family order: a Missing Review-date Mark, then
// the first Trade of the walk without an Action (with the form to answer, as `getTrade` returns it),
// then nothing, and completion says why.
export type ReviewNextStep =
  | { readonly kind: 'Mark'; readonly row: MarkRow }
  | { readonly kind: 'Trade'; readonly trade: DailyTradeReview }
  | { readonly kind: 'Done' };

// The Review under the facts the save left: derived like `open`, with a binding for the next reads.
export type PostSaveReview =
  | {
      readonly kind: 'Ready';
      readonly progress: ReviewProgress;
      readonly completion: ReviewCompletion;
      readonly nextStep: ReviewNextStep;
      readonly binding: ReviewBinding;
    }
  // The Action is saved; writes kept landing while the Review was read again. Open it afresh.
  | { readonly kind: 'ChangedDuringAssembly' };

// The Review-date evidence as it is now, so the trader sees what changed.
export interface RefreshedEvidence {
  readonly marketDataSnapshotId: string;
  readonly frames: readonly MarkFrame[];
  // The Trade's current FactRevision; absent when the Review no longer finds the Trade eligible.
  readonly factRevision?: number;
}

export type SaveDailyReviewResult =
  | { readonly kind: 'Saved'; readonly action: DailyAction; readonly review: PostSaveReview }
  // A Mark, an acknowledgment, or the Trade's facts changed since the binding; nothing was written.
  | { readonly kind: 'ReviewChanged'; readonly evidence: RefreshedEvidence }
  // Another Action was saved for the Trade and date since the binding; nothing was written.
  | { readonly kind: 'Conflict' }
  | { readonly kind: 'Rejected'; readonly issues: readonly (JournalIssue | MarketDataIssue)[] }
  | { readonly kind: 'ChangedDuringAssembly' }
  | RuntimeNotWritable
  | StorageFailure;
