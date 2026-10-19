import { describe, expect, it } from "vitest";
import { createWriteGate, type ReadinessDecision } from "../../src/persistence/indexeddb/writeGate";

const recovery: ReadinessDecision = {
  outcome: "RecoveryOnly",
  failedChecks: [{ check: "capacity", detail: "free capacity is below the derived minimum" }],
  safeActions: [{ id: "request-durability", explanation: "Request stronger storage." }],
};

describe("the persistence seam refuses every write outside a Writable session and reports exactly why", () => {
  it("should exempt Workspace.requestDurability from the gate while still reporting protection honestly", async () => {
    const gate = createWriteGate({ current: async () => recovery });

    const gated = await gate.beforeWrite();
    expect(gated.kind).toBe("Rejected");

    // The exempt path reads the same honest readiness and still reaches the host.
    let hostReached = false;
    const durability = async (): Promise<string> => {
      const current = await gate.inspect();
      hostReached = true;
      return current.outcome;
    };

    expect(await durability()).toBe("RecoveryOnly");
    expect(hostReached).toBe(true);
  });
});
