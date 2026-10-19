import type { PlannedLeg, PlanBaseline, TradePlan } from "../plan";
import type { Money } from "../values";
import type { ParticipantEffect, TransactionSeam } from "../persistence/indexeddb/transaction";
import {
  LIFECYCLE_INDEX_STORE,
  TRADE_FACT_STORE,
  TRADE_LIFECYCLE_STORE,
  TRADE_VERSION_STORE,
  canonicalDigest,
  type AnalysisInput,
  type FactRevision,
  type LifecycleStateName,
  type PrepareNoWrite,
  type PrepareTradeChangeResult,
} from "./index";

/**
 * The reconciliation a coordinator must supply: the derivation Trade Analysis established for the
 * exact candidate set. Trade Record never sets lifecycle on its own initiative and never re-derives
 * analysis itself.
 */
export interface DerivedTradeReconciliation {
  /** The digest of the preparation this reconciliation was derived for. */
  readonly candidateDigest: string;
  /** The exact candidate Trade identities this reconciliation covers. */
  readonly candidateTradeIds: readonly string[];
  readonly expectedLifecycle: LifecycleStateName;
  readonly planBaseline: PlanBaseline;
  readonly oneR: Money;
}

export interface ApplyPreparedTradeChangeCommand {
  readonly preparation: PrepareTradeChangeResult;
  /** Absent is a typed rejection: the caller must supply the expected derived state. */
  readonly reconciliation?: DerivedTradeReconciliation;
  readonly cutoffTradingDate?: string;
  readonly committedAt: string;
}

export interface TradeIdentityMapping {
  readonly candidateTradeId: string;
  readonly tradeId: string;
  readonly factIds: Readonly<Record<string, string>>;
  readonly legIds: readonly string[];
  readonly conditionIds: readonly string[];
}

export interface StagedTradeProjection {
  readonly tradeId: string;
  readonly factRevision: FactRevision;
  readonly lifecycle: LifecycleStateName;
  readonly accountId: string;
  readonly strategyStableKey: string;
  readonly tags: readonly string[];
  readonly economicTime: string;
  readonly saveTime: string;
  readonly plan: TradePlan;
  readonly baseline: PlanBaseline;
  readonly oneR: Money;
}

export type ApplyNoWriteReason =
  | "MissingReconciliation"
  | "UnboundReconciliation"
  | "StaleRevision"
  | "DigestMismatch"
  | "NotPrepared";

export type TradeRecordApplyResult =
  | {
      readonly outcome: "Staged";
      readonly participants: readonly ParticipantEffect[];
      readonly identityMapping: readonly TradeIdentityMapping[];
      readonly revisions: Readonly<Record<string, FactRevision>>;
      readonly projections: readonly StagedTradeProjection[];
      readonly lifecycleTransitions: readonly {
        readonly tradeId: string;
        readonly from: LifecycleStateName | "None";
        readonly to: LifecycleStateName;
      }[];
    }
  | {
      readonly outcome: "NoWrite";
      readonly reason: ApplyNoWriteReason;
      readonly detail: string;
      readonly issues: PrepareNoWrite["issues"];
    };

function factIdOf(tradeId: string, kind: string, suffix?: string): string {
  return suffix === undefined ? `${tradeId}:${kind}` : `${tradeId}:${kind}:${suffix}`;
}

function storedInstantsOf(input: AnalysisInput): {
  readonly economicTime: string;
  readonly saveTime: string;
} {
  return { economicTime: input.economicTime, saveTime: input.saveTime };
}

async function effectiveFactDigest(
  input: AnalysisInput,
  baseline: PlanBaseline,
): Promise<string> {
  return canonicalDigest({
    tradeId: input.tradeId,
    accountId: input.accountId,
    strategyStableKey: input.strategyStableKey,
    tags: input.tags,
    plan: input.plan,
    baseline,
    economicTime: input.economicTime,
  });
}

/**
 * `applyPreparedChange` may run only inside a coordinator-owned semantic transaction. It rechecks
 * the base revision and digest, requires a valid `DerivedTradeReconciliation` for the exact
 * candidate set, assigns durable identities and stages the lifecycle and lifecycle-index effects
 * together with the facts. It writes nothing itself: it returns the participants for the one commit.
 */
export async function applyPreparedChange(
  seam: TransactionSeam,
  command: ApplyPreparedTradeChangeCommand,
): Promise<TradeRecordApplyResult> {
  const { preparation, reconciliation } = command;
  if (preparation.outcome !== "Prepared") {
    return {
      outcome: "NoWrite",
      reason: "NotPrepared",
      detail: "the supplied preparation did not produce a candidate",
      issues: preparation.outcome === "NoWrite" ? preparation.issues : [],
    };
  }
  if (reconciliation === undefined) {
    return {
      outcome: "NoWrite",
      reason: "MissingReconciliation",
      detail: "the caller must supply the expected derived state, not an implied default",
      issues: [],
    };
  }
  if (
    reconciliation.candidateTradeIds.length !== 1 ||
    reconciliation.candidateTradeIds[0] !== preparation.candidate.tradeId
  ) {
    return {
      outcome: "NoWrite",
      reason: "UnboundReconciliation",
      detail: "the reconciliation does not bind the exact candidate set that was prepared",
      issues: [],
    };
  }
  if (reconciliation.candidateDigest !== preparation.digest) {
    return {
      outcome: "NoWrite",
      reason: "DigestMismatch",
      detail: "the re-supplied preparation digest does not match the prepared digest",
      issues: [],
    };
  }

  const candidate = preparation.candidate;
  const tradeId = candidate.tradeId.startsWith("candidate:")
    ? `trade:${preparation.digest.slice(0, 16)}`
    : candidate.tradeId;

  const snapshot = await seam.snapshot([TRADE_LIFECYCLE_STORE, TRADE_FACT_STORE]);
  const existingLifecycle = snapshot
    .rows(TRADE_LIFECYCLE_STORE)
    .find((row) => row.tradeId === tradeId);

  const previous = preparation.before;
  if (previous !== undefined) {
    if (existingLifecycle === undefined) {
      return {
        outcome: "NoWrite",
        reason: "StaleRevision",
        detail: "the Trade to change no longer exists",
        issues: [],
      };
    }
    const current = Number(existingLifecycle.factRevision);
    if (current !== previous.factRevision) {
      return {
        outcome: "NoWrite",
        reason: "StaleRevision",
        detail: `the Trade is at FactRevision ${current}, not ${previous.factRevision}`,
        issues: [],
      };
    }
  } else if (existingLifecycle !== undefined) {
    // The prepared creation expected no Trade at this identity; it now exists.
    return {
      outcome: "NoWrite",
      reason: "StaleRevision",
      detail: `the Trade is already at FactRevision ${Number(existingLifecycle.factRevision)}, not a creation`,
      issues: [],
    };
  }
  const factRevision = previous === undefined ? 1 : previous.factRevision + 1;
  const recordedSequence =
    previous === undefined
      ? 1
      : Math.max(
          0,
          ...snapshot
            .rows(TRADE_FACT_STORE)
            .filter((row) => row.tradeId === tradeId)
            .map((row) => Number(row.recordedSequence ?? 0)),
        ) + 1;

  const digest = await effectiveFactDigest({ ...candidate, tradeId }, reconciliation.planBaseline);
  const instants = storedInstantsOf(candidate);

  const header = {
    id: factIdOf(tradeId, "trade"),
    tradeId,
    kind: "trade",
    accountId: candidate.accountId,
    strategyStableKey: candidate.strategyStableKey,
    tags: candidate.tags,
    economicTime: instants.economicTime,
    saveTime: instants.saveTime,
    recordedSequence,
    revision: 1,
  };
  const planRow = {
    id: factIdOf(tradeId, "plan"),
    tradeId,
    kind: "plan",
    intendedEntry: candidate.plan.intendedEntry,
    baseline: reconciliation.planBaseline,
    oneR: reconciliation.oneR,
    economicTime: instants.economicTime,
    recordedSequence,
    revision: 1,
  };
  const legRows = candidate.plan.plannedLegs.map((leg: PlannedLeg) => ({
    id: factIdOf(tradeId, "planned-leg", leg.legId),
    tradeId,
    kind: "planned-leg",
    legId: leg.legId,
    leg,
    economicTime: instants.economicTime,
    recordedSequence,
    revision: 1,
  }));
  const conditionRows = candidate.plan.originalManagement.map((condition) => ({
    id: factIdOf(tradeId, "management-condition", condition.conditionId),
    tradeId,
    kind: "management-condition",
    conditionId: condition.conditionId,
    condition,
    economicTime: instants.economicTime,
    recordedSequence,
    revision: 1,
  }));

  const causingFactId = factIdOf(tradeId, "plan");
  const lifecycleRow = {
    tradeId,
    state: reconciliation.expectedLifecycle,
    effectiveFactDigest: digest,
    causingFactId,
    factRevision,
    ...(candidate.plan.intendedEntry === undefined
      ? {}
      : {}),
    ...(command.cutoffTradingDate === undefined
      ? {}
      : { cutoffTradingDate: command.cutoffTradingDate }),
  };
  const indexRow = {
    tradeId,
    state: reconciliation.expectedLifecycle,
    factRevision,
    ...(command.cutoffTradingDate === undefined
      ? {}
      : { cutoffTradingDate: command.cutoffTradingDate }),
  };
  const versionRow = {
    id: `${tradeId}:${factRevision}`,
    tradeId,
    factRevision,
    recordedSequence,
    committedAt: command.committedAt,
    factIds: [
      header.id,
      planRow.id,
      ...legRows.map((row) => row.id),
      ...conditionRows.map((row) => row.id),
    ],
  };

  const projection: StagedTradeProjection = {
    tradeId,
    factRevision,
    lifecycle: reconciliation.expectedLifecycle,
    accountId: candidate.accountId,
    strategyStableKey: candidate.strategyStableKey,
    tags: candidate.tags,
    economicTime: instants.economicTime,
    saveTime: instants.saveTime,
    plan: candidate.plan,
    baseline: reconciliation.planBaseline,
    oneR: reconciliation.oneR,
  };

  return {
    outcome: "Staged",
    participants: [
      { store: TRADE_FACT_STORE, put: [header, planRow, ...legRows, ...conditionRows] },
      { store: TRADE_LIFECYCLE_STORE, put: [lifecycleRow] },
      { store: LIFECYCLE_INDEX_STORE, put: [indexRow] },
      { store: TRADE_VERSION_STORE, put: [versionRow] },
    ],
    identityMapping: [
      {
        candidateTradeId: candidate.tradeId,
        tradeId,
        factIds: {
          trade: header.id,
          plan: planRow.id,
        },
        legIds: legRows.map((row) => row.id),
        conditionIds: conditionRows.map((row) => row.id),
      },
    ],
    revisions: { [TRADE_FACT_STORE]: factRevision },
    projections: [projection],
    lifecycleTransitions: [
      {
        tradeId,
        from: existingLifecycle === undefined ? "None" : (existingLifecycle.state as LifecycleStateName),
        to: reconciliation.expectedLifecycle,
      },
    ],
  };
}
