import { assessPlan, completePlan, frozenBaseline } from "../analysis/trade";
import { resolve, type CatalogBindingIssue } from "../catalog";
import {
  applyPreparedEffects,
  prepareEffects,
  type JournalEffectRequest,
  type JournalIssue,
  type PreparedPlanReflection,
} from "../journal/effects";
import type { PlanBaseline, StrategyShape, TradePlan } from "../plan";
import type { TransactionSeam } from "../persistence/indexeddb/transaction";
import type { PreviewPlanCommand } from "./previewPlan";

/**
 * The resolve -> complete -> assess -> derive step both `previewPlan` and `confirmPlan` run, so a
 * figure a trader previews cannot differ from the one confirmation freezes: they are the same
 * computation over the same inputs. It writes nothing; the caller decides whether to commit.
 */

export interface WorkflowIssue {
  readonly field: string;
  readonly detail: string;
  readonly code: string;
  readonly promptStableKey?: string;
  readonly conditionId?: string;
  readonly identity?: string;
}

export interface ConfirmPlanRejection {
  readonly outcome: "Rejected";
  readonly reason: string;
  readonly issues: readonly WorkflowIssue[];
}

export interface ConfirmPlanConflict {
  readonly outcome: "Conflict";
  readonly currentCatalogSnapshotRevision?: number;
  readonly currentTradeFactRevision?: number;
  readonly issues: readonly WorkflowIssue[];
}

/** What the shared step established for this draft. */
export interface AssessedDraft {
  readonly accountId: string;
  readonly strategyStableKey: string;
  readonly strategyShape: StrategyShape;
  /** The supplied Plan with every derivable monetary boundary completed. */
  readonly plan: TradePlan;
  readonly planBaseline: PlanBaseline;
  readonly preparedJournal: readonly PreparedPlanReflection[];
}

export type AssessDraftResult =
  | { readonly outcome: "Assessed"; readonly value: AssessedDraft }
  | ConfirmPlanRejection
  | ConfirmPlanConflict;

/**
 * The Journal participant as a port, so T14's rollback proof can inject a controlled failure at the
 * participant boundary without mocking any application layer. Production always uses the real
 * operations; the default is not a mock.
 */
export interface ConfirmPlanParticipants {
  readonly prepareEffects: typeof prepareEffects;
  readonly applyPreparedEffects: typeof applyPreparedEffects;
}

export const REAL_PARTICIPANTS: ConfirmPlanParticipants = {
  prepareEffects,
  applyPreparedEffects,
};

export interface AssessDraftOptions {
  readonly participants?: ConfirmPlanParticipants;
  /** Confirmation supplies the trader's authored time; a preview has none and substitutes its moment. */
  readonly firstAuthoredTime?: string;
}

function catalogIssues(issues: readonly CatalogBindingIssue[]): WorkflowIssue[] {
  return issues.map((issue) => ({
    code: issue.code,
    field: issue.code.startsWith("Account") ? "accountId" : "strategyStableKey",
    detail: issue.detail,
    identity: issue.identity,
  }));
}

function journalIssues(issues: readonly JournalIssue[]): WorkflowIssue[] {
  return issues.map((issue) => ({
    code: issue.code,
    field: issue.field,
    detail: issue.detail,
    ...(issue.promptStableKey === undefined ? {} : { promptStableKey: issue.promptStableKey }),
  }));
}

/**
 * Assess one draft without writing. `confirmPlan` calls this again at commit time, so a preview can
 * never be used as a stale binding. The prepared Journal effect is returned to the confirmation and
 * discarded by the preview: preparing it validates the reflection against the exact definition
 * revision the form displayed and reserves nothing durable.
 */
export async function assessDraft(
  seam: TransactionSeam,
  command: PreviewPlanCommand,
  options: AssessDraftOptions = {},
): Promise<AssessDraftResult> {
  const participants = options.participants ?? REAL_PARTICIPANTS;
  // 1. Catalog resolution under one snapshot. Nothing is staged before this.
  const resolved = await resolve(seam, {
    accountId: command.accountId,
    strategyStableKey: command.strategyStableKey,
    mode: "NewSelection",
    ...(command.expectedCatalogSnapshotRevision === undefined
      ? {}
      : { expectedSnapshotRevision: command.expectedCatalogSnapshotRevision }),
  });
  if (resolved.outcome === "SnapshotConflict") {
    return {
      outcome: "Conflict",
      currentCatalogSnapshotRevision: resolved.current,
      issues: [
        {
          code: "CatalogSnapshotConflict",
          field: "strategyStableKey",
          detail: `the Catalog moved to revision ${resolved.current} after the form was loaded at ${resolved.expected}`,
        },
      ],
    };
  }
  if (resolved.outcome === "Rejected") {
    return {
      outcome: "Rejected",
      reason: "the Account or Strategy is not selectable",
      issues: catalogIssues(resolved.issues),
    };
  }

  // 2. Complete the supplied Plan: Trade Analysis decides which boundaries are derivable (E-013).
  const completed = completePlan(command.plan);
  if (completed.outcome === "Rejected") {
    return {
      outcome: "Rejected",
      reason: "the Plan cannot be completed for assessment",
      issues: completed.issues.map((issue) => ({
        code: issue.code,
        field: issue.field,
        detail: issue.detail,
        ...(issue.conditionId === undefined ? {} : { conditionId: issue.conditionId }),
      })),
    };
  }

  // 3. Plan assessment: the Plan must be accepted and produce a positive numeric 1R.
  const assessment = await assessPlan({
    strategyShape: resolved.strategy.shape,
    plan: completed.plan,
    economicTime: command.economicTime,
  });
  if (assessment.outcome === "Rejected") {
    return {
      outcome: "Rejected",
      reason: "the Plan is incomplete or incoherent",
      issues: assessment.issues.map((issue) => ({
        code: issue.code,
        field: issue.field,
        detail: issue.detail,
        ...(issue.conditionId === undefined ? {} : { conditionId: issue.conditionId }),
      })),
    };
  }
  const baseline = frozenBaseline(assessment);
  if (baseline === undefined) {
    return {
      outcome: "Rejected",
      reason: "the Plan has no positive numeric Plan Baseline and 1R",
      issues: [
        {
          code: "NoPositiveNumericBaseline",
          field: "plan.originalManagement",
          detail:
            "Original Planned Risk must be a positive number; an unavailable baseline is not a confirmable Plan",
        },
      ],
    };
  }

  // 4. The completed reflection against the exact definition revision the form displayed.
  const effectRequest: JournalEffectRequest = {
    obligations: [
      { obligationKey: command.obligationKey, disposition: { kind: "Complete", form: command.reflection } },
    ],
    anchor: { kind: "TradeAnchor", tradeId: "candidate:pending" },
    origin: { kind: "Plan" },
    momentTime: command.economicTime,
    firstAuthoredTime: options.firstAuthoredTime ?? command.economicTime,
  };
  const preparedJournal = await participants.prepareEffects(seam, effectRequest);
  if (preparedJournal.outcome === "Rejected") {
    return {
      outcome: "Rejected",
      reason: "the Plan Reflection is incomplete",
      issues: journalIssues(preparedJournal.issues),
    };
  }

  return {
    outcome: "Assessed",
    value: {
      accountId: resolved.account.id,
      strategyStableKey: resolved.strategy.stableKey,
      strategyShape: resolved.strategy.shape,
      plan: completed.plan,
      planBaseline: baseline,
      preparedJournal: preparedJournal.effects,
    },
  };
}
