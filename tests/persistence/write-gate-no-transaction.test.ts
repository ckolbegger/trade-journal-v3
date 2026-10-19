import { describe, expect, it } from "vitest";
import { commitThroughGate, createWriteGate, type ReadinessDecision } from "../../src/persistence/indexeddb/writeGate";

const recovery: ReadinessDecision = {
  outcome: "RecoveryOnly",
  failedChecks: [{ check: "diagnostic-transaction", detail: "the store is not writable" }],
};

describe("the persistence seam refuses every write outside a Writable session and reports exactly why", () => {
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
