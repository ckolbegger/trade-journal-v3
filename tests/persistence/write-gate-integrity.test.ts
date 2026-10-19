import { describe, expect, it } from "vitest";
import { commitThroughGate, createWriteGate, type ReadinessDecision } from "../../src/persistence/indexeddb/writeGate";

const unreadable: ReadinessDecision = {
  outcome: "Unsupported",
  existingRootUnreadable: true,
  failedChecks: [{ check: "diagnostic-transaction", detail: "the existing root cannot be read" }],
  safeActions: [{ id: "recovery-guidance", explanation: "Do not initialize over this storage." }],
};

describe("the persistence seam refuses every write outside a Writable session and reports exactly why", () => {
  it("should carry workspaceStatus IntegrityBlocked with safe recovery actions when a known or possible existing root cannot be read, and must not fall through to initialization", async () => {
    const gate = createWriteGate({ current: async () => unreadable });
    let initialized = false;

    const result = await commitThroughGate(gate, async () => {
      initialized = true;
      return { initialized: true };
    });

    expect(result).toMatchObject({
      kind: "Rejected",
      payload: {
        runtimeReadiness: "Unsupported",
        workspaceStatus: "IntegrityBlocked",
        safeActions: [{ id: "recovery-guidance", explanation: "Do not initialize over this storage." }],
      },
    });
    expect(initialized).toBe(false);
  });
});
