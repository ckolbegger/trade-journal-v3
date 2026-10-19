import type { CalculationAvailability } from "../../results";
import type {
  ConditionBasis,
  PlanBaseline,
  PlanCondition,
  PlannedLeg,
  StrategyRole,
  StrategyShape,
  TradePlan,
  UnderlyingPriceCondition,
} from "../../plan";
import {
  addMoney,
  type ValueResult,
  compareMoney,
  money,
  moneyRatio,
  positionValue,
  price,
  quantity as exactQuantity,
  subtractPrice,
  type Currency,
  type Money,
  type Price,
} from "../../values";

/**
 * Trade Analysis: the pure, deterministic authority for interpreting one Trade's supplied economic
 * facts. D2 implements `assessPlan` for the Long Stock shape and `derive` for expected Lifecycle
 * State and agreement; the remaining operations are absent until their owning deliverable.
 *
 * Every input is explicit and every output is inert. This module owns no facts, clock, calendar,
 * storage, Marks, reference labels or UI formatting.
 */

export interface PlanAssessmentInput {
  readonly strategyShape: StrategyShape;
  readonly plan: TradePlan;
  readonly economicTime: string;
}

export interface NormalizedPlanSemantics {
  readonly intendedEntry: Price;
  readonly plannedLegs: readonly PlannedLeg[];
  readonly originalManagement: readonly PlanCondition[];
  readonly frozenAt: string;
}

export type PlanIssueCode =
  | "ShapeRoleCount"
  | "ShapeRoleMismatch"
  | "MissingIntendedEntry"
  | "MissingContractEvidence"
  | "AmbiguousContractEvidence"
  | "NonPositiveQuantity"
  | "NoManagementCoverage"
  | "IncompleteConditionBasis"
  | "MissingMonetaryBoundary"
  | "NonPositiveOriginalPlannedRisk"
  | "StructureValueNotInstalled"
  | "UnavailableBaseline";

export interface PlanIssue {
  readonly code: PlanIssueCode;
  readonly field: string;
  readonly detail: string;
  readonly legId?: string;
  readonly conditionId?: string;
}

/** Per-condition basis the frozen Plan Baseline carries (`trade-analysis.md:57`). */
export interface ConditionBasisAssessment {
  readonly conditionId: string;
  readonly role: PlanCondition["role"];
  readonly kind: PlanCondition["kind"];
  readonly basis: ConditionBasis;
  readonly boundaryPrice?: Price;
  readonly monetaryBoundary?: Money;
  readonly distance: CalculationAvailability<Money>;
  /** Independent OR status: a crossed Stop or reached Target never hides the others. */
  readonly status: "Unbreached" | "Crossed" | "Reached";
}

export interface PlannedExpirationPayoff {
  readonly kind: "PlannedExpirationPayoff";
  readonly anchorExpiration: string;
}

/**
 * The Plan Baseline as assessed: the stored baseline plus the independent per-condition detail and
 * the headline boundaries the policy selected.
 */
export interface AssessedBaseline {
  readonly originalPlannedRisk: CalculationAvailability<Money>;
  readonly originalPlannedReward: CalculationAvailability<Money>;
  readonly plannedRewardRiskRatio: CalculationAvailability<string>;
  readonly oneR: CalculationAvailability<Money>;
  readonly perConditionBasis: readonly ConditionBasisAssessment[];
  readonly headlineStop?: ConditionBasisAssessment;
  readonly headlineTarget?: ConditionBasisAssessment;
}

export type PlanAssessment =
  | {
      readonly outcome: "Accepted";
      readonly semantics: NormalizedPlanSemantics;
      readonly oneR: CalculationAvailability<Money>;
      readonly baseline: AssessedBaseline;
      readonly plannedExpirationPayoff: CalculationAvailability<PlannedExpirationPayoff>;
      readonly conformanceEvidence: readonly string[];
    }
  | { readonly outcome: "Rejected"; readonly issues: readonly PlanIssue[] };

export const DEFAULT_CURRENCY: Currency = "USD";

function legKind(leg: PlannedLeg): "stock" | "call" | "put" {
  const obligation = leg.objectiveCriteria?.obligation;
  if (obligation === "Call") return "call";
  if (obligation === "Put") return "put";
  return leg.instrument.instrumentClass === "option" ? "put" : "stock";
}

function roleSummary(roles: readonly StrategyRole[]): string {
  return roles.map((role) => `${role.side} ${role.kind}`).join(" and ");
}

function positiveDecimal(amount: string): boolean {
  const value = Number(amount);
  return Number.isFinite(value) && value > 0;
}

function unavailable<T>(reason: string, details: Readonly<Record<string, unknown>>): CalculationAvailability<T> {
  return { outcome: "Unavailable", reason, details };
}

/** A failed exact-arithmetic step is an honest `Unavailable`, never a coerced number. */
function fromValue<T>(result: ValueResult<T>, reason: string): CalculationAvailability<T> {
  return result.ok
    ? { outcome: "Value", value: result.value }
    : unavailable<T>(reason, { detail: result.error.kind });
}

function normalizedLeg(leg: PlannedLeg): PlannedLeg {
  const normalizedQuantity = exactQuantity({
    amount: leg.quantity.amount,
    instrumentClass: leg.quantity.instrumentClass,
  });
  const normalizedStrike =
    leg.contract?.strike === undefined ? undefined : price({ amount: leg.contract.strike.amount });
  const criteriaStrike =
    leg.objectiveCriteria?.strike === undefined
      ? undefined
      : price({ amount: leg.objectiveCriteria.strike.amount });
  return {
    ...leg,
    quantity: normalizedQuantity.ok ? normalizedQuantity.value : leg.quantity,
    ...(leg.contract === undefined
      ? {}
      : {
          contract: {
            ...leg.contract,
            ...(normalizedStrike?.ok === true ? { strike: normalizedStrike.value } : {}),
          },
        }),
    ...(leg.objectiveCriteria === undefined
      ? {}
      : {
          objectiveCriteria: {
            ...leg.objectiveCriteria,
            ...(criteriaStrike?.ok === true ? { strike: criteriaStrike.value } : {}),
          },
        }),
  };
}

function normalizedCondition(condition: PlanCondition): PlanCondition {
  if (condition.kind !== "UnderlyingPrice") return condition;
  const boundaryPrice = price({ amount: condition.boundaryPrice.amount });
  const monetaryBoundary = money({
    amount: condition.monetaryBoundary.amount,
    currency: condition.monetaryBoundary.currency,
  });
  return {
    ...condition,
    boundaryPrice: boundaryPrice.ok ? boundaryPrice.value : condition.boundaryPrice,
    monetaryBoundary: monetaryBoundary.ok ? monetaryBoundary.value : condition.monetaryBoundary,
  };
}

interface ConditionMeasurement {
  readonly condition: UnderlyingPriceCondition;
  readonly distance: CalculationAvailability<Money>;
  readonly status: "Unbreached" | "Crossed" | "Reached";
}

/** The dollar distance from intended entry to one condition, over the legs it protects. */
function measure(
  condition: UnderlyingPriceCondition,
  entry: Price,
  legs: readonly PlannedLeg[],
): ConditionMeasurement {
  const protectedLegs = legs.filter((leg) => condition.basis.protects.includes(leg.legId));
  if (protectedLegs.length === 0) {
    return {
      condition,
      distance: unavailable("ProtectedLegsNotSupplied", { protects: condition.basis.protects }),
      status: "Unbreached",
    };
  }

  const empty = money({ amount: "0", currency: defaultCurrencyOf(condition) });
  if (!empty.ok) {
    return { condition, distance: fromValue(empty, "MoneyNotExact"), status: "Unbreached" };
  }
  let running = empty.value;

  for (const leg of protectedLegs) {
    // The signed distance runs from the entry to the boundary in the position's own favour:
    // down to a Stop, up to a Target for a long position, and the reverse for a short one.
    const directional = subtractPrice(
      condition.role === "Stop" ? entry : condition.boundaryPrice,
      condition.role === "Stop" ? condition.boundaryPrice : entry,
    );
    if (!directional.ok) {
      return { condition, distance: fromValue(directional, "PriceNotExact"), status: "Unbreached" };
    }
    const valued = positionValue(leg.quantity, directional.value, running.currency);
    if (!valued.ok) {
      return { condition, distance: fromValue(valued, "QuantityNotExact"), status: "Unbreached" };
    }
    const signed =
      leg.side === "long"
        ? valued.value
        : {
            amount: valued.value.amount.startsWith("-")
              ? valued.value.amount.slice(1)
              : `-${valued.value.amount}`,
            currency: valued.value.currency,
          };
    const summed = addMoney(running, signed);
    if (!summed.ok) {
      return { condition, distance: fromValue(summed, "CurrencyMismatch"), status: "Unbreached" };
    }
    running = summed.value;
  }

  const positive = !running.amount.startsWith("-") && Number(running.amount) > 0;
  const status: ConditionMeasurement["status"] =
    condition.role === "Stop"
      ? positive
        ? "Unbreached"
        : "Crossed"
      : positive
        ? "Unbreached"
        : "Reached";
  return { condition, distance: { outcome: "Value", value: running }, status };
}

function defaultCurrencyOf(condition: UnderlyingPriceCondition): Currency {
  return condition.monetaryBoundary.currency;
}

function headline(
  measurements: readonly ConditionMeasurement[],
): ConditionMeasurement | undefined {
  const valued = measurements.filter(
    (measurement): measurement is ConditionMeasurement & {
      distance: { outcome: "Value"; value: Money };
    } => measurement.distance.outcome === "Value" && Number(measurement.distance.value.amount) > 0,
  );
  let nearest: ConditionMeasurement | undefined;
  for (const candidate of valued) {
    if (
      nearest === undefined ||
      (nearest.distance.outcome === "Value" &&
        (compareMoney(candidate.distance.value, nearest.distance.value).ok === true &&
          (compareMoney(candidate.distance.value, nearest.distance.value) as { value: number })
            .value < 0))
    ) {
      nearest = candidate;
    }
  }
  return nearest;
}

function conditionBasis(measurement: ConditionMeasurement): ConditionBasisAssessment {
  const { condition } = measurement;
  return {
    conditionId: condition.conditionId,
    role: condition.role,
    kind: condition.kind,
    basis: condition.basis,
    boundaryPrice: condition.boundaryPrice,
    monetaryBoundary: condition.monetaryBoundary,
    distance: measurement.distance,
    status: measurement.status,
  };
}

/**
 * `assessPlan` for the Long Stock shape: leg coherence, exact contract or complete objective
 * criteria, management coverage, the PD9 condition union, and a calculable positive Plan Baseline.
 * Rejection identifies every missing or incoherent field and writes nothing.
 */
export async function assessPlan(input: PlanAssessmentInput): Promise<PlanAssessment> {
  const { strategyShape, plan, economicTime } = input;
  const issues: PlanIssue[] = [];
  const roles = strategyShape.roles;
  const legs = plan.plannedLegs;

  if (legs.length !== roles.length) {
    issues.push({
      code: "ShapeRoleCount",
      field: "plan.plannedLegs",
      detail: `the shape requires ${roleSummary(roles)}, i.e. ${roles.length} leg(s); the Plan supplies ${legs.length}`,
    });
  }

  legs.forEach((leg, index) => {
    const field = `plan.plannedLegs[${index}]`;
    const role = roles[index];
    const kind = legKind(leg);
    if (role !== undefined) {
      if (role.kind === "stock" && leg.instrument.instrumentClass !== "stock") {
        issues.push({
          code: "ShapeRoleMismatch",
          field,
          detail: `the shape's role ${index} is ${role.side} ${role.kind}; this leg is a non-Stock instrument`,
          legId: leg.legId,
        });
      } else if (role.side !== leg.side || role.kind !== kind) {
        issues.push({
          code: "ShapeRoleMismatch",
          field,
          detail: `the shape's role ${index} is ${role.side} ${role.kind}; this leg is ${leg.side} ${kind}`,
          legId: leg.legId,
        });
      }
    }
    if (!positiveDecimal(leg.quantity.amount)) {
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
  });

  if (!positiveDecimal(plan.intendedEntry.amount)) {
    issues.push({
      code: "MissingIntendedEntry",
      field: "plan.intendedEntry",
      detail: "a completed Plan needs an intended entry",
    });
  }

  if (plan.originalManagement.length === 0) {
    issues.push({
      code: "NoManagementCoverage",
      field: "plan.originalManagement",
      detail: "a Plan needs at least one original Stop or Target",
    });
  }

  plan.originalManagement.forEach((condition, index) => {
    const field = `plan.originalManagement[${index}]`;
    if (condition.kind !== "UnderlyingPrice") {
      issues.push({
        code: "StructureValueNotInstalled",
        field,
        detail:
          "a structure-value condition is reserved in the type and not installed before D8",
        conditionId: condition.conditionId,
      });
      return;
    }
    const basis = condition.basis;
    if (
      basis === undefined ||
      basis.direction === undefined ||
      basis.protects === undefined ||
      basis.protects.length === 0
    ) {
      issues.push({
        code: "IncompleteConditionBasis",
        field: `${field}.basis`,
        detail: "a condition needs a breach direction and the Planned Legs it protects",
        conditionId: condition.conditionId,
      });
    }
    if (condition.monetaryBoundary === undefined || condition.monetaryBoundary.amount === "") {
      issues.push({
        code: "MissingMonetaryBoundary",
        field: `${field}.monetaryBoundary`,
        detail:
          "an underlying-price condition needs a frozen monetary boundary; without it neither risk nor reward is computable",
        conditionId: condition.conditionId,
      });
    }
  });

  if (issues.length > 0) return { outcome: "Rejected", issues };

  const normalizedEntry = price({ amount: plan.intendedEntry.amount });
  const entry: Price = normalizedEntry.ok ? normalizedEntry.value : plan.intendedEntry;
  const underlyingConditions = plan.originalManagement.filter(
    (condition): condition is UnderlyingPriceCondition =>
      condition.kind === "UnderlyingPrice",
  );

  const measurements = underlyingConditions.map((condition) => measure(condition, entry, legs));
  const stops = measurements.filter((measurement) => measurement.condition.role === "Stop");
  const targets = measurements.filter((measurement) => measurement.condition.role === "Target");
  const headlineStop = headline(stops);
  const headlineTarget = headline(targets);

  // A Stop whose distance cannot be computed makes the baseline *unavailable*, never zero. Only a
  // Stop set that is wholly computable and wholly non-positive is a rejection.
  const computedStops = stops.filter((measurement) => measurement.distance.outcome === "Value");
  const allStopsComputed = computedStops.length === stops.length;
  if (stops.length > 0 && headlineStop === undefined && allStopsComputed) {
    const offending = [...computedStops].sort((left, right) => {
      if (left.distance.outcome !== "Value" || right.distance.outcome !== "Value") return 0;
      const compared = compareMoney(left.distance.value, right.distance.value);
      return compared.ok ? compared.value : 0;
    })[0];
    return {
      outcome: "Rejected",
      issues: [
        {
          code: "NonPositiveOriginalPlannedRisk",
          field: `plan.originalManagement`,
          detail:
            "every original Stop is at or beyond the intended entry, so Original Planned Risk is not positive",
          ...(offending === undefined ? {} : { conditionId: offending.condition.conditionId }),
        },
      ],
    };
  }

  const risk: CalculationAvailability<Money> =
    headlineStop === undefined
      ? unavailable("StopBoundaryNotComputable", {
          detail:
            stops.length === 0 ? "the Plan declares no original Stop" : "no Stop distance is computable",
        })
      : headlineStop.distance;
  const reward: CalculationAvailability<Money> =
    headlineTarget === undefined
      ? unavailable("TargetBoundaryNotComputable", {
          detail:
            targets.length === 0
              ? "the Plan declares no original Target"
              : "no Target distance is computable",
        })
      : headlineTarget.distance;
  const ratio: CalculationAvailability<string> =
    risk.outcome === "Value" && reward.outcome === "Value"
      ? (() => {
          const computed = moneyRatio(reward.value, risk.value);
          return computed.ok
            ? { outcome: "Value" as const, value: computed.value }
            : unavailable<string>("RatioNotComputable", { detail: computed.error.kind });
        })()
      : unavailable<string>("BaselineIncomplete", {
          risk: risk.outcome,
          reward: reward.outcome,
        });

  const baseline: AssessedBaseline = {
    originalPlannedRisk: risk,
    originalPlannedReward: reward,
    plannedRewardRiskRatio: ratio,
    oneR: risk,
    perConditionBasis: measurements.map(conditionBasis),
    ...(headlineStop === undefined ? {} : { headlineStop: conditionBasis(headlineStop) }),
    ...(headlineTarget === undefined ? {} : { headlineTarget: conditionBasis(headlineTarget) }),
  };

  const semantics: NormalizedPlanSemantics = {
    intendedEntry: entry,
    plannedLegs: legs.map(normalizedLeg),
    originalManagement: plan.originalManagement.map((condition) => normalizedCondition(condition)),
    frozenAt: economicTime,
  };

  return {
    outcome: "Accepted",
    semantics,
    oneR: risk,
    baseline,
    plannedExpirationPayoff: unavailable<PlannedExpirationPayoff>(
      "PlannedPayoffRequiresOptionExpirationAnchor",
      { note: "stock-only exposure has no option expiration anchor" },
    ),
    conformanceEvidence: [
      "planned-leg-terms",
      "exact-instrument-or-objective-criteria",
      "management-coverage",
    ],
  };
}

/**
 * The frozen Plan Baseline the Trade Record stores: the accepted assessed values with no availability
 * branch left, or undefined when any required component is unavailable. A Plan with no positive
 * numeric 1R is a typed rejection at the coordinator, never a stored approximation.
 */
export function frozenBaseline(assessment: Extract<PlanAssessment, { outcome: "Accepted" }>): PlanBaseline | undefined {
  const { originalPlannedRisk, originalPlannedReward, plannedRewardRiskRatio, oneR } =
    assessment.baseline;
  if (
    originalPlannedRisk.outcome !== "Value" ||
    originalPlannedReward.outcome !== "Value" ||
    plannedRewardRiskRatio.outcome !== "Value" ||
    oneR.outcome !== "Value"
  ) {
    return undefined;
  }
  return {
    originalPlannedRisk: originalPlannedRisk.value,
    originalPlannedReward: originalPlannedReward.value,
    plannedRewardRiskRatio: plannedRewardRiskRatio.value,
    oneR: oneR.value,
    perConditionBasis: assessment.baseline.perConditionBasis.map((basis) => ({
      conditionId: basis.conditionId,
      role: basis.role,
      kind: basis.kind,
      basis: basis.basis,
      ...(basis.boundaryPrice === undefined ? {} : { boundaryPrice: basis.boundaryPrice }),
      ...(basis.monetaryBoundary === undefined ? {} : { monetaryBoundary: basis.monetaryBoundary }),
    })),
  };
}

export {
  derive,
  type DerivedTradeState,
  type LifecycleAgreement,
  type TradeDerivationInput,
} from "./derive";
