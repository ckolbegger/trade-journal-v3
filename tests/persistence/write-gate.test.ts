import { describe, expect, it } from "vitest";
import {
  commitThroughGate,
  createWriteGate,
  type ReadinessDecision,
} from "../../src/persistence/indexeddb/writeGate";

const recovery: ReadinessDecision = {
  outcome: "RecoveryOnly",
  failedChecks: [{ check: "offline-release-inventory", detail: "asset /app.js is corrupt" }],
  safeActions: [{ id: "export-backup", explanation: "Export a backup before retrying." }],
};

const writable: ReadinessDecision = { outcome: "Writable", failedChecks: [] };

describe("the persistence seam refuses every write outside a Writable session and reports exactly why", () => {
  it("should reject with RuntimeNotWritable carrying the current readiness outcome and every failed check when a mutating call is made outside a Writable session", async () => {
    const gate = createWriteGate({ current: async () => recovery });
    let wrote = false;

    const result = await commitThroughGate(gate, async () => {
      wrote = true;
      return { revisions: { tradeRecord: 2 } };
    });

    expect(result).toMatchObject({
      kind: "Rejected",
      payload: {
        outcome: "RuntimeNotWritable",
        runtimeReadiness: "RecoveryOnly",
        failedChecks: recovery.failedChecks,
        workspaceStatus: "RecoveryOnly",
        safeActions: recovery.safeActions,
      },
    });
    expect(wrote).toBe(false);
  });

  it("should allow the write and return the command-specific post-commit revisions when all four readiness checks pass", async () => {
    const gate = createWriteGate({ current: async () => writable });

    const result = await commitThroughGate(gate, async () => ({ revisions: { tradeRecord: 3 } }));

    expect(result).toEqual({
      kind: "Committed",
      value: { revisions: { tradeRecord: 3 } },
      decision: writable,
    });
  });
});
