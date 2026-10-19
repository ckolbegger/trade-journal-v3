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
  | { readonly kind: 'Decline' }
  | { readonly kind: 'Defer' };

export interface PlanReflectionRequest {
  readonly obligation: 'PlanReflection';
  readonly disposition: ReflectionDisposition;
  readonly anchor: { readonly kind: 'Trade'; readonly ref: CandidateRef };
  readonly origin: { readonly kind: 'Plan'; readonly ref: CandidateRef };
  readonly momentTime: Instant;
}

// A saved answer: "optional" means Unanswered is a valid value; it never means declined.
export type ResponseValue = AnswerInput | { readonly kind: 'Unanswered' };

export interface PreparedEntry {
  readonly entryTypeKey: string;
  readonly definitionId: string;
  readonly sourceKey: string;
  readonly anchor: { readonly kind: 'Trade'; readonly ref: CandidateRef };
  readonly origin: { readonly kind: 'Plan'; readonly ref: CandidateRef };
  readonly momentTime: Instant;
  readonly authoredTime: Instant;
  // One response per prompt of the definition revision, in its order.
  readonly responses: readonly { readonly promptId: string; readonly value: ResponseValue }[];
}

export interface PreparedJournalEffects {
  readonly entries: readonly PreparedEntry[];
}

export interface JournalIssue {
  readonly promptId?: string;
  readonly code:
    | 'RequiredAnswerMissing'
    | 'InvalidScaleValue'
    | 'UnknownOption'
    | 'UnknownPrompt'
    | 'DefinitionRevisionMismatch'
    | 'DispositionNotAllowed';
}

export type PrepareJournalEffectsResult =
  | { readonly kind: 'Rejected'; readonly issues: readonly JournalIssue[] }
  | {
  readonly kind: 'Prepared';
  readonly effects: PreparedJournalEffects;
  // Workflow-critical answers by semantic role, entered once and frozen into the Plan facts.
  readonly semantics: { readonly Thesis: string; readonly Invalidation: string };
      // The Journal snapshot this outcome was validated against, rechecked when applied.
      readonly snapshot: { readonly journalRevision: number };
    };

// The durable projection of a staged or saved Entry: its current version flattened.
export interface EntryProjection {
  readonly id: string;
  readonly entryTypeKey: string;
  readonly sourceKey: string;
  readonly anchor: { readonly kind: 'Trade'; readonly tradeId: string };
  readonly origin: { readonly kind: 'Plan'; readonly factId: string };
  readonly momentTime: Instant;
  readonly authoredTime: Instant;
  readonly definitionId: string;
  readonly responses: readonly { readonly promptId: string; readonly value: ResponseValue }[];
}

export type JournalApplyResult = { readonly kind: 'Staged'; readonly entries: readonly EntryProjection[] };

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
  readonly responses: readonly { readonly prompt: string; readonly answer: NarrativeAnswer }[];
}

export type JournalPage = {
  readonly kind: 'Page';
  readonly items: readonly NarrativeEntry[];
  readonly snapshot: { readonly journalRevision: number };
};
