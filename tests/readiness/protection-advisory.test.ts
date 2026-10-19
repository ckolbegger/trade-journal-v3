import { describe, expect, it } from "vitest";
import { NOT_PROTECTED_WARNING, establishReadiness } from "../../src/readiness";
import { passingPorts } from "./support";

describe("the Runtime Readiness gate decides Writable from four functional checks and reports every failure", () => {
  it("should report the storage-protection state alongside the outcome and still return Writable when protection is BestEffort or Unavailable, with the not-protected warning state set", async () => {
    for (const protection of [
      { kind: "BestEffort" as const, reason: "the host did not confirm persistent storage" },
      { kind: "Unavailable" as const, reason: "the host does not expose protection" },
    ]) {
      const result = await establishReadiness(passingPorts({ protection: async () => protection }));

      expect(result.outcome).toBe("Writable");
      expect(result.protection).toEqual(protection);
      expect(result.notProtectedWarning).toBe(true);
      expect(result.checks.every((check) => check.outcome === "Passed")).toBe(true);
    }
    expect(NOT_PROTECTED_WARNING.length).toBeGreaterThan(0);
  });
});
