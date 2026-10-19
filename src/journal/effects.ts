import {
  FIXED_ENTRY_TYPE_KEYS,
  FIXED_SOURCE_KEYS,
  getDefinitions,
  type EntryTypeDefinition,
} from "./definitions";
import type { TransactionSeam, ParticipantEffect } from "../persistence/indexeddb/transaction";

const JOURNAL_STORE = "journal";

/**
 * Journal prepared effects: the nonpersistent path that validates a completed workflow obligation
 * against one exact Entry Definition revision and binds candidate Anchors and origins without
 * reserving any identity, and the staging half that maps those candidates through the coordinator's
 * exact durable Trade mapping inside one shared transaction.
 */
export type JournalAnchor =
  | { readonly kind: "TradeAnchor"; readonly tradeId: string }
  | { readonly kind: "Standalone" };

export type JournalOrigin = {
  readonly kind: "Plan" | "PositionChange" | "ManagementRevision" | "Deviation" | "DailyReview";
  readonly factId?: string;
};

export interface JournalAnswer {
  /** The stable Prompt identity, never the label. */
  readonly promptStableKey: string;
  readonly value: string;
}

export interface PlanReflectionForm {
  readonly entryTypeStableKey: string;
  readonly definitionRevision: number;
  readonly answers: readonly JournalAnswer[];
}

export type ReflectionDisposition =
  | { readonly kind: "Complete"; readonly form: PlanReflectionForm }
  | { readonly kind: "Decline"; readonly reason?: string }
  | { readonly kind: "Defer" };

export interface JournalObligation {
  readonly obligationKey: string;
  readonly disposition: ReflectionDisposition;
}

export interface JournalEffectRequest {
  readonly obligations: readonly JournalObligation[];
  readonly anchor: JournalAnchor;
  readonly origin: JournalOrigin;
  /** Moment time is the Economic Time of the causing command. */
  readonly momentTime: string;
  /** Audit provenance; never substituted for the moment time. */
  readonly firstAuthoredTime: string;
}

export type JournalIssueCode =
  | "UnansweredRequiredPrompt"
  | "CompleteNowRequired"
  | "DeclineNotPermitted"
  | "ForeignOptionSelection"
  | "UnknownPrompt"
  | "DefinitionNotFound"
  | "NoObligation";

export interface JournalIssue {
  readonly code: JournalIssueCode;
  readonly field: string;
  readonly detail: string;
  readonly promptStableKey?: string;
}

export interface PreparedPlanReflection {
  readonly obligationKey: string;
  readonly entryTypeStableKey: string;
  readonly definitionRevision: number;
  /** The exact definition the form was validated against, so the Entry can render what the trader saw. */
  readonly definitionSnapshot: EntryTypeDefinition;
  readonly source: {
    readonly stableKey: string;
    readonly label: string;
    readonly writingPath: string;
    readonly revision: number;
  };
  readonly anchor: JournalAnchor;
  readonly origin: JournalOrigin;
  readonly momentTime: string;
  readonly firstAuthoredTime: string;
  readonly answers: readonly (JournalAnswer & {
    readonly promptLabel: string;
    readonly semanticRole?: "thesis" | "invalidation" | "revision-rationale";
  })[];
  /** Non-durable candidate reference; reserves no identity. */
  readonly candidateEntryReference: string;
}

export type PrepareJournalEffectsResult =
  | { readonly outcome: "Prepared"; readonly effects: readonly PreparedPlanReflection[] }
  | { readonly outcome: "Rejected"; readonly issues: readonly JournalIssue[] };

const COMPLETE_NOW_ONLY = new Set(["entryType.plan-reflection", "entryType.management-revision"]);

function candidateReferenceOf(obligationKey: string, definitionRevision: number): string {
  return `candidate-entry:${obligationKey}:${definitionRevision}`;
}

/**
 * `prepareEffects` for one completed Plan Reflection. Plan Reflection requires completion *now*, so
 * `Defer` and `Decline` are typed rejections rather than Debt or a decline.
 */
export async function prepareEffects(
  seam: TransactionSeam,
  request: JournalEffectRequest,
): Promise<PrepareJournalEffectsResult> {
  const issues: JournalIssue[] = [];
  const prepared: PreparedPlanReflection[] = [];

  if (request.obligations.length === 0) {
    return {
      outcome: "Rejected",
      issues: [{ code: "NoObligation", field: "obligations", detail: "no workflow obligation was supplied" }],
    };
  }

  for (const obligation of request.obligations) {
    const disposition = obligation.disposition;
    const form = disposition.kind === "Complete" ? disposition.form : undefined;

    if (COMPLETE_NOW_ONLY.has(form?.entryTypeStableKey ?? "entryType.plan-reflection")) {
      if (disposition.kind === "Defer") {
        issues.push({
          code: "CompleteNowRequired",
          field: `obligations[${obligation.obligationKey}].disposition`,
          detail: "this Entry Type requires completion now; deferral would create Debt",
        });
        continue;
      }
      if (disposition.kind === "Decline") {
        issues.push({
          code: "DeclineNotPermitted",
          field: `obligations[${obligation.obligationKey}].disposition`,
          detail: "this Entry Type cannot be declined while its capability is installed",
        });
        continue;
      }
    }
    if (form === undefined) continue;

    const definitions = await getDefinitions(seam, {
      entryTypeStableKey: form.entryTypeStableKey,
      revision: form.definitionRevision,
    });
    if (definitions.outcome === "NotFound") {
      issues.push({
        code: "DefinitionNotFound",
        field: `obligations[${obligation.obligationKey}].form.definitionRevision`,
        detail: `no retained ${form.entryTypeStableKey} revision ${form.definitionRevision}`,
      });
      continue;
    }
    const definition = definitions.entryTypes[0];
    if (definition === undefined) continue;

    const answersByKey = new Map(form.answers.map((answer) => [answer.promptStableKey, answer]));
    for (const answer of form.answers) {
      const prompt = definition.prompts.find((candidate) => candidate.stableKey === answer.promptStableKey);
      if (prompt === undefined) {
        issues.push({
          code: "UnknownPrompt",
          field: `obligations[${obligation.obligationKey}].form.answers`,
          detail: `${answer.promptStableKey} is not part of this definition revision`,
          promptStableKey: answer.promptStableKey,
        });
        continue;
      }
      if (
        prompt.kind === "singleSelect" &&
        (prompt.options ?? []).every((option) => option.stableKey !== answer.value)
      ) {
        issues.push({
          code: "ForeignOptionSelection",
          field: `obligations[${obligation.obligationKey}].form.answers`,
          detail: `${answer.value} does not belong to the closed option set of "${prompt.label}"`,
          promptStableKey: answer.promptStableKey,
        });
      }
    }

    for (const prompt of definition.prompts) {
      const answer = answersByKey.get(prompt.stableKey);
      const blank = answer === undefined || answer.value.trim() === "";
      if (prompt.required && blank) {
        issues.push({
          code: "UnansweredRequiredPrompt",
          field: `obligations[${obligation.obligationKey}].form.answers`,
          detail: `"${prompt.label}" is required and was not answered`,
          promptStableKey: prompt.stableKey,
        });
      }
    }

    const source = definitions.sources.find((candidate) => candidate.writingPath === "plan-confirmation");
    if (source === undefined) {
      issues.push({
        code: "DefinitionNotFound",
        field: "sources",
        detail: "the Plan Confirmation Source is not installed",
      });
      continue;
    }

    prepared.push({
      obligationKey: obligation.obligationKey,
      entryTypeStableKey: form.entryTypeStableKey,
      definitionRevision: definition.revision,
      definitionSnapshot: definition,
      source: {
        stableKey: source.sourceStableKey,
        label: source.label,
        writingPath: source.writingPath,
        revision: source.revision,
      },
      anchor: request.anchor,
      origin: request.origin,
      momentTime: request.momentTime,
      firstAuthoredTime: request.firstAuthoredTime,
      answers: form.answers.flatMap((answer) => {
        const prompt = definition.prompts.find(
          (candidate) => candidate.stableKey === answer.promptStableKey,
        );
        if (prompt === undefined) return [];
        return [
          {
            ...answer,
            promptLabel: prompt.label,
            ...(prompt.semanticRole === undefined ? {} : { semanticRole: prompt.semanticRole }),
          },
        ];
      }),
      candidateEntryReference: candidateReferenceOf(obligation.obligationKey, definition.revision),
    });
  }

  if (issues.length > 0) return { outcome: "Rejected", issues };
  return { outcome: "Prepared", effects: prepared };
}

/** The Trade identity mapping the coordinator established by applying the Trade candidate. */
export interface TradeIdentityMapping {
  readonly candidateTradeId: string;
  readonly tradeId: string;
}

export interface ApplyJournalEffectsCommand {
  readonly effects: readonly PreparedPlanReflection[];
  readonly mapping: readonly TradeIdentityMapping[];
  /** The candidates the coordinator is applying; the mapping must contain exactly these. */
  readonly expectedCandidateTradeIds: readonly string[];
}

export interface StagedJournalOutcome {
  readonly entryId: string;
  readonly revision: number;
  readonly obligationKey: string;
  readonly entryTypeStableKey: string;
  readonly sourceStableKey: string;
  readonly definitionRevision: number;
  readonly anchor: JournalAnchor;
  readonly momentTime: string;
  readonly firstAuthoredTime: string;
  readonly thesis: string;
  readonly invalidation: string;
  readonly answers: PreparedPlanReflection["answers"];
}

export type ApplyJournalEffectsResult =
  | {
      readonly outcome: "Applied";
      /** Participants the coordinator includes in its one semantic commit. */
      readonly participants: readonly ParticipantEffect[];
      readonly mapping: readonly { readonly obligationKey: string; readonly entryId: string }[];
      readonly staged: readonly StagedJournalOutcome[];
    }
  | { readonly outcome: "Conflict"; readonly code: "MappingMismatch" | "DuplicateObligation" | "DefinitionRevisionMissing"; readonly detail: string; readonly issues: readonly JournalIssue[] };

/**
 * `applyPreparedEffects` stages the complete batch or none. It writes nothing itself: it returns the
 * participants the coordinator commits together, after mapping candidates through the exact durable
 * Trade mapping, rechecking that every candidate is mapped and that one obligation key has exactly
 * one current outcome.
 */
export async function applyPreparedEffects(
  seam: TransactionSeam,
  command: ApplyJournalEffectsCommand,
): Promise<ApplyJournalEffectsResult> {
  const mapped = new Map(command.mapping.map((entry) => [entry.candidateTradeId, entry.tradeId]));
  for (const candidate of command.expectedCandidateTradeIds) {
    if (!mapped.has(candidate)) {
      return {
        outcome: "Conflict",
        code: "MappingMismatch",
        detail: `the mapping does not contain the candidate ${candidate}`,
        issues: [],
      };
    }
  }
  for (const effect of command.effects) {
    if (!mapped.has(effect.anchor.kind === "TradeAnchor" ? effect.anchor.tradeId : "")) {
      return {
        outcome: "Conflict",
        code: "MappingMismatch",
        detail: `the prepared effect's anchor is not in the supplied mapping`,
        issues: [],
      };
    }
  }

  const rows = (await seam.snapshot([JOURNAL_STORE])).rows(JOURNAL_STORE);
  const obligationsWithOutcome = new Set(
    rows.filter((row) => row.kind === "entry").map((row) => String(row.obligationKey)),
  );
  const staged: StagedJournalOutcome[] = [];
  const participants: ParticipantEffect[] = [];
  const mapping: { obligationKey: string; entryId: string }[] = [];

  for (const effect of command.effects) {
    if (obligationsWithOutcome.has(effect.obligationKey)) {
      return {
        outcome: "Conflict",
        code: "DuplicateObligation",
        detail: `obligation ${effect.obligationKey} already has a current outcome`,
        issues: [],
      };
    }
    const retained = await getDefinitions(seam, {
      entryTypeStableKey: effect.entryTypeStableKey,
      revision: effect.definitionRevision,
    });
    if (retained.outcome === "NotFound") {
      return {
        outcome: "Conflict",
        code: "DefinitionRevisionMissing",
        detail: `the prepared definition revision ${effect.definitionRevision} is no longer retained`,
        issues: [],
      };
    }

    const tradeId = effect.anchor.kind === "TradeAnchor" ? mapped.get(effect.anchor.tradeId) ?? "" : undefined;
    const entryId = `entry:${effect.obligationKey}`;
    const thesis = effect.answers.find((answer) => answer.semanticRole === "thesis")?.value ?? "";
    const invalidation =
      effect.answers.find((answer) => answer.semanticRole === "invalidation")?.value ?? "";

    const outcome: StagedJournalOutcome = {
      entryId,
      revision: 1,
      obligationKey: effect.obligationKey,
      entryTypeStableKey: effect.entryTypeStableKey,
      sourceStableKey: effect.source.stableKey,
      definitionRevision: effect.definitionRevision,
      anchor:
        effect.anchor.kind === "TradeAnchor" && tradeId !== undefined
          ? { kind: "TradeAnchor", tradeId }
          : { kind: "Standalone" },
      momentTime: effect.momentTime,
      firstAuthoredTime: effect.firstAuthoredTime,
      thesis,
      invalidation,
      answers: effect.answers,
    };
    staged.push(outcome);
    mapping.push({ obligationKey: effect.obligationKey, entryId });
    participants.push({
      store: JOURNAL_STORE,
      put: [
        {
          id: entryId,
          kind: "entry",
          revision: 1,
          entryId,
          obligationKey: effect.obligationKey,
          entryTypeStableKey: effect.entryTypeStableKey,
          sourceStableKey: effect.source.stableKey,
          sourceLabel: effect.source.label,
          definitionRevision: effect.definitionRevision,
          definitionSnapshot: effect.definitionSnapshot,
          anchor: outcome.anchor,
          origin: effect.origin,
          momentTime: effect.momentTime,
          firstAuthoredTime: effect.firstAuthoredTime,
          answers: effect.answers,
          thesis,
          invalidation,
        },
      ],
    });
  }

  void FIXED_ENTRY_TYPE_KEYS;
  void FIXED_SOURCE_KEYS;
  return { outcome: "Applied", participants, mapping, staged };
}
