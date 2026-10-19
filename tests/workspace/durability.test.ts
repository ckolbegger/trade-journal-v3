import { describe, expect, it, afterEach } from "vitest";
import { establishReadiness } from "../../src/readiness";
import { requestDurability } from "../../src/workspace/durability";
import { passingPorts } from "../support/readiness";
import { deleteDatabase } from "../../src/persistence/indexeddb/schema";
import { close, openSeam, seed } from "../support/store";
import type { StorageProtection } from "../../src/platform/host";

describe("Workspace.requestDurability reports the host's real answer and never fabricates protection", () => {
  it("should return NotImproved with currentProtection Unavailable and a reason when the host does not expose the request at all", async () => {
      const readiness = await establishReadiness(passingPorts());
      const result = await requestDurability({
        protection: async () => ({ kind: "Unavailable", reason: "no protection API" }),
        requestDurability: async () => ({ kind: "NotExposed" }),
        readiness: async () => readiness,
      });

      expect(result).toMatchObject({
        outcome: "NotImproved",
        currentProtection: {
          kind: "Unavailable",
          reason: "The host does not expose the durability request.",
        },
      });
    });

  it("should return a typed NotImproved rather than throwing when the host API rejects with a security or permission error", async () => {
      const readiness = await establishReadiness(passingPorts());
      const result = await requestDurability({
        protection: async () => ({ kind: "BestEffort", reason: "not granted" }),
        requestDurability: async () => {
          throw new DOMException("permission denied", "SecurityError");
        },
        readiness: async () => readiness,
      });

      expect(result).toMatchObject({ outcome: "NotImproved" });
      expect(result.currentProtection.kind).not.toBe("Protected");
    });
});

describe("Workspace.requestDurability reports the host's real answer and never fabricates protection", () => {
  afterEach(async () => {
    await deleteDatabase();
  });

  it("should leave Runtime Readiness unchanged: the session remains Writable with the not-protected warning visible after a NotImproved result while all four checks pass", async () => {
      const readiness = await establishReadiness(
        passingPorts({ protection: async () => ({ kind: "BestEffort", reason: "not granted" }) }),
      );
      const denied = await requestDurability({
        protection: async () => ({ kind: "BestEffort", reason: "not granted" }),
        requestDurability: async () => ({ kind: "Denied", reason: "denied" }),
        readiness: async () => readiness,
      });

      expect(readiness.outcome).toBe("Writable");
      expect(readiness.notProtectedWarning).toBe(true);
      expect(denied).toMatchObject({
        outcome: "NotImproved",
        readiness: { outcome: "Writable", notProtectedWarning: true },
      });
    });

  it("should record the protection state in the readiness evidence at each launch regardless of the request outcome", async () => {
      const readiness = await establishReadiness(
        passingPorts({ protection: async () => ({ kind: "BestEffort", reason: "not granted" }) }),
      );

      expect(readiness.evidence.protection).toEqual({ kind: "BestEffort", reason: "not granted" });
      expect(readiness.notProtectedWarning).toBe(true);
    });

  it("should delete, export and mutate nothing, proven by identical authoritative revisions before and after the call", async () => {
      const { database, seam } = await openSeam();
      await seed(seam, "workspaceMeta", { key: "workspace", value: { timeZone: "America/New_York" } });
      const fingerprint = async (): Promise<string> => {
        const snapshot = await seam.snapshot(["workspaceMeta", "referenceCatalog", "journal"]);
        return JSON.stringify({
          workspaceMeta: snapshot.rows("workspaceMeta"),
          referenceCatalog: snapshot.rows("referenceCatalog"),
          journal: snapshot.rows("journal"),
        });
      };
      const before = await fingerprint();
      const readiness = await establishReadiness(passingPorts());

      await requestDurability({
        protection: async () => ({ kind: "BestEffort", reason: "not granted" }),
        requestDurability: async () => ({ kind: "Granted" }),
        readiness: async () => readiness,
      });

      expect(await fingerprint()).toBe(before);
      await close(database);
    });
});

describe("Workspace.requestDurability reports the host's real answer and never fabricates protection", () => {
  it("should return NotImproved with currentProtection BestEffort and the host's reason when the host denies the request", async () => {
      const readiness = await establishReadiness(passingPorts());
      const result = await requestDurability({
        protection: async () => ({ kind: "BestEffort", reason: "browsers may clear this data" }),
        requestDurability: async () => ({ kind: "Denied", reason: "the host denied the request" }),
        readiness: async () => readiness,
      });

      expect(result).toMatchObject({
        outcome: "NotImproved",
        currentProtection: { kind: "BestEffort", reason: "browsers may clear this data" },
      });
    });
});

describe("Workspace.requestDurability reports the host's real answer and never fabricates protection", () => {
  it("should return Improved with currentProtection Protected when the host grants the request", async () => {
      let protection: StorageProtection = { kind: "BestEffort", reason: "not yet granted" };
      const readiness = await establishReadiness(passingPorts());
      const result = await requestDurability({
        protection: async () => protection,
        requestDurability: async () => {
          protection = { kind: "Protected" };
          return { kind: "Granted" };
        },
        readiness: async () => readiness,
      });

      expect(result).toEqual({ outcome: "Improved", currentProtection: { kind: "Protected" } });
    });

  it("should return AlreadyProtected with currentProtection Protected when protection was already granted and no new grant is required", async () => {
      let requested = false;
      const readiness = await establishReadiness(passingPorts());
      const result = await requestDurability({
        protection: async () => ({ kind: "Protected" }),
        requestDurability: async () => {
          requested = true;
          return { kind: "Granted" };
        },
        readiness: async () => readiness,
      });

      expect(result).toEqual({ outcome: "AlreadyProtected", currentProtection: { kind: "Protected" } });
      expect(requested).toBe(false);
    });
});
