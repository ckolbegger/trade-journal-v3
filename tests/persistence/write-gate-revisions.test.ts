import { describe, expect, it } from "vitest";
import { commitThroughGate, createWriteGate, type ReadinessDecision } from "../../src/persistence/indexeddb/writeGate";

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

describe("the persistence seam refuses every write outside a Writable session and reports exactly why", () => {
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
