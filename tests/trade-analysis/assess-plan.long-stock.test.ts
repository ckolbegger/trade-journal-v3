import { describe, expect, it } from "vitest";
import { assessPlan } from "../../src/analysis/trade";
import type { PlanCondition } from "../../src/plan";
import {
  LONG_STOCK_SHAPE,
  PLAN_ECONOMIC_TIME,
  longStockPlan,
  planOfConditions,
  stockLeg,
  underlyingStop,
  underlyingTarget,
} from "../support/plans";

const input = (plan = longStockPlan(), shape = LONG_STOCK_SHAPE) => ({
  strategyShape: shape,
  plan,
  economicTime: PLAN_ECONOMIC_TIME,
});

describe("TradeAnalysis.assessPlan for the Long Stock shape, at the public assessPlan seam", () => {
  it("should accept a complete long stock Plan and return normalized semantics, a positive 1R and the Planned Expiration Payoff when the one long Stock leg has a positive quantity, an exact Instrument, intended entry, one Stop with a frozen monetary loss boundary and one Target", async () => {
    const result = await assessPlan(input());

    expect(result.outcome).toBe("Accepted");
    if (result.outcome !== "Accepted") return;
    expect(result.semantics.intendedEntry).toEqual({ amount: "180" });
    expect(result.semantics.plannedLegs).toHaveLength(1);
    expect(result.semantics.originalManagement).toHaveLength(2);
    expect(result.oneR).toMatchObject({ outcome: "Value" });
    if (result.oneR.outcome !== "Value") return;
    expect(Number(result.oneR.value.amount)).toBeGreaterThan(0);
    expect(result.plannedExpirationPayoff).toBeDefined();
    expect(result.conformanceEvidence.length).toBeGreaterThan(0);
  });

  it("should reject with one typed issue per missing field and return no normalized semantics when the Plan omits the intended entry, omits every management condition and omits both the exact contract and the objective criteria", async () => {
    const result = await assessPlan(
      input(
        longStockPlan({
          intendedEntry: { amount: "" },
          plannedLegs: [stockLeg({ contract: undefined, objectiveCriteria: undefined })],
          originalManagement: [],
        }),
      ),
    );

    expect(result.outcome).toBe("Rejected");
    if (result.outcome !== "Rejected") return;
    expect(Object.keys(result)).not.toContain("semantics");
    const fields = result.issues.map((issue) => issue.field);
    expect(fields).toContain("plan.intendedEntry");
    expect(fields.some((field) => field.startsWith("plan.originalManagement"))).toBe(true);
    expect(fields.some((field) => field.startsWith("plan.plannedLegs"))).toBe(true);
  });

  it("should reject a long stock Plan with a typed issue when the supplied leg's Instrument is not a Stock instrument, so that an option leg cannot be assessed under the Long Stock shape", async () => {
    const result = await assessPlan(
      input(
        longStockPlan({
          plannedLegs: [
            stockLeg({
              instrument: { instrumentKey: "AAPL 2026-12-18 200C", instrumentClass: "option" },
            }),
          ],
        }),
      ),
    );

    expect(result.outcome).toBe("Rejected");
    if (result.outcome !== "Rejected") return;
    expect(result.issues.some((issue) => issue.code === "ShapeRoleMismatch")).toBe(true);
    expect(result.issues[0]?.legId).toBe("leg-1");
  });

  it("should reject with a typed issue naming the Stop when the Stop names underlying price but carries no frozen monetary loss boundary, because measurement would be impossible without being mislabeled as a structure-value trigger", async () => {
    const stop = {
      ...underlyingStop(),
      monetaryBoundary: { amount: "", currency: "USD" },
    } as PlanCondition;

    const result = await assessPlan(input(planOfConditions([stop, underlyingTarget()])));

    expect(result.outcome).toBe("Rejected");
    if (result.outcome !== "Rejected") return;
    const issue = result.issues.find((candidate) => candidate.code === "MissingMonetaryBoundary");
    expect(issue?.conditionId).toBe("cond-stop");
  });

  it("should accept an ordered set of two underlying-price conditions, one direction at-or-below and one at-or-above, and return normalized semantics with both conditions retained and each condition's basis preserved, so that a multi-condition Plan is expressible before any option shape exists", async () => {
    const result = await assessPlan(
      input(
        planOfConditions([
          underlyingStop(),
          underlyingTarget(),
          underlyingStop({
            conditionId: "cond-stop-2",
            boundaryPrice: { amount: "170.00" },
            monetaryBoundary: { amount: "1000.00", currency: "USD" },
          }),
        ]),
      ),
    );

    expect(result.outcome).toBe("Accepted");
    if (result.outcome !== "Accepted") return;
    expect(result.semantics.originalManagement).toHaveLength(3);
    const directions = result.semantics.originalManagement.map((condition) => condition.basis.direction);
    expect(directions).toEqual(["AtOrBelow", "AtOrAbove", "AtOrBelow"]);
    expect(result.semantics.originalManagement[0]?.basis.comment).toBe(
      "breaks below untouched demand zone",
    );
  });

  it("should reject with a typed not-installed issue naming the condition when a StructureValueCondition is supplied at D2, because that kind is reserved in the type and absent from the installed capability rather than a fabricated Unavailable", async () => {
    const structure = {
      conditionId: "cond-structure",
      kind: "StructureValue",
      role: "Target",
      scope: { kind: "SingleContract", instrumentKeys: ["AAPL"] },
      boundaryValue: { amount: "250.00", currency: "USD" },
      basis: {
        protects: ["leg-1"],
        direction: "AtOrAbove",
        measurementPolicy: "NearestNonnegativeMonetaryBoundary",
      },
      resolvedFrom: { kind: "ExplicitBoundary" },
    } as PlanCondition;

    const result = await assessPlan(
      input(planOfConditions([underlyingStop(), structure])),
    );

    expect(result.outcome).toBe("Rejected");
    if (result.outcome !== "Rejected") return;
    const issue = result.issues.find((candidate) => candidate.code === "StructureValueNotInstalled");
    expect(issue?.conditionId).toBe("cond-structure");
  });

  it("should reject with a typed issue naming the condition when an underlying-price Stop sits at or above the intended entry of a long leg, so that a non-positive Original Planned Risk is named against the offending condition rather than reported as a generic incoherence", async () => {
    const result = await assessPlan(
      input(
        planOfConditions([
          underlyingStop({ boundaryPrice: { amount: "180.00" } }),
          underlyingTarget(),
        ]),
      ),
    );

    expect(result.outcome).toBe("Rejected");
    if (result.outcome !== "Rejected") return;
    const issue = result.issues.find(
      (candidate) => candidate.code === "NonPositiveOriginalPlannedRisk",
    );
    expect(issue?.conditionId).toBe("cond-stop");
  });

  it("should reject with a typed issue naming the condition when a condition omits its breach direction or the Planned Leg set it protects, because a condition's basis is required and only its comment is optional", async () => {
    const noDirection = {
      ...underlyingStop(),
      basis: { protects: ["leg-1"], measurementPolicy: "NearestNonnegativeMonetaryBoundary" },
    } as unknown as PlanCondition;
    const noProtects = {
      ...underlyingTarget(),
      basis: {
        direction: "AtOrAbove",
        measurementPolicy: "NearestNonnegativeMonetaryBoundary",
      },
    } as unknown as PlanCondition;

    const missing = await assessPlan(
      input(planOfConditions([noDirection, underlyingTarget()])),
    );
    expect(missing.outcome).toBe("Rejected");
    if (missing.outcome === "Rejected") {
      expect(missing.issues.some((issue) => issue.code === "IncompleteConditionBasis")).toBe(true);
    }

    const unprotected = await assessPlan(input(planOfConditions([underlyingStop(), noProtects])));
    expect(unprotected.outcome).toBe("Rejected");
    if (unprotected.outcome === "Rejected") {
      expect(unprotected.issues.some((issue) => issue.code === "IncompleteConditionBasis")).toBe(
        true,
      );
    }
  });

  it("should reject with a typed issue when the Plan has no management condition at all, so that a Plan without any Stop or Target never reaches a baseline", async () => {
    const result = await assessPlan(input(planOfConditions([])));

    expect(result.outcome).toBe("Rejected");
    if (result.outcome !== "Rejected") return;
    expect(result.issues.some((issue) => issue.code === "NoManagementCoverage")).toBe(true);
  });

  it("should return the Planned Expiration Payoff as an unavailable calculation state, not as a number, when a required input for that payoff is absent, while still returning valid normalized semantics and 1R", async () => {
    const result = await assessPlan(input());

    expect(result.outcome).toBe("Accepted");
    if (result.outcome !== "Accepted") return;
    expect(result.plannedExpirationPayoff.outcome).toBe("Unavailable");
    expect(result.oneR).toMatchObject({ outcome: "Value" });
  });

  it("should return an identical normalized semantics value when the same Plan is assessed twice with the same Strategy shape, because the operation is pure and deterministic", async () => {
    const first = await assessPlan(input());
    const second = await assessPlan(input());

    expect(first.outcome).toBe("Accepted");
    expect(second.outcome).toBe("Accepted");
    if (first.outcome !== "Accepted" || second.outcome !== "Accepted") return;
    expect(second.semantics).toEqual(first.semantics);
  });

  it("should report the Long Stock shape's role and quantity constraint as the reason when the Plan supplies two Stock legs", async () => {
    const result = await assessPlan(
      input(
        longStockPlan({
          plannedLegs: [
            stockLeg(),
            stockLeg({
              legId: "leg-2",
              instrument: { instrumentKey: "MSFT", instrumentClass: "stock" },
            }),
          ],
        }),
      ),
    );

    expect(result.outcome).toBe("Rejected");
    if (result.outcome !== "Rejected") return;
    const issue = result.issues.find((candidate) => candidate.code === "ShapeRoleCount");
    expect(issue?.detail).toContain("long");
    expect(issue?.detail).toContain("stock");
  });
});
