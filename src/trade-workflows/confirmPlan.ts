import type {
  PlanReflectionForm,
  PreparedPlanReflection,
  StagedJournalOutcome,
} from "../journal/effects";
import type { LifecycleStateName, PlanBaseline, TradePlanInput } from "../plan";
import type { TransactionSeam } from "../persistence/indexeddb/transaction";
import type { Money } from "../values";
import type { RuntimeNotWritable } from "../results";
import { derive } from "../analysis/trade";
import {
  applyPreparedChange,
  prepareChange,
  type StagedTradeProjection,
  type TradeRecordApplyResult,
  type TradeIdentityMapping,
} from "../trade-record";
import {
  assessDraft,
  REAL_PARTICIPANTS,
  type ConfirmPlanConflict,
  type ConfirmPlanParticipants,
  type ConfirmPlanRejection,
  type WorkflowIssue,
} from "./assessDraft";

/**
 * Trade Workflows is the only ordinary public interface for trader-initiated Trade changes. D2
 * installs the `confirmPlan` member: it resolves the Account and Strategy as new selections under one
 * Catalog snapshot, prepares the completed Plan Reflection against the exact definition revision the
 * form displayed, has Trade Analysis accept the Plan and produce a positive numeric 1R, prepares the
 * Trade candidate, requires the derivation bound to that exact candidate, and commits every Trade and
 * Journal effect in one semantic transaction.
 *
 * The resolve -> complete -> assess -> derive step is not repeated here: `assessDraft` performs it,
 * `previewPlan` returns its figures and `confirmPlan` re-runs it at commit time, so a preview can
 * never be used as a stale binding and the two can never drift.
 */
export interface ConfirmPlanCommand {
  readonly accountId: string;
  readonly strategyStableKey: string;
  readonly tags: readonly string[];
  readonly plan: TradePlanInput;
  /** The exact definition revision the trader saw, with stable Prompt identities. */
  readonly reflection: PlanReflectionForm;
  /** The one explicit Economic Time of this command. */
  readonly economicTime: string;
  /** Audit provenance supplied by the caller. */
  readonly saveTime: string;
  readonly firstAuthoredTime: string;
  /** Held from the Catalog read that populated the form; absent skips the snapshot check. */
  readonly expectedCatalogSnapshotRevision?: number;
  readonly cutoffTradingDate?: string;
  readonly obligationKey: string;
}

export interface ConfirmPlanReceipt {
  readonly affectedTradeIds: readonly string[];
  readonly newFactRevisions: Readonly<Record<string, number>>;
  readonly createdFactIds: readonly string[];
  readonly lifecycleTransitions: readonly {
    readonly tradeId: string;
    readonly from: LifecycleStateName | "None";
    readonly to: LifecycleStateName;
  }[];
  readonly entryIds: readonly string[];
  /** Always empty at D2: Plan Reflection requires completion now, so no Debt is created. */
  readonly debtIds: readonly string[];
  readonly declinedEntryIds: readonly string[];
}

/** The derivation the command had to establish for its own acceptance. */
export interface ConfirmPlanDerivation {
  readonly planBaseline: PlanBaseline;
  readonly oneR: Money;
  readonly expectedLifecycle: LifecycleStateName;
}

export interface ConfirmPlanSuccess {
  readonly receipt: ConfirmPlanReceipt;
  readonly postCommit: {
    readonly trades: readonly StagedTradeProjection[];
    readonly derivation: ConfirmPlanDerivation;
    readonly journal: readonly StagedJournalOutcome[];
  };
  /** Advisory only: enough to navigate or refresh, never a list or a report. */
  readonly affected: {
    readonly accountId: string;
    readonly strategyStableKey: string;
    readonly tradeIds: readonly string[];
  };
}

export type ConfirmPlanResult =
  | { readonly outcome: "Accepted"; readonly value: ConfirmPlanSuccess }
  | ConfirmPlanRejection
  | ConfirmPlanConflict
  | RuntimeNotWritable;

export type {
  ConfirmPlanConflict,
  ConfirmPlanParticipants,
  ConfirmPlanRejection,
  WorkflowIssue,
};

/**
 * `confirmPlan`. Validation failures and stale bindings return typed no-write results; infrastructure
 * failure rolls back every participant. Success creates the Trade, freezes the Planned Legs and
 * original management, stores `Planned`, and saves the completed Plan Reflection whose Thesis and
 * Invalidation answers also supply the authoritative Plan semantics.
 */
export async function confirmPlan(
  seam: TransactionSeam,
  command: ConfirmPlanCommand,
  participants: ConfirmPlanParticipants = REAL_PARTICIPANTS,
): Promise<ConfirmPlanResult> {
  // 1. Catalog resolution, Plan completion (E-013), Plan assessment, the frozen baseline and the
  //    completed reflection: the same step a preview runs, re-run here at commit time. Nothing is
  //    staged before this.
  const assessed = await assessDraft(seam, command, {
    participants,
    firstAuthoredTime: command.firstAuthoredTime,
  });
  if (assessed.outcome !== "Assessed") return assessed;
  const {
    accountId,
    strategyStableKey,
    strategyShape,
    plan,
    planBaseline: baseline,
    preparedJournal,
  } = assessed.value;

  // 2. The Trade candidate. Still nothing is staged.
  const preparation = await prepareChange(seam, {
    kind: "ConfirmPlan",
    accountId,
    strategyStableKey,
    strategyShape,
    tags: command.tags,
    plan,
    economicTime: command.economicTime,
    saveTime: command.saveTime,
  });
  if (preparation.outcome !== "Prepared") {
    return {
      outcome: "Rejected",
      reason: "the Trade candidate is incoherent",
      issues:
        preparation.outcome === "NoWrite"
          ? preparation.issues.map((issue) => ({
              code: issue.code,
              field: issue.field,
              detail: issue.detail,
            }))
          : [{ code: "UnsupportedChange", field: "plan", detail: "the change is not a Confirm Plan" }],
    };
  }

  // 3. Expected Lifecycle State derived from the candidate facts, and the reconciliation bound to it.
  const derived = derive({
    tradeId: preparation.candidate.tradeId,
    sourceFactRevision: preparation.candidate.factRevision,
    economicTime: preparation.candidate.economicTime,
    analysisCutoff: command.economicTime,
    facts: [{ kind: "trade" }, { kind: "plan" }, ...plan.plannedLegs.map(() => ({ kind: "planned-leg" }))],
  });
  if (derived.expectedLifecycle.outcome !== "Value") {
    return {
      outcome: "Rejected",
      reason: "no expected Lifecycle State could be derived",
      issues: [
        {
          code: "ExpectedLifecycleUnavailable",
          field: "plan",
          detail: `the expected Lifecycle State is ${derived.expectedLifecycle.outcome}`,
        },
      ],
    };
  }
  const expectedLifecycle = derived.expectedLifecycle.value;

  const applied = await applyPreparedChange(seam, {
    preparation,
    reconciliation: {
      candidateDigest: preparation.digest,
      candidateTradeIds: [preparation.candidate.tradeId],
      expectedLifecycle,
      planBaseline: baseline,
      oneR: baseline.oneR,
    },
    committedAt: command.saveTime,
    ...(command.cutoffTradingDate === undefined
      ? {}
      : { cutoffTradingDate: command.cutoffTradingDate }),
  });
  if (applied.outcome !== "Staged") {
    return applied.reason === "StaleRevision"
      ? {
          outcome: "Conflict",
          currentTradeFactRevision: undefined,
          issues: [{ code: applied.reason, field: "expectedRevision", detail: applied.detail }],
        }
      : {
          outcome: "Rejected",
          reason: applied.detail,
          issues: [{ code: applied.reason, field: "trade", detail: applied.detail }],
        };
  }

  // 4. Journal effects mapped through the exact durable Trade mapping, then one commit.
  const anchoring = await reanchor(preparedJournal, applied.identityMapping);
  if (anchoring === undefined) {
    return {
      outcome: "Rejected",
      reason: "the Journal effect could not be anchored",
      issues: [{ code: "AnchorUnresolved", field: "reflection", detail: "no candidate Trade identity" }],
    };
  }
  const appliedJournal = await participants.applyPreparedEffects(seam, {
    effects: anchoring,
    mapping: applied.identityMapping.map((mapping) => ({
      candidateTradeId: mapping.candidateTradeId,
      tradeId: mapping.tradeId,
    })),
    expectedCandidateTradeIds: [preparation.candidate.tradeId],
  });
  if (appliedJournal.outcome === "Conflict") {
    return {
      outcome: "Rejected",
      reason: appliedJournal.detail,
      issues: [{ code: appliedJournal.code, field: "reflection", detail: appliedJournal.detail }],
    };
  }

  const committed = await seam.commit({
    participants: [...applied.participants, ...appliedJournal.participants],
  });
  if (committed.kind === "Rejected") return committed.payload;

  const trade = applied.projections[0];
  const entryIds = appliedJournal.mapping.map((entry) => entry.entryId);
  return {
    outcome: "Accepted",
    value: {
      receipt: {
        affectedTradeIds: applied.projections.map((projection) => projection.tradeId),
        newFactRevisions: applied.revisions,
        createdFactIds: applied.identityMapping.flatMap((mapping) => [
          ...Object.values(mapping.factIds),
          ...mapping.legIds,
          ...mapping.conditionIds,
        ]),
        lifecycleTransitions: applied.lifecycleTransitions,
        entryIds,
        debtIds: [],
        declinedEntryIds: [],
      },
      postCommit: {
        trades: applied.projections,
        derivation: { planBaseline: baseline, oneR: baseline.oneR, expectedLifecycle },
        journal: appliedJournal.staged,
      },
      affected: {
        accountId,
        strategyStableKey,
        tradeIds: trade === undefined ? [] : [trade.tradeId],
      },
    },
  };
}

/**
 * Point the prepared reflection's Anchor at the candidate Trade identity. The prepared effect holds
 * only a candidate reference, so nothing durable was reserved at preparation time; the apply step
 * maps that candidate through Trade Record's exact durable mapping.
 */
function reanchor(
  effects: readonly PreparedPlanReflection[],
  mapping: readonly TradeIdentityMapping[],
): PreparedPlanReflection[] | undefined {
  const candidate = mapping[0];
  if (candidate === undefined) return undefined;
  return effects.map((effect) => ({
    ...effect,
    anchor: { kind: "TradeAnchor" as const, tradeId: candidate.candidateTradeId },
  }));
}

export type { TradeRecordApplyResult };
