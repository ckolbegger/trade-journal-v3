import type { CalculationAvailability } from "../../results";
import type { LifecycleStateName } from "../../plan";

/**
 * `derive` for a confirmed, unentered long stock Plan: the expected Lifecycle State and its agreement
 * with the stored state. Stored Lifecycle State is authoritative; the expected state is derived and
 * used only to preserve agreement, never to repair a stored disagreement.
 */
export interface TradeDerivationInput {
  readonly tradeId: string;
  readonly sourceFactRevision: number;
  readonly economicTime: string;
  readonly analysisCutoff: string;
  /** The stored Lifecycle State the Trade Record holds for this revision. */
  readonly storedLifecycle?: LifecycleStateName;
  readonly facts: readonly { readonly kind: string; readonly economicTime?: string }[];
  /** True when the supplied facts cannot decide an expected state. */
  readonly factsIncomplete?: boolean;
}

export interface LifecycleAgreement {
  readonly status: "agreed" | "disagreement" | "unavailable";
  readonly stored?: LifecycleStateName;
  readonly expected?: LifecycleStateName;
  readonly reason?: string;
}

export interface DerivedTradeState {
  readonly tradeId: string;
  readonly sourceFactRevision: number;
  readonly analysisCutoff: string;
  readonly expectedLifecycle: CalculationAvailability<LifecycleStateName>;
  readonly agreement: LifecycleAgreement;
  /** A disagreement is a structured integrity finding, never an infrastructure error. */
  readonly findings: readonly {
    readonly kind: "LifecycleDisagreement";
    readonly stored: LifecycleStateName;
    readonly expected: LifecycleStateName;
    readonly detail: string;
  }[];
}

export function derive(input: TradeDerivationInput): DerivedTradeState {
  if (input.factsIncomplete === true || input.facts.length === 0) {
    return {
      tradeId: input.tradeId,
      sourceFactRevision: input.sourceFactRevision,
      analysisCutoff: input.analysisCutoff,
      expectedLifecycle: {
        outcome: "Unavailable",
        reason: "InsufficientFacts",
        details: { supplied: input.facts.length },
      },
      agreement: {
        status: "unavailable",
        ...(input.storedLifecycle === undefined ? {} : { stored: input.storedLifecycle }),
        reason: "InsufficientFacts",
      },
      findings: [],
    };
  }

  // Effective facts at their Economic Time: a Plan with no position-changing fact is still Planned,
  // even when its confirmation Economic Time lies after the analysis cutoff.
  const hasExposureChange = input.facts.some(
    (fact) => fact.kind === "execution" || fact.kind === "position-change",
  );
  const expected: LifecycleStateName = hasExposureChange ? "Open" : "Planned";

  if (input.storedLifecycle === undefined) {
    return {
      tradeId: input.tradeId,
      sourceFactRevision: input.sourceFactRevision,
      analysisCutoff: input.analysisCutoff,
      expectedLifecycle: { outcome: "Value", value: expected },
      agreement: { status: "unavailable", expected, reason: "NoStoredLifecycle" },
      findings: [],
    };
  }

  const agreed = input.storedLifecycle === expected;
  return {
    tradeId: input.tradeId,
    sourceFactRevision: input.sourceFactRevision,
    analysisCutoff: input.analysisCutoff,
    expectedLifecycle: { outcome: "Value", value: expected },
    agreement: agreed
      ? { status: "agreed", stored: input.storedLifecycle, expected }
      : { status: "disagreement", stored: input.storedLifecycle, expected },
    findings: agreed
      ? []
      : [
          {
            kind: "LifecycleDisagreement",
            stored: input.storedLifecycle,
            expected,
            detail: `stored lifecycle ${input.storedLifecycle} disagrees with the expected ${expected}`,
          },
        ],
  };
}
