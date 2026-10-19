import { describe, expect, it } from "vitest";
import { rejectionFor, type ReadinessDecision } from "../../src/persistence/indexeddb/writeGate";

const unsupported: ReadinessDecision = {
  outcome: "Unsupported",
  failedChecks: [{ check: "capacity", detail: "free capacity is below the derived minimum" }],
  safeActions: [
    { id: "try-another-browser", explanation: "Try another browser." },
    { id: "retry", explanation: "Retry the readiness check." },
  ],
};

describe("the persistence seam refuses every write outside a Writable session and reports exactly why", () => {
  it("should carry runtimeReadiness Unsupported and workspaceStatus None with safe retry actions when no readable Workspace root exists", () => {
    const payload = rejectionFor(unsupported);

    expect(payload.runtimeReadiness).toBe("Unsupported");
    expect(payload.workspaceStatus).toBe("None");
    expect(payload.safeActions.map((action) => action.id)).toEqual([
      "retry",
      "try-another-browser",
    ]);
  });
});
