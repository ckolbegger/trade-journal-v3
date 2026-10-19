import { describe, expect, it } from "vitest";
import { commitThroughGate, createWriteGate, type ReadinessDecision } from "../../src/persistence/indexeddb/writeGate";

describe("the persistence seam refuses every write outside a Writable session and reports exactly why", () => {
  it("should reject the next mutation when Writable was invalidated after an earlier successful write in the same session", async () => {
    let decision: ReadinessDecision = { outcome: "Writable", failedChecks: [] };
    const gate = createWriteGate({ current: async () => decision });

    const first = await commitThroughGate(gate, async () => "first");
    expect(first.kind).toBe("Committed");

    decision = {
      outcome: "RecoveryOnly",
      failedChecks: [{ check: "offline-release-inventory", detail: "an asset disappeared" }],
    };
    let secondRan = false;
    const second = await commitThroughGate(gate, async () => {
      secondRan = true;
      return "second";
    });

    expect(second).toMatchObject({ kind: "Rejected", payload: { runtimeReadiness: "RecoveryOnly" } });
    expect(secondRan).toBe(false);
  });
});
