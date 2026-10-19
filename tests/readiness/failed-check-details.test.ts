import { describe, expect, it } from "vitest";
import { MATURE_WORKLOAD, deriveMinimum } from "../../src/capacity";
import { establishReadiness } from "../../src/readiness";
import { passingPorts } from "./support";

describe("the Runtime Readiness gate decides Writable from four functional checks and reports every failure", () => {
  it("should return Unsupported naming the derived minimum and the observed capacity when the capacity check fails", async () => {
    const minimum = deriveMinimum(MATURE_WORKLOAD).bytes;
    const result = await establishReadiness(
      passingPorts({ capacity: async () => ({ freeBytes: minimum - 500 }) }),
    );

    const capacity = result.failedChecks.find((failure) => failure.check === "capacity");
    expect(result.outcome).toBe("Unsupported");
    expect(capacity?.detail).toContain(String(minimum));
    expect(capacity?.detail).toContain(String(minimum - 500));
    expect(capacity?.detail).toContain("500");
  });

  it("should return Unsupported naming the intended release when the running release's service worker does not control the page", async () => {
    const result = await establishReadiness(
      passingPorts({
        workerControl: async () => ({
          kind: "Controlled",
          scriptURL: "/sw.js",
          releaseId: "release-2",
        }),
      }),
    );

    const worker = result.failedChecks.find((failure) => failure.check === "service-worker-control");
    expect(result.outcome).toBe("Unsupported");
    expect(worker?.detail).toContain("release-1");
    expect(worker?.detail).toContain("release-2");
  });

  it("should return Unsupported naming the missing or corrupt assets when the Offline Release Inventory check fails", async () => {
    const result = await establishReadiness(
      passingPorts({
        inventory: async () => ({
          outcome: "Incomplete",
          failures: [
            { kind: "Missing", assetUrl: "/assets/app.js" },
            { kind: "Corrupt", assetUrl: "/index.html", recorded: "a".repeat(64), observed: "b".repeat(64) },
          ],
        }),
      }),
    );

    const inventory = result.failedChecks.find(
      (failure) => failure.check === "offline-release-inventory",
    );
    expect(result.outcome).toBe("Unsupported");
    expect(inventory?.detail).toContain("missing /assets/app.js");
    expect(inventory?.detail).toContain("corrupt /index.html");
  });
});
