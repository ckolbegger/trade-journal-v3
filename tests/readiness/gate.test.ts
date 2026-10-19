import { describe, expect, it, afterEach, vi } from "vitest";
import { establishReadiness, NOT_PROTECTED_WARNING } from "../../src/readiness";
import { passingPorts } from "./support";
import { runDiagnosticTransaction } from "../../src/persistence/indexeddb/diagnostic";
import { deleteDatabase, openDatabase, transactionDone } from "../../src/persistence/indexeddb/schema";
import { MATURE_WORKLOAD, deriveMinimum } from "../../src/capacity";

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

describe("the Runtime Readiness gate decides Writable from four functional checks and reports every failure", () => {
  afterEach(async () => {
    await deleteDatabase();
  });

  it("should return Unsupported with a safe retry action when the isolated diagnostic transaction fails, and leave no authoritative fact behind, proven by an unchanged revision binding", async () => {
      const database = await openDatabase();
      const seed = database.transaction("workspaceMeta", "readwrite");
      seed.objectStore("workspaceMeta").put({ key: "revisions", value: { tradeRecord: 4 } });
      await transactionDone(seed);

      const before = await new Promise<string>((resolve, reject) => {
        const request = database
          .transaction("workspaceMeta", "readonly")
          .objectStore("workspaceMeta")
          .getAll();
        request.onsuccess = () => resolve(JSON.stringify(request.result));
        request.onerror = () => reject(request.error);
      });

      const passed = await runDiagnosticTransaction(database);
      expect(passed).toEqual({ outcome: "Passed" });

      const after = await new Promise<string>((resolve, reject) => {
        const request = database
          .transaction("workspaceMeta", "readonly")
          .objectStore("workspaceMeta")
          .getAll();
        request.onsuccess = () => resolve(JSON.stringify(request.result));
        request.onerror = () => reject(request.error);
      });
      expect(after).toBe(before);
      expect(after).not.toContain("__readiness_probe__");
      database.close();

      const failed = await establishReadiness(
        passingPorts({ diagnostic: async () => ({ outcome: "Failed", detail: "the store did not open" }) }),
      );
      expect(failed.outcome).toBe("Unsupported");
      expect(failed.safeActions.map((action) => action.id)).toContain("retry");
    });
});

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

describe("the Runtime Readiness gate decides Writable from four functional checks and reports every failure", () => {
  function setUserAgent(userAgent: string): void {
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent },
      configurable: true,
    });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should decide from functional results only: the same failing check with a user-agent claiming a supported browser yields Unsupported, and an all-passing run with an unrecognised user-agent yields Writable", async () => {
      setUserAgent("Mozilla/5.0 (Macintosh) Chrome/156.0.0.0 Safari/537.36");
      const claimedSupportedButFailing = await establishReadiness(
        passingPorts({ capacity: async () => ({ freeBytes: 1 }) }),
      );

      setUserAgent("SomeOtherBrowser/1.0 (Unknown OS)");
      const unrecognisedButPassing = await establishReadiness(passingPorts());

      expect(claimedSupportedButFailing.outcome).toBe("Unsupported");
      expect(unrecognisedButPassing.outcome).toBe("Writable");
    });
});

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
