import type {
  PlannedLeg,
  PlanCondition,
  StrategyShape,
  TradePlan,
  UnderlyingPriceCondition,
} from "../../src/plan";

/**
 * The Long Stock shape, transcribed from `reference-catalog.md:80-83` and the Catalog seed's
 * declaration. Integration cases load the real seeded shape instead of this literal.
 */
export const LONG_STOCK_SHAPE: StrategyShape = {
  roles: [{ side: "long", kind: "stock", quantity: "1" }],
  constraints: [{ kind: "sameUnderlying", detail: "one Underlying" }],
};

export const PLAN_ECONOMIC_TIME = "2026-10-19T20:30:00.000Z";
export const PLAN_SAVE_TIME = "2026-10-19T20:31:12.000Z";

export function stockLeg(overrides: Partial<PlannedLeg> = {}): PlannedLeg {
  return {
    legId: "leg-1",
    instrument: { instrumentKey: "AAPL", instrumentClass: "stock" },
    side: "long",
    quantity: { amount: "100", instrumentClass: "stock" },
    contract: { kind: "ExactContract" },
    ...overrides,
  };
}

export function underlyingStop(
  overrides: Partial<UnderlyingPriceCondition> = {},
): UnderlyingPriceCondition {
  return {
    conditionId: "cond-stop",
    kind: "UnderlyingPrice",
    role: "Stop",
    boundaryPrice: { amount: "175.00" },
    monetaryBoundary: { amount: "500.00", currency: "USD" },
    basis: {
      protects: ["leg-1"],
      direction: "AtOrBelow",
      measurementPolicy: "NearestNonnegativeMonetaryBoundary",
      comment: "breaks below untouched demand zone",
    },
    ...overrides,
  };
}

export function underlyingTarget(
  overrides: Partial<UnderlyingPriceCondition> = {},
): UnderlyingPriceCondition {
  return {
    conditionId: "cond-target",
    kind: "UnderlyingPrice",
    role: "Target",
    boundaryPrice: { amount: "190.00" },
    monetaryBoundary: { amount: "1000.00", currency: "USD" },
    basis: {
      protects: ["leg-1"],
      direction: "AtOrAbove",
      measurementPolicy: "NearestNonnegativeMonetaryBoundary",
    },
    ...overrides,
  };
}

/** The canonical complete long stock Plan: entry 180, Stop 175, Target 190, 100 shares. */
export function longStockPlan(overrides: Partial<TradePlan> = {}): TradePlan {
  return {
    intendedEntry: { amount: "180.00" },
    plannedLegs: [stockLeg()],
    originalManagement: [underlyingStop(), underlyingTarget()],
    ...overrides,
  };
}

export function planOfConditions(
  conditions: readonly PlanCondition[],
  overrides: Partial<TradePlan> = {},
): TradePlan {
  return longStockPlan({ originalManagement: conditions, ...overrides });
}
