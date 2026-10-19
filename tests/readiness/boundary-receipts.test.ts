import { describe, expect, it } from "vitest";
import { commitThroughGate, createWriteGate } from "../../src/persistence/indexeddb/writeGate";
import { createReadinessLedger } from "../../src/readiness/lifecycle";
import { mutablePorts, steppingClock } from "./support";

const instants = [
  "2026-10-19T20:00:00.000Z",
  "2026-10-20T20:00:00.000Z",
  "2026-10-21T20:00:00.000Z",
  "2026-10-22T20:00:00.000Z",
];

describe("readiness is re-established at every safety boundary and a later failure invalidates the running session", () => {
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
