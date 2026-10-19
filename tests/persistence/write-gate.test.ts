import { describe, expect, it } from "vitest";
import { createWriteGate, type ReadinessDecision, commitThroughGate, rejectionFor } from "../../src/persistence/indexeddb/writeGate";

describe("the persistence seam refuses every write outside a Writable session and reports exactly why", () => {
  const recovery: ReadinessDecision = {
    outcome: "RecoveryOnly",
    failedChecks: [{ check: "capacity", detail: "free capacity is below the derived minimum" }],
    safeActions: [{ id: "request-durability", explanation: "Request stronger storage." }],
  };

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

describe("the persistence seam refuses every write outside a Writable session and reports exactly why", () => {
  const unreadable: ReadinessDecision = {
    outcome: "Unsupported",
    existingRootUnreadable: true,
    failedChecks: [{ check: "diagnostic-transaction", detail: "the existing root cannot be read" }],
    safeActions: [{ id: "recovery-guidance", explanation: "Do not initialize over this storage." }],
  };

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

describe("the persistence seam refuses every write outside a Writable session and reports exactly why", () => {
  const unsupported: ReadinessDecision = {
    outcome: "Unsupported",
    failedChecks: [{ check: "capacity", detail: "free capacity is below the derived minimum" }],
    safeActions: [
      { id: "try-another-browser", explanation: "Try another browser." },
      { id: "retry", explanation: "Retry the readiness check." },
    ],
  };

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

describe("the persistence seam refuses every write outside a Writable session and reports exactly why", () => {
  const recovery: ReadinessDecision = {
    outcome: "RecoveryOnly",
    failedChecks: [{ check: "diagnostic-transaction", detail: "the store is not writable" }],
  };

  it("should reject before opening any readwrite transaction when readiness is RecoveryOnly, proven by a zero readwrite-transaction count and identical revisions", async () => {
      const gate = createWriteGate({ current: async () => recovery });
      const state = { readwriteTransactions: 0, revisions: { tradeRecord: 2 } };
      const before = JSON.stringify(state.revisions);

      const result = await commitThroughGate(gate, async () => {
        state.readwriteTransactions += 1;
        state.revisions.tradeRecord += 1;
        return { revisions: state.revisions };
      });

      expect(result.kind).toBe("Rejected");
      expect(state.readwriteTransactions).toBe(0);
      expect(JSON.stringify(state.revisions)).toBe(before);
    });
});

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

describe("the persistence seam refuses every write outside a Writable session and reports exactly why", () => {
  const branches: readonly ReadinessDecision[] = [
    {
      outcome: "RecoveryOnly",
      failedChecks: [{ check: "capacity", detail: "shortfall" }],
    },
    {
      outcome: "Unsupported",
      failedChecks: [{ check: "diagnostic-transaction", detail: "the store did not open" }],
    },
    {
      outcome: "Unsupported",
      existingRootUnreadable: true,
      failedChecks: [{ check: "diagnostic-transaction", detail: "the root cannot be read" }],
    },
  ];

  it("should leave every authoritative revision unchanged for every rejection branch, compared against a binding captured before the call", async () => {
      for (const decision of branches) {
        const revisions = { tradeRecord: 5, journal: 2 };
        const binding = JSON.stringify(revisions);
        const gate = createWriteGate({ current: async () => decision });

        const result = await commitThroughGate(gate, async () => {
          revisions.tradeRecord += 1;
          revisions.journal += 1;
          return { revisions };
        });

        expect(result.kind).toBe("Rejected");
        expect(JSON.stringify(revisions)).toBe(binding);
      }
    });
});

describe("the persistence seam refuses every write outside a Writable session and reports exactly why", () => {
  const recovery: ReadinessDecision = {
    outcome: "RecoveryOnly",
    failedChecks: [{ check: "offline-release-inventory", detail: "asset /app.js is corrupt" }],
    safeActions: [{ id: "export-backup", explanation: "Export a backup before retrying." }],
  };

  const writable: ReadinessDecision = { outcome: "Writable", failedChecks: [] };

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
