import { describe, expect, it } from "vitest";
import { commitThroughGate, createWriteGate } from "../../src/persistence/indexeddb/writeGate";
import { createReadinessLedger } from "../../src/readiness/lifecycle";
import { mutablePorts, steppingClock } from "./support";

const instants = [
  "2026-10-19T20:00:00.000Z",
  "2026-10-19T21:00:00.000Z",
  "2026-10-19T22:00:00.000Z",
];

describe("readiness is re-established at every safety boundary and a later failure invalidates the running session", () => {
  it("should invalidate the current Writable state immediately when a release-integrity failure is observed during a running session", async () => {
    const { ports, state } = mutablePorts();
    const ledger = createReadinessLedger(ports, steppingClock(instants), async () => "absent");

    const launch = await ledger.evaluate("launch");
    expect(launch.result.outcome).toBe("Writable");

    state.inventoryFails = true;
    const invalidated = await ledger.invalidate();

    expect(invalidated.result.outcome).toBe("Unsupported");
    expect(ledger.current()?.result.outcome).toBe("Unsupported");
    expect(invalidated.result.failedChecks.map((failure) => failure.check)).toContain(
      "offline-release-inventory",
    );
  });

  it("should enter Recovery Only rather than Unsupported when the existing Workspace remains readable after such a failure", async () => {
    const { ports, state } = mutablePorts();
    const ledger = createReadinessLedger(ports, steppingClock(instants), async () => "readable");

    await ledger.evaluate("launch");
    state.capacityFails = true;
    await ledger.invalidate();

    const decision = await ledger.decision();
    expect(decision.outcome).toBe("RecoveryOnly");
    expect(decision.failedChecks.map((failure) => failure.check)).toContain("capacity");
  });

  it("should never reuse a previous readiness decision to authorize a later mutation, proven by a mutation rejected after the earlier verdict was Writable", async () => {
    const { ports, state } = mutablePorts();
    const ledger = createReadinessLedger(ports, steppingClock(instants), async () => "absent");
    const gate = createWriteGate({ current: () => ledger.decision() });

    expect((await commitThroughGate(gate, async () => "first")).kind).toBe("Committed");

    state.capacityFails = true;
    const second = await commitThroughGate(gate, async () => "second");

    expect(second.kind).toBe("Rejected");
    if (second.kind === "Rejected") {
      expect(second.payload.runtimeReadiness).toBe("Unsupported");
    }
  });
});
