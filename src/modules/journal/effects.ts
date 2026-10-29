import type { Instant } from '../../domain/time/index.ts';

// A candidate reference names a not-yet-durable fact inside one prepared command; it reserves
// no identity. Apply maps it to Trade Record's durable identity.
export type CandidateRef = string;

export type AnswerInput =
  | { readonly kind: 'Text'; readonly text: string }
  | { readonly kind: 'Scale'; readonly value: number }
  | { readonly kind: 'Option'; readonly optionId: string };

export type ReflectionDisposition =
  | {
      readonly kind: 'Complete';
      readonly form: { readonly definitionId: string; readonly answers: Readonly<Record<string, AnswerInput>> };
    }
  // An explicit decline names the definition revision the trader was shown.
  | { readonly kind: 'Decline'; readonly definitionId: string; readonly reason?: string }
  | { readonly kind: 'Defer' };

export interface PlanReflectionRequest {
  readonly obligation: 'PlanReflection';
  readonly disposition: ReflectionDisposition;
  readonly anchor: { readonly kind: 'Trade'; readonly ref: CandidateRef };
  readonly origin: { readonly kind: 'Plan'; readonly ref: CandidateRef };
  readonly momentTime: Instant;
}

// The reflection owed for one Position Change. The Anchor names the originating Trade (already
// durable, or a candidate); the origin names the candidate Position Change; the moment time is
// the Position Change's Economic Time (D2 A19).
export interface PositionChangeReflectionRequest {
  readonly obligation: 'PositionChangeReflection';
  readonly disposition: ReflectionDisposition;
  readonly anchor: { readonly kind: 'Trade'; readonly ref: CandidateRef };
  readonly origin: { readonly kind: 'PositionChange'; readonly ref: CandidateRef };
  readonly momentTime: Instant;
}

// The Action recorded for one Trade at one Review Date (Journal, "Daily Trade Review"). The Trade
// is already durable; the origin names the (Trade, Review Date) checkpoint; the moment time is
// the Review cutoff. Only CompleteNow is allowed.
export interface DailyTradeReviewRequest {
  readonly obligation: 'DailyTradeReview';
  readonly disposition: ReflectionDisposition;
  readonly anchor: { readonly kind: 'Trade'; readonly ref: CandidateRef };
  readonly origin: { readonly kind: 'DailyReview'; readonly ref: CandidateRef; readonly reviewDate: string };
  readonly momentTime: Instant;
  // Names the Entry revision the trader was editing when the obligation already has an Entry.
  readonly expectedEntryRevision?: number;
}

export type JournalEffectRequest = PlanReflectionRequest | PositionChangeReflectionRequest | DailyTradeReviewRequest;

// One obligation has exactly one current outcome (Journal, "Debt and obligation semantics").
export type JournalObligationKey =
  | { readonly entryType: 'PlanReflection'; readonly trade: CandidateRef }
  | { readonly entryType: 'PositionChangeReflection'; readonly positionChange: CandidateRef }
  | { readonly entryType: 'DailyTradeReview'; readonly trade: CandidateRef; readonly reviewDate: string };

// A saved answer: "optional" means Unanswered is a valid value; it never means declined.
export type ResponseValue = AnswerInput | { readonly kind: 'Unanswered' };

export interface PreparedEntry {
  readonly entryTypeKey: string;
  readonly definitionId: string;
  readonly sourceKey: string;
  readonly obligationKey: JournalObligationKey;
  readonly anchor: { readonly kind: 'Trade'; readonly ref: CandidateRef };
  readonly origin:
    | { readonly kind: 'Plan' | 'PositionChange'; readonly ref: CandidateRef }
    | { readonly kind: 'DailyReview'; readonly ref: CandidateRef; readonly reviewDate: string };
  readonly momentTime: Instant;
  readonly authoredTime: Instant;
  // One response per prompt of the definition revision, in its order.
  readonly responses: readonly { readonly promptId: string; readonly value: ResponseValue }[];
  // Present when this appends a version to the obligation's existing Entry instead of creating one.
  readonly edit?: PreparedEntryEdit;
}

// An edit appends a version under the same Entry identity; `current` is the stored Entry the edit
// was prepared against, rechecked by the expected revision when applied.
export interface PreparedEntryEdit {
  readonly entryId: string;
  readonly expectedRevision: number;
  readonly savedAt: Instant;
  readonly current: Readonly<Record<string, unknown>>;
}

// An explicit decline of a reflection obligation (D2 A29): a distinct record, never an Entry.
export interface PreparedDecline {
  readonly entryTypeKey: string;
  readonly obligationKey: JournalObligationKey;
  readonly anchor: { readonly kind: 'Trade'; readonly ref: CandidateRef };
  readonly sourceKey: string;
  readonly origin: { readonly kind: 'PositionChange'; readonly ref: CandidateRef };
  readonly definitionId: string;
  readonly reason?: string;
  readonly momentTime: Instant;
  readonly authoredTime: Instant;
}

// A deferred reflection (D5 A61): an Outstanding Debt for one Position Change. The definition is
// snapshotted by immutable revision reference; the due anchor equals the moment time (P16).
export interface PreparedDebt {
  readonly entryTypeKey: string;
  readonly definitionId: string;
  readonly sourceKey: string;
  readonly obligationKey: JournalObligationKey;
  readonly anchor: { readonly kind: 'Trade'; readonly ref: CandidateRef };
  readonly origin: { readonly kind: 'PositionChange'; readonly ref: CandidateRef };
  readonly momentTime: Instant;
  readonly dueAnchor: Instant;
  readonly dueRule: 'OneSessionGrace';
  readonly route: 'JournalOnly';
}

export interface PreparedJournalEffects {
  readonly entries: readonly PreparedEntry[];
  readonly declines: readonly PreparedDecline[];
  // Present only for a Defer.
  readonly debts?: readonly PreparedDebt[];
}

export interface JournalIssue {
  readonly promptId?: string;
  readonly code:
    | 'RequiredAnswerMissing'
    | 'InvalidScaleValue'
    | 'UnknownOption'
    | 'UnknownPrompt'
    | 'DefinitionRevisionMismatch'
    | 'DispositionNotAllowed'
    | 'ReasonTooLong';
}

export interface PreparedJournalOutcome {
  readonly kind: 'Prepared';
  readonly effects: PreparedJournalEffects;
  // The Journal snapshot this outcome was validated against, rechecked when applied.
  readonly snapshot: { readonly journalRevision: number };
  // A Daily Trade Review save: the Action it will commit, built from the snapshot it was prepared
  // against. A new Entry's identity is assigned when applied, so its id here is empty until then.
  readonly action?: DailyAction;
}

export type PrepareJournalEffectsResult =
  | { readonly kind: 'Rejected'; readonly issues: readonly JournalIssue[] }
  // The Entry revision a Daily Trade Review save named is not the current one.
  | { readonly kind: 'Conflict' }
  | PreparedJournalOutcome;

// Workflow-critical answers by semantic role, entered once and frozen into the Plan facts.
export interface PlanSemantics {
  readonly Thesis: string;
  readonly Invalidation: string;
}

export type PreparePlanReflectionResult =
  | { readonly kind: 'Rejected'; readonly issues: readonly JournalIssue[] }
  | (PreparedJournalOutcome & { readonly semantics: PlanSemantics });

// The durable projection of a staged or saved Entry: its current version flattened.
export interface EntryProjection {
  readonly id: string;
  readonly entryTypeKey: string;
  readonly sourceKey: string;
  readonly anchor: { readonly kind: 'Trade'; readonly tradeId: string };
  readonly origin: { readonly kind: 'Plan' | 'PositionChange' | 'DailyReview'; readonly factId: string; readonly reviewDate?: string };
  readonly momentTime: Instant;
  readonly authoredTime: Instant;
  readonly definitionId: string;
  readonly responses: readonly { readonly promptId: string; readonly value: ResponseValue }[];
}

// The durable projection of a staged or saved decline.
export interface DeclineProjection {
  readonly id: string;
  readonly entryTypeKey: string;
  readonly sourceKey: string;
  readonly anchor: { readonly kind: 'Trade'; readonly tradeId: string };
  readonly origin: { readonly kind: 'PositionChange'; readonly factId: string };
  readonly definitionId: string;
  readonly reason?: string;
  readonly momentTime: Instant;
  readonly authoredTime: Instant;
}

// The durable projection of a staged Debt: its current (and, in D5, only) version flattened.
// T5.6 returns it through Trade Workflows; T5.13 lifts it into the app types.
export interface DebtProjection {
  readonly debtId: string;
  readonly obligationKey: string;
  readonly entryTypeKey: string;
  readonly sourceKey: string;
  // The snapshot definition revision.
  readonly definitionId: string;
  readonly anchor: { readonly kind: 'Trade'; readonly tradeId: string };
  readonly origin: { readonly kind: 'PositionChange'; readonly factId: string };
  readonly momentTime: Instant;
  readonly dueAnchor: Instant;
  readonly dueRule: 'OneSessionGrace';
  readonly route: 'JournalOnly';
  readonly status: 'Outstanding';
  // The Debt's last version identity, its optimistic binding.
  readonly revision: string;
}

export type JournalApplyResult = {
  readonly kind: 'Staged';
  readonly entries: readonly EntryProjection[];
  readonly declines: readonly DeclineProjection[];
  // Present only when a Defer staged a Debt.
  readonly debts?: readonly DebtProjection[];
  // The Action a prepared Daily Trade Review save commits, with its Entry identity.
  readonly action?: DailyAction;
};

export interface JournalQuery {
  readonly scope: 'TradeNarrative';
  readonly tradeId: string;
}

// Every Daily Trade Review Action saved for one Review Date.
export interface ReviewDateQuery {
  readonly reviewDate: string;
}

// An answer as saved, with the option label from the Entry's own definition snapshot.
export type NarrativeAnswer =
  | { readonly kind: 'Text'; readonly text: string }
  | { readonly kind: 'Scale'; readonly value: number }
  | { readonly kind: 'Option'; readonly label: string }
  | { readonly kind: 'Unanswered' };

export interface NarrativeEntry {
  readonly id: string;
  readonly entryType: string;
  readonly source: string;
  readonly anchor: { readonly kind: 'Trade'; readonly tradeId: string };
  readonly momentTime: Instant;
  readonly authoredTime: Instant;
  // The Position Change whose reflection this is; absent on any other Entry.
  readonly positionChangeId?: string;
  // The Review Date of a Daily Trade Review Action; absent on any other Entry.
  readonly reviewDate?: string;
  // True once the Entry has more than one version; absent otherwise.
  readonly edited?: true;
  readonly responses: readonly { readonly prompt: string; readonly answer: NarrativeAnswer }[];
}

// A decline in a Trade's narrative, labelled from its Entry Type and Source.
export interface NarrativeDecline {
  readonly kind: 'Decline';
  readonly id: string;
  readonly entryType: string;
  readonly source: string;
  readonly anchor: { readonly kind: 'Trade'; readonly tradeId: string };
  readonly momentTime: Instant;
  readonly authoredTime: Instant;
  // The Position Change whose reflection was declined.
  readonly positionChangeId?: string;
  readonly reason?: string;
}

export type NarrativeItem = ({ readonly kind: 'Entry' } & NarrativeEntry) | NarrativeDecline;

export type JournalPage = {
  readonly kind: 'Page';
  readonly items: readonly NarrativeItem[];
  readonly snapshot: { readonly journalRevision: number };
};

// An Action as last saved: the effective version's answers, the Entry revision (its version
// count) a retry or edit must name, the chosen Action's label, and the definition of the Entry's
// first version, which every edit is validated against.
export type DailyAction = NarrativeEntry & { readonly entryRevision: number; readonly action: string; readonly definitionId: string };

export type ReviewDateActions = {
  readonly kind: 'Actions';
  readonly reviewDate: string;
  // Keyed by Trade identity; a Trade with no Action for the date is absent (never an implicit Hold).
  readonly actions: Readonly<Record<string, DailyAction>>;
  readonly snapshot: { readonly journalRevision: number };
};
