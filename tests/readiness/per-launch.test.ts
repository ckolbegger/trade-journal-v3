import { describe, expect, it } from "vitest";
import { createReadinessLedger } from "../../src/readiness/lifecycle";
import { mutablePorts, steppingClock } from "./support";

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
