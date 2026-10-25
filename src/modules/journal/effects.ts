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

export type JournalEffectRequest = PlanReflectionRequest | PositionChangeReflectionRequest;

// One obligation has exactly one current outcome (Journal, "Debt and obligation semantics").
export type JournalObligationKey =
  | { readonly entryType: 'PlanReflection'; readonly trade: CandidateRef }
  | { readonly entryType: 'PositionChangeReflection'; readonly positionChange: CandidateRef };

// A saved answer: "optional" means Unanswered is a valid value; it never means declined.
export type ResponseValue = AnswerInput | { readonly kind: 'Unanswered' };

export interface PreparedEntry {
  readonly entryTypeKey: string;
  readonly definitionId: string;
  readonly sourceKey: string;
  readonly obligationKey: JournalObligationKey;
  readonly anchor: { readonly kind: 'Trade'; readonly ref: CandidateRef };
  readonly origin: { readonly kind: 'Plan' | 'PositionChange'; readonly ref: CandidateRef };
  readonly momentTime: Instant;
  readonly authoredTime: Instant;
  // One response per prompt of the definition revision, in its order.
  readonly responses: readonly { readonly promptId: string; readonly value: ResponseValue }[];
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

export interface PreparedJournalEffects {
  readonly entries: readonly PreparedEntry[];
  readonly declines: readonly PreparedDecline[];
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
}

export type PrepareJournalEffectsResult =
  | { readonly kind: 'Rejected'; readonly issues: readonly JournalIssue[] }
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
  readonly origin: { readonly kind: 'Plan' | 'PositionChange'; readonly factId: string };
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

export type JournalApplyResult = {
  readonly kind: 'Staged';
  readonly entries: readonly EntryProjection[];
  readonly declines: readonly DeclineProjection[];
};

export interface JournalQuery {
  readonly scope: 'TradeNarrative';
  readonly tradeId: string;
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
