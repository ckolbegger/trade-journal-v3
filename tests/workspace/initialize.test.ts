import { describe, expect, it } from "vitest";
import { initialize } from "../../src/workspace";
import { closeWorkspace, rowsOf, workspaceFixture } from "./support";
import { establishReadiness } from "../../src/readiness";
import { passingPorts } from "../readiness/support";

describe("Workspace.initialize creates one initialized Workspace or refuses with a typed non-writable result", () => {
  it("should open the existing Workspace rather than reseeding or duplicating identities when called a second time against an initialized store", async () => {
      const { database, seam, ports } = await workspaceFixture();
      const first = await initialize(ports, {
        openingInstant: "2026-10-20T14:00:00.000Z",
        timeZone: "America/New_York",
      });
      expect(first.outcome).toBe("Opened");
      const journalBefore = JSON.stringify(await rowsOf(seam, "journal"));
      const catalogBefore = JSON.stringify(await rowsOf(seam, "referenceCatalog"));

      const second = await initialize(ports, {
        openingInstant: "2026-10-21T14:00:00.000Z",
        timeZone: "America/New_York",
      });

      expect(second.outcome).toBe("Opened");
      if (second.outcome === "Opened") {
        expect(second.receipt.fresh).toBe(false);
        expect(second.receipt.seedAdditions).toEqual([]);
        expect(second.receipt.timeZone).toBe("America/New_York");
        expect(second.onboarding).toBe("Needs Institution and Account");
      }
      expect(JSON.stringify(await rowsOf(seam, "journal"))).toBe(journalBefore);
      expect(JSON.stringify(await rowsOf(seam, "referenceCatalog"))).toBe(catalogBefore);

      await closeWorkspace(database);
    });
});

describe("Workspace.initialize creates one initialized Workspace or refuses with a typed non-writable result", () => {
  it("should create Workspace metadata and atomically seed the declared Journal and Catalog defaults, returning Opened with a receipt naming readiness evidence, schema transitions, seed versions and additions when readiness is Writable and no Workspace exists", async () => {
      const { database, seam, ports } = await workspaceFixture();

      const result = await initialize(ports, {
        openingInstant: "2026-10-20T14:00:00.000Z",
        timeZone: "America/New_York",
      });

      expect(result.outcome).toBe("Opened");
      if (result.outcome === "Opened") {
        expect(result.onboarding).toBe("Needs Institution and Account");
        expect(result.receipt).toMatchObject({
          fresh: true,
          seedVersions: { journal: "journal-seed-v1", catalog: "catalog-seed-v1" },
          seedAdditions: ["entryType.plan-reflection", "source.plan-confirmation", "strategy.long-stock"],
          schemaTransitions: [],
          migrations: [],
          privateRebuilds: [],
          incompleteTransactionRecovery: false,
          timeZone: "America/New_York",
          openingSession: { tradingDate: "2026-10-19", revision: "us-session-2026.1" },
          readiness: { outcome: "Writable" },
        });
      }
      expect(seam.counters.readwriteTransactions).toBe(1);
      expect(await rowsOf(seam, "journal")).toHaveLength(2);
      expect(await rowsOf(seam, "referenceCatalog")).toHaveLength(1);
      const workspace = (await rowsOf(seam, "workspaceMeta")).find((row) => row.key === "workspace");
      expect(workspace?.value).toMatchObject({
        timeZone: "America/New_York",
        openingSession: { tradingDate: "2026-10-19", revision: "us-session-2026.1" },
      });

      await closeWorkspace(database);
    });
});

describe("Workspace.initialize creates one initialized Workspace or refuses with a typed non-writable result", () => {
  it("should carry Integrity Blocked and never fall through to fresh initialization when a known or possible existing root cannot be read", async () => {
      const { database, seam, ports } = await workspaceFixture({ root: async () => "unreadable" });

      const result = await initialize(ports, {
        openingInstant: "2026-10-20T14:00:00.000Z",
        timeZone: "America/New_York",
      });

      expect(result).toMatchObject({ outcome: "IntegrityBlocked" });
      if (result.outcome === "IntegrityBlocked") {
        expect(result.recoveryActions.map((action) => action.id)).toEqual([
          "recovery-guidance",
          "retry",
        ]);
      }
      expect(await rowsOf(seam, "workspaceMeta")).toEqual([]);

      await closeWorkspace(database);
    });

  it("should return Integrity Blocked with recovery actions when readiness passed but stored contents fail integrity validation", async () => {
      const { database, seam, ports } = await workspaceFixture({
        validateStoredContents: async () => "stored contents do not agree with their facts",
      });

      const result = await initialize(ports, {
        openingInstant: "2026-10-20T14:00:00.000Z",
        timeZone: "America/New_York",
      });

      expect(result).toMatchObject({
        outcome: "IntegrityBlocked",
        detail: "stored contents do not agree with their facts",
      });
      expect(await rowsOf(seam, "workspaceMeta")).toEqual([]);

      await closeWorkspace(database);
    });
});

describe("Workspace.initialize creates one initialized Workspace or refuses with a typed non-writable result", () => {
  it("should return Migration Blocked with unchanged-data evidence when a supported older version fails candidate validation, leaving the prior Workspace untouched", async () => {
      const { database, seam, ports } = await workspaceFixture({
        migrate: async () => ({
          outcome: "MigrationBlocked",
          reason: "ValidationFailed",
          detail: "the journal section is incoherent",
          activeDatabaseName: "trade-journal",
        }),
      });

      const result = await initialize(ports, {
        openingInstant: "2026-10-20T14:00:00.000Z",
        timeZone: "America/New_York",
      });

      expect(result).toMatchObject({
        outcome: "MigrationBlocked",
        evidence: { priorDataUnchanged: true, detail: "the journal section is incoherent" },
      });
      expect(await rowsOf(seam, "workspaceMeta")).toEqual([]);

      await closeWorkspace(database);
    });
});

describe("Workspace.initialize creates one initialized Workspace or refuses with a typed non-writable result", () => {
  it("should carry Recovery Only with readable status and backup safe actions when a readable root exists but a check failed, and Unsupported with every failed check and safe retry actions when no readable root exists", async () => {
      const failing = await establishReadiness(passingPorts({ capacity: async () => ({ freeBytes: 1 }) }));

      const readable = await workspaceFixture({ readiness: async () => failing, root: async () => "readable" });
      const recovery = await initialize(readable.ports, {
        openingInstant: "2026-10-20T14:00:00.000Z",
        timeZone: "America/New_York",
      });
      expect(recovery).toMatchObject({
        outcome: "RuntimeNotWritable",
        payload: {
          runtimeReadiness: "RecoveryOnly",
          workspaceStatus: "RecoveryOnly",
          failedChecks: [{ check: "capacity" }],
        },
      });
      if (recovery.outcome === "RuntimeNotWritable") {
        expect(recovery.payload.safeActions.map((action) => action.id)).toContain("export-backup");
      }
      await closeWorkspace(readable.database);

      const absent = await workspaceFixture({ readiness: async () => failing, root: async () => "absent" });
      const unsupported = await initialize(absent.ports, {
        openingInstant: "2026-10-20T14:00:00.000Z",
        timeZone: "America/New_York",
      });
      expect(unsupported).toMatchObject({
        outcome: "RuntimeNotWritable",
        payload: { runtimeReadiness: "Unsupported", workspaceStatus: "None" },
      });
      if (unsupported.outcome === "RuntimeNotWritable") {
        expect(unsupported.payload.safeActions.map((action) => action.id)).toEqual([
          "retry",
          "try-another-browser",
        ]);
      }
      await closeWorkspace(absent.database);
    });
});

describe("Workspace.initialize creates one initialized Workspace or refuses with a typed non-writable result", () => {
  it("should create no Workspace, no defaults and no imported facts when the readiness gate fails, returning the cross-cutting RuntimeNotWritable branch", async () => {
      const failing = await establishReadiness(passingPorts({ capacity: async () => ({ freeBytes: 1 }) }));
      const { database, seam, ports } = await workspaceFixture({ readiness: async () => failing });

      const result = await initialize(ports, {
        openingInstant: "2026-10-20T14:00:00.000Z",
        timeZone: "America/New_York",
      });

      expect(result).toMatchObject({
        outcome: "RuntimeNotWritable",
        payload: { outcome: "RuntimeNotWritable", runtimeReadiness: "Unsupported" },
      });
      expect(await rowsOf(seam, "workspaceMeta")).toEqual([]);
      expect(await rowsOf(seam, "journal")).toEqual([]);
      expect(await rowsOf(seam, "referenceCatalog")).toEqual([]);
      expect(seam.counters.readwriteTransactions).toBe(0);

      await closeWorkspace(database);
    });
});

describe("Workspace.initialize creates one initialized Workspace or refuses with a typed non-writable result", () => {
  it("should return Time Zone Selection Required when the optional first-run time zone is absent, and never write a guessed time zone", async () => {
      const { database, seam, ports } = await workspaceFixture();

      const result = await initialize(ports, { openingInstant: "2026-10-20T14:00:00.000Z" });

      expect(result).toEqual({ outcome: "TimeZoneSelectionRequired" });
      expect(await rowsOf(seam, "workspaceMeta")).toEqual([]);
      expect(await rowsOf(seam, "journal")).toEqual([]);

      await closeWorkspace(database);
    });
});
