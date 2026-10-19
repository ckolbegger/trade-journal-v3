import { describe, expect, it } from "vitest";
import { establishReadiness } from "../../src/readiness";
import { passingPorts } from "./support";

describe("the Runtime Readiness gate decides Writable from four functional checks and reports every failure", () => {
  it("should return Writable with all four check results recorded in evidence when the diagnostic transaction, capacity headroom, service-worker control and inventory validation all pass", async () => {
    const result = await establishReadiness(passingPorts());

    expect(result.outcome).toBe("Writable");
    expect(result.checks).toHaveLength(4);
    expect(result.checks.map((check) => check.check)).toEqual([
      "diagnostic-transaction",
      "capacity",
      "service-worker-control",
      "offline-release-inventory",
    ]);
    expect(result.checks.every((check) => check.outcome === "Passed")).toBe(true);
    expect(result.failedChecks).toEqual([]);
    expect(result.safeActions).toEqual([]);
    expect(result.notProtectedWarning).toBe(false);
    expect(result.evidence.capacity.derivedMinimumBytes).toBeGreaterThan(0);
    expect(result.evidence.inventory).toMatchObject({ outcome: "Complete" });
  });
});
