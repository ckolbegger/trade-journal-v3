import { describe, expect, it } from "vitest";
import { derive } from "../../src/analysis/trade";
import type { TradeDerivationInput } from "../../src/analysis/trade";
import { PLAN_ECONOMIC_TIME } from "../support/plans";

const plannedFacts = [{ kind: "trade" }, { kind: "plan" }];

function input(overrides: Partial<TradeDerivationInput> = {}): TradeDerivationInput {
  return {
    tradeId: "trade-1",
    sourceFactRevision: 1,
    economicTime: PLAN_ECONOMIC_TIME,
    analysisCutoff: "2026-10-20T20:00:00.000Z",
    storedLifecycle: "Planned",
    facts: plannedFacts,
    ...overrides,
  };
}

describe("TradeAnalysis.derive expected Lifecycle State and agreement, at the public derive seam with a stored lifecycle binding supplied", () => {
  it("should return expected Lifecycle State Planned with agreement status agreed when the effective facts contain a confirmed Plan and no position-changing fact and the stored state is Planned", () => {
    const result = derive(input());

    expect(result.expectedLifecycle).toEqual({ outcome: "Value", value: "Planned" });
    expect(result.agreement.status).toBe("agreed");
    expect(result.findings).toEqual([]);
  });

  it("should return agreement status disagreement with the stored and expected values named when the stored state is Open but the effective facts contain no position-changing fact", () => {
    const result = derive(input({ storedLifecycle: "Open" }));

    expect(result.agreement).toMatchObject({
      status: "disagreement",
      stored: "Open",
      expected: "Planned",
    });
  });

  it("should report the disagreement as a structured integrity finding rather than raising an infrastructure error when the stored and expected states differ, so that a caller can surface it without a retry", () => {
    const result = derive(input({ storedLifecycle: "Closed" }));

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      kind: "LifecycleDisagreement",
      stored: "Closed",
      expected: "Planned",
    });
  });

  it("should not modify the supplied record, the stored lifecycle binding or any derived input when it reports a disagreement, because derive is pure and writes nothing", () => {
    const supplied = input({ storedLifecycle: "Open" });
    const snapshot = JSON.stringify(supplied);

    derive(supplied);

    expect(JSON.stringify(supplied)).toBe(snapshot);
  });

  it("should return expected Lifecycle State Planned when the Plan was confirmed with an Economic Time in the future relative to the supplied analysis cutoff, ordering by Economic Time and not by save time", () => {
    const result = derive(
      input({
        economicTime: "2026-11-30T21:00:00.000Z",
        analysisCutoff: "2026-10-20T21:00:00.000Z",
      }),
    );

    expect(result.expectedLifecycle).toEqual({ outcome: "Value", value: "Planned" });
    // The cutoff is an input to the derivation, not decoration: the result must bind it. D2's
    // confirmed unentered Plan has no competing facts, so no ordering is exercised yet; "not by save
    // time" is a property of the signature (the input carries no save time) rather than a behaviour.
    expect(result.analysisCutoff).toBe("2026-10-20T21:00:00.000Z");
  });

  it("should return the expected state as unavailable with a stable reason when the supplied facts are insufficient to decide an expected state, rather than guessing Planned", () => {
    const result = derive(input({ facts: [] }));

    expect(result.expectedLifecycle).toMatchObject({
      outcome: "Unavailable",
      reason: "InsufficientFacts",
    });
    expect(result.agreement.status).toBe("unavailable");
  });

  it("should bind the returned DerivedTradeState to the exact source FactRevision it was derived from when a staged candidate is supplied, so that a later apply can require a reconciliation for that exact candidate set", () => {
    const result = derive(input({ sourceFactRevision: 7 }));

    expect(result.sourceFactRevision).toBe(7);
    expect(result.tradeId).toBe("trade-1");
  });

  it("should report the agreement as unavailable with a stable reason, bind the supplied cutoff and raise no finding when no stored lifecycle binding is supplied at all", () => {
    const result = derive(
      input({
        storedLifecycle: undefined,
        analysisCutoff: "2026-10-20T21:00:00.000Z",
      }),
    );

    expect(result.expectedLifecycle).toEqual({ outcome: "Value", value: "Planned" });
    expect(result.agreement).toMatchObject({
      status: "unavailable",
      reason: "NoStoredLifecycle",
      expected: "Planned",
    });
    expect(result.agreement.stored).toBeUndefined();
    expect(result.findings).toEqual([]);
    expect(result.analysisCutoff).toBe("2026-10-20T21:00:00.000Z");
  });

  it("should return identical expected lifecycle and agreement values when the same record and cutoff are derived twice", () => {
    const first = derive(input());
    const second = derive(input());

    expect(second).toEqual(first);
  });
});
