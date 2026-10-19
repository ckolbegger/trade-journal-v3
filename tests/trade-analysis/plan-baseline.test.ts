import { describe, expect, it } from "vitest";
import { assessPlan } from "../../src/analysis/trade";
import type { PlanCondition } from "../../src/plan";
import {
  LONG_STOCK_SHAPE,
  PLAN_ECONOMIC_TIME,
  longStockPlan,
  planOfConditions,
  underlyingStop,
  underlyingTarget,
} from "../support/plans";

const assess = (plan = longStockPlan(), economicTime = PLAN_ECONOMIC_TIME) =>
  assessPlan({ strategyShape: LONG_STOCK_SHAPE, plan, economicTime });

describe("TradeAnalysis.assessPlan Plan Baseline computation, at the public assessPlan seam", () => {
  it("should return Original Planned Risk equal to the positive monetary distance from intended entry to the nearest nonnegative Stop boundary and expose that same value as 1R when the Plan has one Stop and one Target", async () => {
    const result = await assess();

    expect(result.outcome).toBe("Accepted");
    if (result.outcome !== "Accepted") return;
    expect(result.baseline.originalPlannedRisk).toEqual({
      outcome: "Value",
      value: { amount: "500", currency: "USD" },
    });
    expect(result.oneR).toEqual(result.baseline.originalPlannedRisk);
    expect(result.baseline.oneR).toEqual(result.baseline.originalPlannedRisk);
    expect(result.baseline.originalPlannedReward).toEqual({
      outcome: "Value",
      value: { amount: "1000", currency: "USD" },
    });
  });

  it("should evaluate intended entry against every original Stop and Target independently and return per-condition basis for each when the Plan has several OR alternatives, so that the headline nearest boundary never hides a farther condition", async () => {
    const result = await assess(
      planOfConditions([
        underlyingStop(),
        underlyingTarget(),
        underlyingStop({
          conditionId: "cond-stop-2",
          boundaryPrice: { amount: "170.00" },
          monetaryBoundary: { amount: "1000.00", currency: "USD" },
        }),
      ]),
    );

    expect(result.outcome).toBe("Accepted");
    if (result.outcome !== "Accepted") return;
    expect(result.baseline.perConditionBasis).toHaveLength(3);
    const ids = result.baseline.perConditionBasis.map((basis) => basis.conditionId);
    expect(ids).toEqual(["cond-stop", "cond-target", "cond-stop-2"]);
    expect(
      result.baseline.perConditionBasis.every((basis) => basis.distance.outcome === "Value"),
    ).toBe(true);
  });

  it("should select the nearest nonnegative monetary boundary as the headline Stop when two underlying-price Stops are OR alternatives at different distances, while the farther Stop remains individually visible with its own basis", async () => {
    const result = await assess(
      planOfConditions([
        underlyingStop(),
        underlyingTarget(),
        underlyingStop({
          conditionId: "cond-stop-2",
          boundaryPrice: { amount: "170.00" },
          monetaryBoundary: { amount: "1000.00", currency: "USD" },
        }),
      ]),
    );

    expect(result.outcome).toBe("Accepted");
    if (result.outcome !== "Accepted") return;
    expect(result.baseline.originalPlannedRisk).toEqual({
      outcome: "Value",
      value: { amount: "500", currency: "USD" },
    });
    const farther = result.baseline.perConditionBasis.find(
      (basis) => basis.conditionId === "cond-stop-2",
    );
    expect(farther?.distance).toEqual({
      outcome: "Value",
      value: { amount: "1000", currency: "USD" },
    });
    expect(farther?.monetaryBoundary).toEqual({ amount: "1000.00", currency: "USD" });
  });

  it("should keep a crossed Stop and an unreached Target independently visible in the returned per-condition basis rather than collapsing them into one headline number", async () => {
    const result = await assess(
      planOfConditions([
        underlyingStop(),
        underlyingTarget(),
        underlyingStop({
          conditionId: "cond-stop-crossed",
          boundaryPrice: { amount: "185.00" },
          monetaryBoundary: { amount: "500.00", currency: "USD" },
        }),
      ]),
    );

    expect(result.outcome).toBe("Accepted");
    if (result.outcome !== "Accepted") return;
    const crossed = result.baseline.perConditionBasis.find(
      (basis) => basis.conditionId === "cond-stop-crossed",
    );
    expect(crossed).toBeDefined();
    const unreached = result.baseline.perConditionBasis.find(
      (basis) => basis.conditionId === "cond-target",
    );
    expect(unreached).toBeDefined();
    expect(result.baseline.originalPlannedRisk).toEqual({
      outcome: "Value",
      value: { amount: "500", currency: "USD" },
    });
  });

  it("should reject the Plan with a typed issue and return no 1R when every original condition yields a zero or negative monetary risk, because Original Planned Risk must be positive", async () => {
    const result = await assess(
      planOfConditions([
        underlyingStop({ boundaryPrice: { amount: "180.00" } }),
        underlyingStop({
          conditionId: "cond-stop-2",
          boundaryPrice: { amount: "181.00" },
        }),
      ]),
    );

    expect(result.outcome).toBe("Rejected");
    if (result.outcome !== "Rejected") return;
    expect(result.issues.some((issue) => issue.code === "NonPositiveOriginalPlannedRisk")).toBe(
      true,
    );
  });

  it("should return the planned reward/risk ratio computed from the same frozen baseline values and re-derive an identical ratio when the Plan is assessed twice", async () => {
    const first = await assess();
    const second = await assess();

    expect(first.outcome).toBe("Accepted");
    expect(second.outcome).toBe("Accepted");
    if (first.outcome !== "Accepted" || second.outcome !== "Accepted") return;
    expect(first.baseline.plannedRewardRiskRatio).toEqual({ outcome: "Value", value: "2" });
    expect(second.baseline.plannedRewardRiskRatio).toEqual(first.baseline.plannedRewardRiskRatio);
  });

  it("should return an unavailable baseline rather than zero when a condition's basis cannot be computed from the supplied inputs", async () => {
    const unmeasurable: PlanCondition = underlyingStop({
      basis: {
        protects: ["leg-does-not-exist"],
        direction: "AtOrBelow",
        measurementPolicy: "NearestNonnegativeMonetaryBoundary",
      },
    });

    const result = await assess(planOfConditions([unmeasurable, underlyingTarget()]));

    expect(result.outcome).toBe("Accepted");
    if (result.outcome !== "Accepted") return;
    expect(result.baseline.originalPlannedRisk.outcome).toBe("Unavailable");
    expect(result.baseline.oneR.outcome).toBe("Unavailable");
    expect(result.baseline.originalPlannedRisk).not.toMatchObject({ value: { amount: "0" } });
  });

  it("should keep Original Planned Reward as an independent value when the risk side is valid, so that one unavailable component never suppresses the other", async () => {
    const result = await assess(planOfConditions([underlyingStop()]));

    expect(result.outcome).toBe("Accepted");
    if (result.outcome !== "Accepted") return;
    expect(result.baseline.originalPlannedRisk).toEqual({
      outcome: "Value",
      value: { amount: "500", currency: "USD" },
    });
    expect(result.baseline.originalPlannedReward.outcome).toBe("Unavailable");
    expect(result.baseline.plannedRewardRiskRatio.outcome).toBe("Unavailable");
    expect(result.oneR).toEqual({ outcome: "Value", value: { amount: "500", currency: "USD" } });
  });

  it("should not change the returned 1R when the assessment is repeated after the Plan was confirmed in a previous call, because confirmation time and not the strategy label freezes these values", async () => {
    const first = await assess();
    const later = await assess(longStockPlan(), "2026-11-02T21:30:00.000Z");

    expect(first.outcome).toBe("Accepted");
    expect(later.outcome).toBe("Accepted");
    if (first.outcome !== "Accepted" || later.outcome !== "Accepted") return;
    expect(later.oneR).toEqual(first.oneR);
    expect(later.semantics.frozenAt).toBe("2026-11-02T21:30:00.000Z");
    expect(first.semantics.frozenAt).toBe(PLAN_ECONOMIC_TIME);
  });
});
