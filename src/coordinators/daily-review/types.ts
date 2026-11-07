import type { RuntimeNotWritable } from '../../delivery/runtime-not-writable.ts';
import type { DueClassification } from '../../domain/journal-debt/index.ts';
import type { Instrument, OptionInstrument } from '../../domain/instrument/index.ts';
import type { Instant } from '../../domain/time/index.ts';
import type { CalculationResult, EntryResolution, ExecutionFact, IncoherentFacts, IntegrityFinding, LifecycleState, NotApplicableReason, TerminalDisposition, TradeEvaluation, UnavailableReason } from '../../domain/trade-analysis/index.ts';
import type { TradeSummary } from '../../domain/trade-summary.ts';
import type { Rational } from '../../domain/values/index.ts';
import type { WorkspaceSnapshotBinding } from '../../persistence/index.ts';
import type { StorageFailure } from '../mutation-guard.ts';
import type { AnswerInput, DailyAction, DebtProjection, DeclineProjection, EntryDefinitionRecord, EntryProjection, JournalIssue, JournalObligationKey, ObligationOutcome } from '../../modules/journal/index.ts';
import type { AcknowledgmentVersion, ExpectedResolutionRevision, MarkFrame, MarketDataConflictedKey, MarketDataIssue, MarketDataPrepareEntry, MarketDataPrepareIssue, MarkResolution, ObservationKey, PreparedMarketDataEntry } from '../../modules/market-data/index.ts';

// The request names the date and the as-of instant (Daily Review, "Date, eligibility, and ordering").
// D4 opens LatestCompleted only (P15); an exact date arrives in D15.
export interface OpenDailyReviewRequest {
  readonly date: { readonly kind: 'LatestCompleted' };
  readonly asOf: Instant;
}

// The attention bands, highest first (Daily Review, "Date, eligibility, and ordering"): factual or
// management blocker, boundary reached, evidence limited, quantified pressure, routine.
export type AttentionBand = 'Blocker' | 'BoundaryReached' | 'EvidenceLimited' | 'QuantifiedPressure' | 'Routine';

// Why a Trade is in its band; figures are in the basis. A Trade limited by evidence, or blocked because its
// facts cannot be replayed, carries its evaluation's own Unavailable reason, unchanged (P67).
export type AttentionReason =
  | { readonly code: 'IntegrityDisagreement'; readonly findings: readonly IntegrityFinding[] }
  | ({ readonly code: 'Unavailable' } & UnavailableReason)
  | { readonly code: 'StopBreached' | 'TargetReached'; readonly conditionId: string; readonly overrun: Rational }
  | { readonly code: 'PressureTowardStop' | 'PressureTowardTarget' }
  // An option contract held at or past its expiration date with no settlement fact (A112); a blocker.
  | { readonly code: 'SettlementDue'; readonly instrument: OptionInstrument; readonly quantity: Rational; readonly expiration: string }
  | { readonly code: 'NoPressure' };

// The pressure a Trade is ranked by: the share of its planned range travelled since entry, with the
// risk (toward the Stop) or reward (toward the Target) at entry and now.
export type Pressure =
  | {
      readonly side: 'Losing' | 'Winning';
      readonly share: Rational;
      readonly atEntry: Rational;
      readonly now: Rational;
    }
  // Marked at its average open cost: no distance travelled toward either boundary (pressure 0).
  | { readonly side: 'None'; readonly share: Rational };

// Where the Review-date Mark sits in the Trade's Stop-to-Target range (P39): risk ÷ (risk + reward), with the
// same risk and reward the pressure uses, now and at entry. `pinned` names the end the Mark is at or past:
// risk is zero at the Stop (share 0), reward is zero at the Target (share 1).
export interface RangePlacement {
  readonly now: Rational;
  readonly atEntry: Rational;
  readonly pinned?: 'Stop' | 'Target';
}

// Pressure is NotApplicable when the risk (Losing) or reward (Winning) at entry was not positive on the side the Trade moved toward.
export type PressureResult = CalculationResult<Pressure, UnavailableReason, Extract<NotApplicableReason, { reason: 'NonPositiveAtEntry' }>>;
export type RangePositionResult = CalculationResult<RangePlacement, UnavailableReason, never>;

// One eligible Trade in the walk.
export interface ReviewTradeItem {
  readonly tradeId: string;
  readonly underlying: string;
  // What the Trade holds, for naming it where it shares an Instrument (decision 67); absent when its facts cannot be replayed.
  readonly summary?: TradeSummary;
  // The latest activity on the Trade (the Plan time before its first Position Change).
  readonly lastActivity: Instant;
  readonly band: AttentionBand;
  readonly reasons: readonly AttentionReason[];
  readonly basis: PressureResult;
  readonly rangePosition: RangePositionResult;
}

// A card's panels in work order, as counts and flags (A164). Words are the screen's.
export type PanelProgress =
  | { readonly panel: 'Marks'; readonly done: boolean; readonly resolved: number; readonly needed: number }
  | { readonly panel: 'Reflections'; readonly done: boolean; readonly dueNow: number; readonly later: number }
  | { readonly panel: 'Action'; readonly done: boolean; readonly owed: boolean };

// A `Walked` card has every panel; a `ReflectionsOwed` card (A90) has the Reflections panel alone.
export interface CardProgress {
  readonly kind: 'Walked' | 'ReflectionsOwed';
  readonly panels: readonly PanelProgress[];
  // Every panel is done (A150).
  readonly done: boolean;
}

export interface SliderFigures {
  readonly riskToStop: TradeEvaluation['ongoingRiskToStop'];
  readonly pnl: TradeEvaluation['currentMarkedPnl'];
  readonly rewardRiskNow: TradeEvaluation['rewardRiskNow'];
}

// A Trade of the walk, with its card's progress; an owed reflection never moves its band.
export interface WalkedTrade extends ReviewTradeItem {
  readonly progress: CardProgress;
  // The figures the card's slider describes (P39, A150): the same evaluation results `getTrade` returns, unformatted.
  // Absent when the Trade's facts cannot be replayed.
  readonly figures?: SliderFigures;
}

// One Outstanding reflection of a Trade outside the walk: which obligation it answers (the Debt's Entry Type) and how
// `classifyDue` reads its due anchor in this Review (A86).
export interface OwedReflectionItem {
  readonly debtId: string;
  readonly entryTypeKey: string;
  readonly dueAnchor: Instant;
  readonly classification: DueClassification;
}

// A Trade outside the walk with at least one Outstanding reflection, due or not (P20, A89). Its card has the
// Reflections panel alone; `getTrade` returns the card's content (T6.12).
export interface OwedReflectionsTrade {
  readonly tradeId: string;
  readonly underlying: string;
  // The Trade's stored lifecycle: Closed for a Trade closed before the cutoff, Open for one that opened after it.
  readonly lifecycle: LifecycleState;
  // The Trade's Outstanding reflections in due-anchor order.
  readonly owed: readonly OwedReflectionItem[];
  readonly progress: CardProgress;
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
  // The eligible Trades that hold the Instrument, in the walk's order, with the first session each is
  // relevant from: a gap before that date is not the Trade's (A153).
  readonly trades: readonly { readonly tradeId: string; readonly from: string }[];
  readonly missing: readonly string[];
  // Sessions the trader acknowledged as unavailable; also listed apart from the Missing ones.
  readonly acknowledged: readonly string[];
  // The resolutionRevision of each listed date, the binding a save of its Mark presents.
  readonly revisions: Readonly<Record<string, ExpectedResolutionRevision>>;
  // The effective acknowledgment of each acknowledged date, for its AcknowledgedUnavailable resolution.
  readonly acknowledgments: Readonly<Record<string, AcknowledgmentVersion>>;
  readonly blocking: false;
}

// One option contract an eligible Trade still holds at or past its expiration date (A111, A112). The signed open
// quantity is negative for a short contract: the screen words the assignment or exercise sentence from that sign.
export interface SettlementItem {
  readonly tradeId: string;
  readonly instrument: OptionInstrument;
  readonly quantity: Rational;
  readonly expiration: string;
  // The close of the expiration session, or of the latest session before it when the date is not a session.
  readonly settlementTime: Instant;
}

// The task families in their normative order (Daily Review, "Date, eligibility, and ordering").
// D4 has Marks and Trades; Debt and settlement arrive in D5 and D7.
export type ReviewFamily =
  | { readonly family: 'Marks'; readonly today: readonly MarkRow[]; readonly earlier: readonly HistoricalGapGroup[] }
  // Between Marks and the walk; present only when a settlement is due, ordered by expiration date then Trade identity.
  | { readonly family: 'Settlement'; readonly items: readonly SettlementItem[] }
  | { readonly family: 'Trades'; readonly trades: readonly WalkedTrade[] };

// What keeps the Review from being complete, Marks first and then the Trades in the walk's order.
export type IncompleteReason =
  | { readonly code: 'MarkMissing'; readonly instrument: Instrument; readonly tradingDate: string; readonly trades: readonly string[] }
  | { readonly code: 'ActionMissing'; readonly tradeId: string }
  | ({ readonly code: 'SettlementDue' } & SettlementItem)
  // Deferred reflections of the Trade that are due in this Review, in anchor order (P17, AC-REV-006).
  | { readonly code: 'ReflectionDue'; readonly tradeId: string; readonly debtIds: readonly string[] }
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
      readonly instruments: readonly Instrument[];
      readonly trades: readonly string[];
      readonly families: readonly CalculationFamily[];
    };

// What one Review read represents; getTrade and save compare against it (A46, AC-REV-005).
export interface ReviewBinding {
  readonly workspace: WorkspaceSnapshotBinding;
  readonly catalogRevision: number;
  readonly journalRevision: number;
  readonly marketDataSnapshotId: string;
  // The FactRevision of each eligible Trade and each Trade of the owed-reflection group, by Trade identity.
  readonly factRevisions: Readonly<Record<string, number>>;
  // The Outstanding Debt of each eligible Trade and each Trade of the owed-reflection group that has any, in anchor order: a resolution elsewhere changes a Trade's list (A68).
  readonly outstandingDebts: Readonly<Record<string, readonly string[]>>;
}

export type OpenDailyReviewResult =
  // No Trade is eligible and no reflection is due. Trades with a reflection owed later are still listed, with the
  // binding their cards are opened against (A90).
  | { readonly kind: 'Empty'; readonly reviewDate: string; readonly cutoff: Instant; readonly owed: readonly OwedReflectionsTrade[]; readonly binding: ReviewBinding }
  // `owed` is the group after the walk: due-reflection Trades first, then oldest owed anchor, then Trade identity (A89).
  | { readonly kind: 'Ready'; readonly reviewDate: string; readonly cutoff: Instant; readonly families: readonly ReviewFamily[]; readonly owed: readonly OwedReflectionsTrade[]; readonly completion: ReviewCompletion; readonly binding: ReviewBinding }
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

// What a resolution of one reflection must present: the Debt revision and the snapshot definition revision it was rendered from.
export interface ReflectionSaveBinding {
  readonly debtId: string;
  readonly debtRevision: string;
  readonly definitionRevision: string;
}

// One Outstanding reflection of the Trade: its snapshot definition as a form, the Position Change it follows, and how it is classified.
export interface OwedReflection {
  readonly debtId: string;
  // The Entry Type's label, as Trade Detail shows it ("Close Review", "Position Change Reflection").
  readonly entryType: string;
  readonly definition: EntryDefinitionRecord;
  readonly economicTime: Instant;
  readonly executions: readonly ExecutionFact[];
  readonly classification: DueClassification;
  readonly saveBinding: ReflectionSaveBinding;
}

export interface DailyTradeReview {
  readonly tradeId: string;
  readonly underlying: string;
  // The Trade's stored lifecycle now, which differs from the cutoff's for a Trade closed after the close (A91).
  readonly lifecycle: LifecycleState;
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
  // The Trade's Outstanding reflections, oldest anchor first then Debt identity (A68); they sit above the Action form.
  readonly reflections: readonly OwedReflection[];
  // The card's progress, as `open` lists it on the Trade's walked item (A165).
  readonly progress: CardProgress;
  readonly form: ActionForm;
  // The Daily Trade Review definition revision the form was rendered from.
  readonly definitionRevision: string;
  readonly saveBinding: TradeSaveBinding;
}

// A Trade summary for its lifecycle on an owed-reflection card, derived from all the Trade's facts, with no cutoff (A90).
// Absent when the facts cannot be replayed.
export type OwedTradeSummary =
  | {
      readonly kind: 'Closed';
      readonly realizedPnl: Rational;
      readonly realizedR: CalculationResult<Rational, never, Extract<NotApplicableReason, { reason: 'NotClosed' }>>;
      readonly terminalDisposition: TerminalDisposition;
      // The Close Reason the Trade was closed with; absent only when it was closed without one. The label is blank when the
      // Catalog cannot resolve the identity.
      readonly closeReason?: { readonly id: string; readonly label: string };
      // The current outcome of the Trade's Close Review obligation: a completed Entry, a decline, or the Debt still owed.
      readonly closeReviewOutcome?: ObligationOutcome;
      readonly terminalTime?: Instant;
    }
  | { readonly kind: 'Open'; readonly position?: TradeSummary; readonly entryResolution: EntryResolution };

// A card of the group after the walk (A90): the Trade's summary and its Outstanding reflections, due or not, and nothing
// else. It has no Action form, evaluation, or Mark frame, and its progress has the Reflections panel alone.
export interface OwedReflectionsCard {
  readonly tradeId: string;
  readonly underlying: string;
  readonly lifecycle: LifecycleState;
  readonly labels: { readonly strategy: string; readonly account: string; readonly institution: string };
  readonly summary?: OwedTradeSummary;
  // The Trade's Outstanding reflections in due-anchor order, each with its snapshot form and save binding.
  readonly reflections: readonly OwedReflection[];
  readonly progress: CardProgress;
}

export type GetDailyTradeReviewResult =
  // A card of the walk (kind `Walked`).
  | { readonly kind: 'Ready'; readonly reviewDate: string; readonly cutoff: Instant; readonly trade: DailyTradeReview }
  // A card of the owed-reflection group (kind `ReflectionsOwed`).
  | { readonly kind: 'ReflectionsOwed'; readonly reviewDate: string; readonly cutoff: Instant; readonly card: OwedReflectionsCard }
  // The Trade's facts or the Review-date evidence no longer match the overview's binding (A46, AC-REV-005).
  | { readonly kind: 'ReviewChanged' }
  | { readonly kind: 'ChangedDuringAssembly' }
  | { readonly kind: 'Rejected'; readonly issues: readonly MarketDataIssue[] };

// The Action the trader chose; Hold has an optional Intent, the other three require it.
export type ActionChoice = 'Hold' | 'Exit' | 'Roll' | 'Adjust';

// SaveTradeAction: the exact binding `getTrade` returned, the chosen Action, its Intent, and the definition's optional answers
// (Conviction now, the Anything-considered text, the Note). A blank text is unanswered; an answer left out is not recorded.
export interface SaveTradeActionRequest {
  readonly kind: 'SaveTradeAction';
  readonly binding: TradeSaveBinding;
  readonly action: ActionChoice;
  readonly intent?: string;
  readonly conviction?: number;
  readonly considered?: string;
  readonly note?: string;
}

// ResolveReviewDebt: one Outstanding reflection answered against its snapshot definition (the binding's revision) or declined (A64).
export interface ResolveReviewDebtRequest {
  readonly kind: 'ResolveReviewDebt';
  readonly reviewDate: string;
  readonly binding: ReflectionSaveBinding;
  readonly resolution:
    | { readonly kind: 'Answer'; readonly answers: Readonly<Record<string, AnswerInput>> }
    | { readonly kind: 'Decline'; readonly reason?: string };
}

// SaveReviewMarks: one card's Marks saved in one commit, every Mark or none (P37, A155). `tradeId` is the card
// they were saved from; `binding` is the overview's. Market Data validates and checks every entry.
export interface SaveReviewMarksRequest {
  readonly kind: 'SaveReviewMarks';
  readonly reviewDate: string;
  readonly tradeId: string;
  readonly binding: ReviewBinding;
  readonly entries: readonly MarketDataPrepareEntry[];
}

export type SaveDailyReviewRequest = SaveTradeActionRequest | ResolveReviewDebtRequest | SaveReviewMarksRequest;

// How many of the eligible Trades have an Action for the Review Date.
export interface ReviewProgress {
  readonly tradesWithAction: number;
  readonly tradesEligible: number;
}

// The first obligation still open, in the normative family order: a Missing Review-date Mark, then
// the first card of the walk that is not done (with the form to answer, as `getTrade` returns it), then
// the first card of the owed-reflection group that is not done, then nothing, and completion says why.
export type ReviewNextStep =
  | { readonly kind: 'Mark'; readonly row: MarkRow }
  | { readonly kind: 'Trade'; readonly trade: DailyTradeReview }
  // After the walk, the first card of the owed-reflection group that is not done (A90).
  | { readonly kind: 'OwedTrade'; readonly card: OwedReflectionsCard }
  | { readonly kind: 'Done' };

// The Review under the facts the save left: derived like `open`, with a binding for the next reads.
export type PostSaveReview =
  | {
      readonly kind: 'Ready';
      readonly progress: ReviewProgress;
      readonly completion: ReviewCompletion;
      readonly nextStep: ReviewNextStep;
      readonly binding: ReviewBinding;
      // The progress of the Trade the save resolved, when it is walked (A165).
      readonly cards: readonly { readonly tradeId: string; readonly progress: CardProgress }[];
    }
  // The Action is saved; writes kept landing while the Review was read again. Open it afresh.
  | { readonly kind: 'ChangedDuringAssembly' };

// What each saved key now reports, equal to the record the commit wrote (AC-RESP-001).
export interface SavedMark {
  readonly key: ObservationKey;
  readonly resolution: MarkResolution;
  readonly resolutionRevision: number;
  readonly classification: PreparedMarketDataEntry['classification'];
}

// The step after a Marks save: a Missing Review-date Mark first (P36), shown on the card of the first walked
// Trade that holds the Instrument; otherwise as after an Action save.
export type MarksNextStep =
  | { readonly kind: 'Mark'; readonly row: MarkRow; readonly trade: DailyTradeReview }
  | { readonly kind: 'Trade'; readonly trade: DailyTradeReview }
  | { readonly kind: 'OwedTrade'; readonly card: OwedReflectionsCard }
  | { readonly kind: 'Done' };

// The Review under the Marks a save left, rendered by the screen with no further read (P38, A157).
export type PostMarksReview =
  | {
      readonly kind: 'Ready';
      readonly progress: ReviewProgress;
      readonly completion: ReviewCompletion;
      readonly binding: ReviewBinding;
      // Every walked Trade in attention order, with its revised band, reasons and range position.
      readonly trades: readonly WalkedTrade[];
      // The card the Marks were saved from, evaluated with them.
      readonly trade: DailyTradeReview;
      readonly nextStep: MarksNextStep;
    }
  // The Marks are saved; writes kept landing while the Review was read again. Refresh with `open` and `getTrade`.
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
  // A reflection resolved: its Entry or decline, the Debt's transition, and the Review under the facts it left (A67).
  | { readonly kind: 'DebtResolved'; readonly entry?: EntryProjection; readonly decline?: DeclineProjection; readonly debt: DebtProjection; readonly review: PostSaveReview }
  // Marks saved in one commit: each key's report and the Review under them (P37, P38).
  | { readonly kind: 'MarksSaved'; readonly marks: readonly SavedMark[]; readonly review: PostMarksReview }
  // A Mark, an acknowledgment, or the Trade's facts changed since the binding; nothing was written.
  | { readonly kind: 'ReviewChanged'; readonly evidence: RefreshedEvidence }
  // Another Action was saved for the Trade and date since the binding, or the Debt was resolved elsewhere (with the obligation's current outcome); nothing was written.
  // For Marks, `keys` names every key that moved or already has an exact Mark, as Market Data reports them; never retried.
  | { readonly kind: 'Conflict'; readonly currentOutcome?: ObligationOutcome; readonly keys?: readonly MarketDataConflictedKey[] }
  | { readonly kind: 'NotFound' }
  | { readonly kind: 'Rejected'; readonly issues: readonly (JournalIssue | MarketDataIssue | MarketDataPrepareIssue)[] }
  | { readonly kind: 'ChangedDuringAssembly' }
  | RuntimeNotWritable
  | StorageFailure;

// A Marks save can also be refused because its binding names another Workspace: nothing was written, and there is no Trade to refresh evidence for.
export type SaveReviewMarksResult = SaveDailyReviewResult | { readonly kind: 'ReviewChanged'; readonly evidence?: undefined };
