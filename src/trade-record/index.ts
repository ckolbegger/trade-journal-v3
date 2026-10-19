import type {
  PlanCondition,
  PlanBaseline,
  PlannedLeg,
  StrategyShape,
  TradePlan,
} from "../plan";
import type { TransactionSeam } from "../persistence/indexeddb/transaction";

/**
 * Trade Record: the factual and audit history of economic Trades and the one stored/indexed
 * derived-state exception, Lifecycle State. D2 implements the Confirm Plan member of the closed
 * `TradeRecordChange` union through `prepareChange` and `applyPreparedChange`; later members are
 * absent rather than stubbed, because an uninstalled capability must not exist as a fabricated
 * branch.
 *
 * This module never calculates Position, P&L, risk or payoff. The frozen Plan Baseline it stores is
 * the value Trade Analysis established and the coordinator bound to the candidate it prepared.
 */
export type TradeId = string;
export type TradeFactId = string;
export type FactRevision = number;
export type RecordedSequence = number;

export const TRADE_FACT_STORE = "tradeRecord";
export const TRADE_LIFECYCLE_STORE = "tradeLifecycle";
export const TRADE_VERSION_STORE = "tradeVersion";
export const LIFECYCLE_INDEX_STORE = "lifecycleIndex";

export type { LifecycleStateName } from "../plan";

/**
 * The complete effective projection Trade Analysis needs for one Trade. `candidate: true` marks a
 * non-durable reference that exists only inside a prepared command and reserves no identity.
 */
export interface AnalysisInput {
  readonly tradeId: string;
  readonly candidate: boolean;
  readonly accountId: string;
  readonly strategyStableKey: string;
  readonly tags: readonly string[];
  readonly factRevision: FactRevision;
  readonly recordedSequence: RecordedSequence;
  readonly economicTime: string;
  /** Audit provenance only; never substitutes for Economic Time. */
  readonly saveTime: string;
  readonly plan: TradePlan;
}

/** One typed structural problem, always naming the field it is about. */
export interface TradeIssue {
  readonly code:
    | "NonPositiveQuantity"
    | "MissingContractEvidence"
    | "AmbiguousContractEvidence"
    | "ShapeRoleCount"
    | "ShapeRoleMismatch"
    | "DuplicateRole"
    | "MissingIntendedEntry"
    | "UnknownTrade";
  readonly field: string;
  readonly detail: string;
  readonly legId?: string;
  readonly conditionId?: string;
}

export interface ConfirmPlanChange {
  readonly kind: "ConfirmPlan";
  readonly accountId: string;
  readonly strategyStableKey: string;
  readonly strategyShape: StrategyShape;
  readonly tags: readonly string[];
  readonly plan: TradePlan;
  /** The one explicit Economic Time of this command. */
  readonly economicTime: string;
  /** Audit provenance supplied by the coordinator, never the injected clock read here. */
  readonly saveTime: string;
  /** Absent for a creating confirmation; present for a change to an existing Plan. */
  readonly tradeId?: TradeId;
  readonly expectedFactRevision?: FactRevision;
}

/** The closed change union. Later deliverables add members; none is stubbed ahead of its owner. */
export type TradeRecordChange = ConfirmPlanChange;

export type PrepareNoWriteReason =
  | "StaleRevision"
  | "IncoherentLegs"
  | "ShapeMismatch"
  | "MissingPlan";

export interface PrepareNoWrite {
  readonly outcome: "NoWrite";
  readonly reason: PrepareNoWriteReason;
  readonly issues: readonly TradeIssue[];
  /** Always empty: a proposed change never escapes as a candidate set. */
  readonly candidates: readonly [];
  readonly expected?: FactRevision;
  readonly current?: FactRevision;
}

export type PrepareTradeChangeResult =
  | {
      readonly outcome: "Prepared";
      readonly before?: AnalysisInput;
      readonly candidate: AnalysisInput;
      readonly digest: string;
    }
  | PrepareNoWrite
  | { readonly outcome: "UnsupportedChange"; readonly changeKind: string };

/** Deterministic canonical form: sorted keys, no whitespace, arrays in supplied order. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** SHA-256 over the canonical semantic form. Save time and expected revision are excluded. */
export async function canonicalDigest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(value));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const digest = await crypto.subtle.digest("SHA-256", buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function positiveQuantity(leg: PlannedLeg): boolean {
  const amount = Number(leg.quantity.amount);
  return Number.isFinite(amount) && amount > 0;
}

function roleKindOf(leg: PlannedLeg): "stock" | "call" | "put" {
  const obligation = leg.objectiveCriteria?.obligation;
  if (obligation === "Call") return "call";
  if (obligation === "Put") return "put";
  return leg.instrument.instrumentClass === "option" ? "put" : "stock";
}

function legIssues(leg: PlannedLeg, index: number): TradeIssue[] {
  const issues: TradeIssue[] = [];
  const field = `plan.plannedLegs[${index}]`;
  if (!positiveQuantity(leg)) {
    issues.push({
      code: "NonPositiveQuantity",
      field: `${field}.quantity`,
      detail: "a Planned Leg needs a positive quantity",
      legId: leg.legId,
    });
  }
  const hasContract = leg.contract !== undefined;
  const hasCriteria = leg.objectiveCriteria !== undefined;
  if (!hasContract && !hasCriteria) {
    issues.push({
      code: "MissingContractEvidence",
      field,
      detail: "a Planned Leg needs either an exact contract or complete objective criteria",
      legId: leg.legId,
    });
  }
  if (hasContract && hasCriteria) {
    issues.push({
      code: "AmbiguousContractEvidence",
      field,
      detail: "a Planned Leg carries both an exact contract and objective criteria",
      legId: leg.legId,
    });
  }
  return issues;
}

/** Structural coherence of the leg set against the immutable Strategy shape. */
export function structuralIssues(change: ConfirmPlanChange): TradeIssue[] {
  const issues: TradeIssue[] = [];
  if (change.plan.intendedEntry.amount === "") {
    issues.push({
      code: "MissingIntendedEntry",
      field: "plan.intendedEntry",
      detail: "a confirmed Plan needs an intended entry",
    });
  }
  change.plan.plannedLegs.forEach((leg, index) => issues.push(...legIssues(leg, index)));

  const roles = change.strategyShape.roles;
  const legs = change.plan.plannedLegs;
  if (legs.length !== roles.length) {
    issues.push({
      code: "ShapeRoleCount",
      field: "plan.plannedLegs",
      detail: `${change.strategyStableKey} declares ${roles.length} role(s) but the command supplies ${legs.length} leg(s)`,
    });
  }

  const seen = new Set<string>();
  legs.forEach((leg, index) => {
    const role = roles[index];
    const kind = roleKindOf(leg);
    if (role !== undefined && (role.side !== leg.side || role.kind !== kind)) {
      issues.push({
        code: "ShapeRoleMismatch",
        field: `plan.plannedLegs[${index}]`,
        detail: `${change.strategyStableKey} role ${index} is ${role.side} ${role.kind}, not ${leg.side} ${kind}`,
        legId: leg.legId,
      });
    }
    const key = `${leg.side}:${kind}`;
    if (seen.has(key)) {
      issues.push({
        code: "DuplicateRole",
        field: `plan.plannedLegs[${index}]`,
        detail: `the shape declares one ${leg.side} ${kind} role and the command supplies it twice`,
        legId: leg.legId,
      });
    }
    seen.add(key);
  });
  return issues;
}

/** Whether this candidate may use the network-free identity form. */
export function candidateReference(digest: string): string {
  return `candidate:${digest.slice(0, 16)}`;
}

interface FactRow extends Record<string, unknown> {
  readonly id: string;
  readonly kind: string;
}

function planFromFacts(rows: readonly FactRow[]): TradePlan {
  const plan = rows.find((row) => row.kind === "plan");
  const legs = rows.filter((row) => row.kind === "planned-leg");
  const conditions = rows.filter((row) => row.kind === "management-condition");
  return {
    intendedEntry: (plan?.intendedEntry as TradePlan["intendedEntry"] | undefined) ?? { amount: "" },
    plannedLegs: legs.map((row) => row.leg as PlannedLeg),
    originalManagement: conditions.map((row) => row.condition as PlanCondition),
  };
}

function storedBaseline(rows: readonly FactRow[]): PlanBaseline | undefined {
  const plan = rows.find((row) => row.kind === "plan");
  return plan?.baseline as PlanBaseline | undefined;
}

function analysisInputOf(
  tradeId: string,
  rows: readonly FactRow[],
  lifecycle: Record<string, unknown> | undefined,
  candidate: boolean,
): AnalysisInput {
  const header = rows.find((row) => row.kind === "trade");
  return {
    tradeId,
    candidate,
    accountId: String(header?.accountId ?? ""),
    strategyStableKey: String(header?.strategyStableKey ?? ""),
    tags: (header?.tags as readonly string[] | undefined) ?? [],
    factRevision: Number(lifecycle?.factRevision ?? 0),
    recordedSequence: Number(header?.recordedSequence ?? 0),
    economicTime: String(header?.economicTime ?? ""),
    saveTime: String(header?.saveTime ?? ""),
    plan: planFromFacts(rows),
  };
}

/** The frozen Plan Baseline currently stored for a Trade, or undefined when it has none. */
export function baselineOf(
  rows: readonly Record<string, unknown>[],
): PlanBaseline | undefined {
  return storedBaseline(rows as readonly FactRow[]);
}

/**
 * `prepareChange` for a Confirm Plan change: no write, expected-revision check, structural
 * coherence, and a canonical digest. It returns records, not identities — a prepared candidate
 * reserves no durable `TradeId`, `TradeFactId` or `FactVersionId`.
 */
export async function prepareChange(
  seam: TransactionSeam,
  change: TradeRecordChange,
): Promise<PrepareTradeChangeResult> {
  if (change.kind !== "ConfirmPlan") {
    return { outcome: "UnsupportedChange", changeKind: String((change as { kind?: string }).kind) };
  }

  const issues = structuralIssues(change);
  const legCodes = new Set([
    "NonPositiveQuantity",
    "MissingContractEvidence",
    "AmbiguousContractEvidence",
  ]);
  const shapeCodes = new Set(["ShapeRoleCount", "ShapeRoleMismatch", "DuplicateRole"]);
  if (issues.some((issue) => legCodes.has(issue.code))) {
    return { outcome: "NoWrite", reason: "IncoherentLegs", issues, candidates: [] };
  }
  if (issues.some((issue) => shapeCodes.has(issue.code))) {
    return { outcome: "NoWrite", reason: "ShapeMismatch", issues, candidates: [] };
  }
  if (issues.length > 0) {
    return { outcome: "NoWrite", reason: "MissingPlan", issues, candidates: [] };
  }

  const digest = await canonicalDigest({
    kind: change.kind,
    accountId: change.accountId,
    strategyStableKey: change.strategyStableKey,
    tags: change.tags,
    economicTime: change.economicTime,
    plan: change.plan,
    tradeId: change.tradeId ?? null,
  });
  const tradeId = change.tradeId ?? candidateReference(digest);

  let before: AnalysisInput | undefined;
  if (change.tradeId !== undefined) {
    const snapshot = await seam.snapshot([TRADE_FACT_STORE, TRADE_LIFECYCLE_STORE]);
    const lifecycle = snapshot
      .rows(TRADE_LIFECYCLE_STORE)
      .find((row) => row.tradeId === change.tradeId);
    if (lifecycle === undefined) {
      return {
        outcome: "NoWrite",
        reason: "MissingPlan",
        issues: [
          {
            code: "UnknownTrade",
            field: "tradeId",
            detail: `no Trade ${change.tradeId} exists to change`,
          },
        ],
        candidates: [],
      };
    }
    const current = Number(lifecycle.factRevision);
    if (change.expectedFactRevision !== current) {
      return {
        outcome: "NoWrite",
        reason: "StaleRevision",
        issues: [
          {
            code: "UnknownTrade",
            field: "expectedFactRevision",
            detail: `the Trade is at FactRevision ${current}, not ${String(change.expectedFactRevision)}`,
          },
        ],
        candidates: [],
        expected: change.expectedFactRevision,
        current,
      };
    }
    const rows = snapshot
      .rows(TRADE_FACT_STORE)
      .filter((row) => row.tradeId === change.tradeId) as FactRow[];
    before = analysisInputOf(change.tradeId, rows, lifecycle, false);
  }

  const candidate: AnalysisInput = {
    tradeId,
    candidate: true,
    accountId: change.accountId,
    strategyStableKey: change.strategyStableKey,
    tags: [...change.tags],
    factRevision: 0,
    recordedSequence: 0,
    economicTime: change.economicTime,
    saveTime: change.saveTime,
    plan: change.plan,
  };

  return { outcome: "Prepared", ...(before === undefined ? {} : { before }), candidate, digest };
}

export {
  applyPreparedChange,
  type ApplyPreparedTradeChangeCommand,
  type DerivedTradeReconciliation,
  type StagedTradeProjection,
  type TradeIdentityMapping,
  type TradeRecordApplyResult,
} from "./apply";
export {
  queryRecords,
  type LifecycleListRow,
  type QueryCounts,
  type TradeRecordPage,
  type TradeRecordQuery,
} from "./query";
