import { describe, expect, it } from "vitest";
import { establishReadiness } from "../../src/readiness";
import { passingPorts } from "./support";

describe("the Runtime Readiness gate decides Writable from four functional checks and reports every failure", () => {
  it("should return Unsupported listing every failed check when two or more checks fail, rather than stopping at the first failure", async () => {
    const result = await establishReadiness(
      passingPorts({
        diagnostic: async () => ({ outcome: "Failed", detail: "the store did not open" }),
        capacity: async () => ({ freeBytes: 1 }),
        workerControl: async () => ({ kind: "NotControlled", reason: "No service worker controls this page." }),
        inventory: async () => ({
          outcome: "Incomplete",
          failures: [
            { kind: "Missing", assetUrl: "/assets/app.js" },
            { kind: "Corrupt", assetUrl: "/index.html", recorded: "a".repeat(64), observed: "b".repeat(64) },
          ],
        }),
      }),
    );

    expect(result.outcome).toBe("Unsupported");
    expect(result.failedChecks.map((failure) => failure.check)).toEqual([
      "diagnostic-transaction",
      "capacity",
      "service-worker-control",
      "offline-release-inventory",
    ]);
    expect(result.checks).toHaveLength(4);
    expect(result.safeActions.map((action) => action.id)).toEqual(["retry", "try-another-browser"]);
  });
});
