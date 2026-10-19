import type { InstrumentClass, Money, Price, Quantity } from "../values";

/**
 * The frozen Plan-fact shapes shared by Trade Record (which persists them) and Trade Analysis (which
 * assesses them). Both modules must agree on one shape, and neither may depend on the other, so the
 * shapes live in this small contract module rather than in either of them.
 *
 * The condition union is fixed by decision PD9. `UnderlyingPriceCondition` is the only kind D2
 * constructs; `StructureValueCondition` is reserved in the type and deliberately not installed until
 * D8, so it is absent rather than a fabricated `Unavailable`.
 */
export type ConditionId = string;
export type ConditionRole = "Stop" | "Target";
export type BreachDirection = "AtOrBelow" | "AtOrAbove";
export type MeasurementPolicy = "NearestNonnegativeMonetaryBoundary";

export interface ConditionBasis {
  /** The Planned Leg identities this condition measures. A condition with no legs protects nothing. */
  readonly protects: readonly string[];
  readonly direction: BreachDirection;
  readonly measurementPolicy: MeasurementPolicy;
  /** Trader-authored free text. View-only: never parsed, never matched, never a baseline input. */
  readonly comment?: string;
}

export interface StructureScope {
  readonly kind: "SingleContract" | "CoExpiringStructure";
  readonly instrumentKeys: readonly string[];
  readonly expiration?: string;
}

export type ResolvedFrom =
  | { readonly kind: "ExplicitBoundary" }
  | {
      readonly kind: "FractionOfFrozenStructuralMaximum";
      readonly fraction: string;
      readonly frozenMaximum: Money;
    };

export interface UnderlyingPriceCondition {
  readonly conditionId: ConditionId;
  readonly kind: "UnderlyingPrice";
  readonly role: ConditionRole;
  readonly boundaryPrice: Price;
  /** Frozen at confirmation. Required for Stop and Target alike (PD9 decision a). */
  readonly monetaryBoundary: Money;
  readonly basis: ConditionBasis;
}

/** Reserved by PD9, not installed before D8. Never constructed by D2. */
export interface StructureValueCondition {
  readonly conditionId: ConditionId;
  readonly kind: "StructureValue";
  readonly role: ConditionRole;
  readonly scope: StructureScope;
  readonly boundaryValue: Money;
  readonly basis: ConditionBasis;
  readonly resolvedFrom: ResolvedFrom;
}

export type PlanCondition = UnderlyingPriceCondition | StructureValueCondition;

export interface OriginalConditionSet {
  /** The frozen original management, in the trader's order. */
  readonly conditions: readonly PlanCondition[];
  /** The confirmation Economic Time at which this set was frozen. */
  readonly frozenAt: string;
}

export type LegSide = "long" | "short";

export interface InstrumentIdentity {
  readonly instrumentKey: string;
  readonly instrumentClass: InstrumentClass;
}

/** An exact contract: the one Instrument this leg names. */
export interface ExactContractTerms {
  readonly kind: "ExactContract";
  readonly expiration?: string;
  readonly strike?: Price;
}

/** Complete objective criteria, for a leg whose exact contract is not yet fixed. */
export interface ObjectiveCriteria {
  readonly kind: "ObjectiveCriteria";
  readonly underlying: string;
  readonly obligation: "Stock" | "Call" | "Put";
  readonly expiration?: string;
  readonly strike?: Price;
}

export interface PlannedLeg {
  readonly legId: string;
  readonly instrument: InstrumentIdentity;
  readonly side: LegSide;
  readonly quantity: Quantity;
  /** Exactly one of `contract` or `objectiveCriteria` must be present. */
  readonly contract?: ExactContractTerms;
  readonly objectiveCriteria?: ObjectiveCriteria;
}

/** The confirmed Plan facts. Confirmation freezes these; nothing later rewrites them. */
export interface TradePlan {
  readonly intendedEntry: Price;
  readonly plannedLegs: readonly PlannedLeg[];
  readonly originalManagement: readonly PlanCondition[];
}

/** A Strategy role: positive *relative* quantity, never a Plan quantity or a price default. */
export interface StrategyRole {
  readonly side: LegSide;
  readonly kind: "stock" | "call" | "put";
  readonly quantity: string;
}

export interface StrategyConstraint {
  readonly kind: "sameUnderlying" | "expirationOrder" | "strikeOrder" | "shareCoverage";
  readonly detail: string;
}

/** The immutable typed structural shape a Strategy identity carries. */
export interface StrategyShape {
  readonly roles: readonly StrategyRole[];
  readonly constraints: readonly StrategyConstraint[];
}

export interface PerConditionBasis {
  readonly conditionId: ConditionId;
  readonly role: ConditionRole;
  readonly kind: PlanCondition["kind"];
  readonly basis: ConditionBasis;
  readonly boundaryPrice?: Price;
  readonly monetaryBoundary?: Money;
}

/** The frozen Plan Baseline. Original Planned Risk is positive and is exactly 1R. */
export interface PlanBaseline {
  readonly originalPlannedRisk: Money;
  readonly originalPlannedReward: Money;
  /** Exact decimal string of reward divided by risk. */
  readonly plannedRewardRiskRatio: string;
  readonly oneR: Money;
  readonly perConditionBasis: readonly PerConditionBasis[];
}
