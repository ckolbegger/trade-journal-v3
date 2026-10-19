import {
  runtimeNotWritable,
  type RuntimeNotWritable,
  type RuntimeReadinessFailure,
  type SafeAction,
} from "../../results";

/** The three outcomes of the Runtime Readiness gate (T20 supplies the decision). */
export type ReadinessOutcome = "Writable" | "RecoveryOnly" | "Unsupported";

export interface ReadinessDecision {
  readonly outcome: ReadinessOutcome;
  readonly failedChecks: readonly RuntimeReadinessFailure[];
  /** Set when a known or possible existing root cannot be read or validated. */
  readonly existingRootUnreadable?: boolean;
  readonly safeActions?: readonly SafeAction[];
}

export interface ReadinessSource {
  current(): Promise<ReadinessDecision>;
}

export type WriteGateResult =
  | { readonly kind: "Allowed"; readonly decision: ReadinessDecision }
  | { readonly kind: "Rejected"; readonly payload: RuntimeNotWritable };

export interface WriteGate {
  /** Re-evaluates readiness at every mutation; never reuses a previous verdict. */
  beforeWrite(): Promise<WriteGateResult>;
  /** Reports the current readiness without gating an exempt operation. */
  inspect(): Promise<ReadinessDecision>;
}

/** Build the one cross-cutting payload for a non-Writable session (T8's constructor). */
export function rejectionFor(decision: ReadinessDecision): RuntimeNotWritable {
  return runtimeNotWritable({
    runtimeReadiness: decision.outcome === "RecoveryOnly" ? "RecoveryOnly" : "Unsupported",
    failedChecks: decision.failedChecks,
    existingRootUnreadable: decision.existingRootUnreadable === true,
    safeActions: decision.safeActions,
  });
}

export function createWriteGate(source: ReadinessSource): WriteGate {
  return {
    async beforeWrite(): Promise<WriteGateResult> {
      const decision = await source.current();
      return decision.outcome === "Writable"
        ? { kind: "Allowed", decision }
        : { kind: "Rejected", payload: rejectionFor(decision) };
    },
    inspect: () => source.current(),
  };
}

export type GatedWriteResult<T> =
  | {
      readonly kind: "Committed";
      readonly value: T;
      readonly decision: ReadinessDecision;
    }
  | { readonly kind: "Rejected"; readonly payload: RuntimeNotWritable };

/**
 * The seam's one write path: readiness is evaluated before anything is opened, so a rejected
 * mutation cannot have begun a readwrite transaction.
 */
export async function commitThroughGate<T>(
  gate: WriteGate,
  commit: (decision: ReadinessDecision) => Promise<T>,
): Promise<GatedWriteResult<T>> {
  const gated = await gate.beforeWrite();
  if (gated.kind === "Rejected") return gated;
  return { kind: "Committed", value: await commit(gated.decision), decision: gated.decision };
}
