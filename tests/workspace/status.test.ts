import { describe, expect, it, afterEach } from "vitest";
import { getStatus } from "../../src/workspace/status";
import { statusPorts } from "./status-support";
import { deleteDatabase } from "../../src/persistence/indexeddb/schema";
import { close, openSeam, seed } from "../persistence/revision-support";
import { establishReadiness } from "../../src/readiness";
import { passingPorts } from "../readiness/support";

describe("Workspace.getStatus reports one honest lifecycle status from readiness, root state and installed capability", () => {
  it("should return Initialization Required only when a writable store was opened successfully and proved that no Workspace exists", async () => {
      const status = await getStatus(
        await statusPorts({ readWorkspace: async () => ({ outcome: "NoWorkspace" }) }),
      );

      expect(status.outcome).toBe("InitializationRequired");
      expect(status.binding).toBeUndefined();
      expect(status.timeZone).toBeUndefined();
    });
});

describe("Workspace.getStatus reports one honest lifecycle status from readiness, root state and installed capability", () => {
  it("should return Integrity Blocked with the underlying readiness evidence and safe actions when a known or possible existing root cannot be read or validated", async () => {
      const status = await getStatus(await statusPorts({ root: async () => "unreadable" }));

      expect(status).toMatchObject({ outcome: "IntegrityBlocked", readiness: { outcome: "Writable" } });
      expect(status.safetyActions.map((action) => action.id)).toEqual(["recovery-guidance", "retry"]);
    });

  it("should never treat a failed or ambiguous store read as an empty store, returning Integrity Blocked rather than Initialization Required", async () => {
      const status = await getStatus(
        await statusPorts({
          readWorkspace: async () => ({ outcome: "Unreadable", detail: "the store read threw" }),
        }),
      );

      expect(status.outcome).toBe("IntegrityBlocked");
      expect(status.outcome).not.toBe("InitializationRequired");
    });
});

describe("Workspace.getStatus reports one honest lifecycle status from readiness, root state and installed capability", () => {
  afterEach(async () => {
    await deleteDatabase();
  });

  it("should mutate and repair nothing, proven by identical store digests before and after a call that reports a disagreement", async () => {
      const { database, seam } = await openSeam();
      await seed(seam, "workspaceMeta", {
        key: "workspace",
        value: { timeZone: "America/New_York", timeZoneRevision: 2 },
      });
      await seed(seam, "lifecycleIndex", {
        tradeId: "trade-1",
        state: "Open",
        factRevision: 1,
        openedOn: "2026-10-01",
      });

      const fingerprint = async (): Promise<string> => {
        const snapshot = await seam.snapshot(["workspaceMeta", "lifecycleIndex"]);
        return JSON.stringify({
          workspaceMeta: snapshot.rows("workspaceMeta"),
          lifecycleIndex: snapshot.rows("lifecycleIndex"),
        });
      };
      const before = await fingerprint();

      const status = await getStatus(
        await statusPorts({
          readWorkspace: async () => ({
            outcome: "Unreadable",
            detail: "stored lifecycle disagrees with the effective facts",
          }),
        }),
      );

      expect(status.outcome).toBe("IntegrityBlocked");
      expect(await fingerprint()).toBe(before);

      await close(database);
    });
});

describe("Workspace.getStatus reports one honest lifecycle status from readiness, root state and installed capability", () => {
  it("should return Ready with the full-content Workspace binding, time-zone setting and revision, immutable Installed Capability Manifest, onboarding state, readiness evidence, protection state, schema versions and latest receipt when readiness is Writable", async () => {
      const status = await getStatus(
        await statusPorts({ latestReceipt: async () => ({ seed: "journal-seed-v1" }) }),
      );

      expect(status).toMatchObject({
        outcome: "Ready",
        evaluatedAt: "2026-10-19T20:30:00.000Z",
        binding: {
          revision: 7,
          factRevision: 3,
          observationRevision: 2,
          journalRevision: 4,
          referenceRevision: 5,
        },
        timeZone: "America/New_York",
        timeZoneRevision: 2,
        onboarding: "Needs Institution and Account",
        capabilityManifest: {
          releaseId: "release-1",
          installSupport: "not-claimed",
          feeApplication: "not-installed",
        },
        readiness: { outcome: "Writable" },
        protection: { kind: "Protected" },
        schemaVersion: 1,
        latestReceipt: { seed: "journal-seed-v1" },
      });
      expect(status.safetyActions).toEqual([]);
    });

  it("should accept the current observation instant from the injected Clock and return identical status for identical inputs", async () => {
      const ports = await statusPorts();

      expect(await getStatus(ports)).toEqual(await getStatus(ports));
    });
});

describe("Workspace.getStatus reports one honest lifecycle status from readiness, root state and installed capability", () => {
  it("should return Recovery Only with readable status and safe backup actions when the Workspace is readable and readiness fails", async () => {
      const failing = await establishReadiness(
        passingPorts({ capacity: async () => ({ freeBytes: 1 }) }),
      );

      const status = await getStatus(
        await statusPorts({ readiness: async () => failing, root: async () => "readable" }),
      );

      expect(status).toMatchObject({
        outcome: "RecoveryOnly",
        readiness: { outcome: "Unsupported", failedChecks: [{ check: "capacity" }] },
        timeZone: "America/New_York",
        binding: { revision: 7 },
      });
      expect(status.safetyActions.map((action) => action.id)).toContain("export-backup");
    });

  it("should return Unsupported with the failed-check reasons when no existing root needs protection", async () => {
      const failing = await establishReadiness(
        passingPorts({ capacity: async () => ({ freeBytes: 1 }) }),
      );

      const status = await getStatus(
        await statusPorts({
          readiness: async () => failing,
          root: async () => "absent",
          readWorkspace: async () => ({ outcome: "NoWorkspace" }),
        }),
      );

      expect(status.outcome).toBe("Unsupported");
      expect(status.safetyActions.map((action) => action.id)).toEqual([
        "retry",
        "try-another-browser",
      ]);
    });
});
