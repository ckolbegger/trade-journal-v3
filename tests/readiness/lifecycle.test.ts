import { describe, expect, it } from "vitest";
import { commitThroughGate, createWriteGate } from "../../src/persistence/indexeddb/writeGate";
import { createReadinessLedger } from "../../src/readiness/lifecycle";
import { mutablePorts, steppingClock } from "../support/readiness";

describe("readiness is re-established at every safety boundary and a later failure invalidates the running session", () => {
  const instants = [
    "2026-10-19T20:00:00.000Z",
    "2026-10-20T20:00:00.000Z",
    "2026-10-21T20:00:00.000Z",
    "2026-10-22T20:00:00.000Z",
  ];

  it("should re-establish readiness after application update activation and enable mutating actions only after the fresh evaluation passes", async () => {
      const { ports, state } = mutablePorts();
      const ledger = createReadinessLedger(ports, steppingClock(instants), async () => "absent");
      const gate = createWriteGate({ current: () => ledger.decision() });

      state.inventoryFails = true;
      const afterUpdate = await ledger.evaluate("update-activation");
      expect(afterUpdate.result.outcome).toBe("Unsupported");
      expect((await commitThroughGate(gate, async () => "wrote")).kind).toBe("Rejected");

      state.inventoryFails = false;
      const fresh = await ledger.evaluate("update-activation");
      expect(fresh.result.outcome).toBe("Writable");
      expect((await commitThroughGate(gate, async () => "wrote")).kind).toBe("Committed");
    });

  it("should re-establish readiness after a Restore application before the next mutation is permitted, exposing the boundary hook D21 will consume", async () => {
      const { ports } = mutablePorts();
      const ledger = createReadinessLedger(ports, steppingClock(instants), async () => "absent");

      await ledger.evaluate("launch");
      const afterRestore = await ledger.evaluate("restore");

      expect(afterRestore.boundary).toBe("restore");
      expect(afterRestore.result.outcome).toBe("Writable");
      expect((await ledger.decision()).outcome).toBe("Writable");
    });

  it("should record each boundary evaluation as a separate evidence record — launch, update activation, Restore — rather than overwriting one mutable flag", async () => {
      const { ports } = mutablePorts();
      const ledger = createReadinessLedger(ports, steppingClock(instants), async () => "absent");

      await ledger.evaluate("launch");
      await ledger.evaluate("update-activation");
      await ledger.evaluate("restore");

      expect(ledger.receipts().map((receipt) => receipt.boundary)).toEqual([
        "launch",
        "update-activation",
        "restore",
      ]);
      expect(new Set(ledger.receipts().map((receipt) => receipt.evaluatedAt)).size).toBe(3);
      expect(ledger.current()?.boundary).toBe("restore");
    });
});

describe("readiness is re-established at every safety boundary and a later failure invalidates the running session", () => {
  const instants = [
    "2026-10-19T20:00:00.000Z",
    "2026-10-19T21:00:00.000Z",
    "2026-10-19T22:00:00.000Z",
  ];

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

describe("readiness is re-established at every safety boundary and a later failure invalidates the running session", () => {
  it("should run all four checks on every launch and produce a fresh evidence record carrying a new evaluation instant from the injected Clock", async () => {
      const { ports, calls } = mutablePorts();
      const clock = steppingClock([
        "2026-10-19T20:00:00.000Z",
        "2026-10-20T20:00:00.000Z",
        "2026-10-21T20:00:00.000Z",
      ]);
      const ledger = createReadinessLedger(ports, clock, async () => "absent");

      const first = await ledger.evaluate("launch");
      const second = await ledger.evaluate("launch");

      expect(calls.diagnostic).toBe(2);
      expect(first.evaluatedAt).toBe("2026-10-19T20:00:00.000Z");
      expect(second.evaluatedAt).toBe("2026-10-20T20:00:00.000Z");
      expect(second.evaluatedAt).not.toBe(first.evaluatedAt);
      expect(first.result.checks).toHaveLength(4);
      expect(second.result.checks).toHaveLength(4);
    });
});
