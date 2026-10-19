import { CATALOG_SEED_MANIFEST_V1 } from "../catalog";
import { query as catalogQuery, save as catalogSave } from "../catalog/save";
import { installedCapabilities, type InstalledCapabilityManifest } from "../capability/manifest";
import { runDiagnosticTransaction } from "../persistence/indexeddb/diagnostic";
import type { MigrationOutcome } from "../persistence/indexeddb/migration";
import { openDatabase } from "../persistence/indexeddb/schema";
import { createTransactionSeam, type TransactionSeam } from "../persistence/indexeddb/transaction";
import { createWriteGate, type ReadinessDecision } from "../persistence/indexeddb/writeGate";
import type { Clock, Instant } from "../platform/clock";
import type { HostPort } from "../platform/host";
import type { ReadinessPorts, ReadinessResult } from "../readiness";
import { establishReadiness } from "../readiness";
import { createReadinessLedger, type ReadinessBoundary, type ReadinessReceipt } from "../readiness/lifecycle";
import type { RootObservation } from "../readiness/decision";
import { validateReleaseInventory } from "../release/inventory";
import { initialize, type OnboardingState } from "../workspace";
import { requestDurability } from "../workspace/durability";
import type {
  ApplicationRuntime,
  ApplicationStart,
  StartupOverride,
} from "../workspace/runtime";
import {
  getStatus,
  type WorkspaceRecord,
  type WorkspaceSnapshotBinding,
} from "../workspace/status";

const TRIVIAL_MIGRATION: MigrationOutcome = {
  outcome: "Migrated",
  activeDatabaseName: "trade-journal",
  receipt: {
    migrationId: "d1-startup",
    schemaTransitions: [],
    migrationsApplied: [],
    seedVersion: "",
    seedAdditions: [],
    privateRebuilds: [],
  },
};

function delay(milliseconds: number | undefined): Promise<void> {
  return milliseconds === undefined || milliseconds <= 0
    ? Promise.resolve()
    : new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function createApplicationRuntime(
  host: HostPort,
  clock: Clock,
  override: StartupOverride = {},
): ApplicationRuntime {
  let database: IDBDatabase | undefined;
  let seamValue: TransactionSeam | undefined;
  let manifest: InstalledCapabilityManifest = installedCapabilities("unresolved");
  let timeZone = "";

  async function databaseHandle(): Promise<IDBDatabase> {
    if (database === undefined) database = await openDatabase();
    return database;
  }

  async function seam(): Promise<TransactionSeam> {
    if (seamValue !== undefined) return seamValue;
    const handle = await databaseHandle();
    seamValue = createTransactionSeam(handle, createWriteGate({ current: decision }));
    return seamValue;
  }

  async function observeRoot(): Promise<RootObservation> {
    if (override.rootUnreadable === true) return "unreadable";
    try {
      const snapshot = await (await seam()).snapshot(["workspaceMeta"]);
      return snapshot.rows("workspaceMeta").some((row) => row.key === "workspace")
        ? "readable"
        : "absent";
    } catch {
      return "unreadable";
    }
  }

  async function readinessPorts(): Promise<ReadinessPorts> {
    const handle = await databaseHandle();
    return {
      protection: async () => override.protection ?? host.protection(),
      diagnostic: async () => {
        if (override.diagnosticFailure !== undefined) {
          return { outcome: "Failed", detail: override.diagnosticFailure };
        }
        return runDiagnosticTransaction(handle);
      },
      capacity: async () => {
        if (override.capacityFreeBytes !== undefined) return { freeBytes: override.capacityFreeBytes };
        const measured = await host.capacity();
        if (measured.kind === "Measured") return { freeBytes: measured.freeBytes };
        return {
          unavailableReason:
            measured.kind === "Unavailable"
              ? measured.reason
              : "the host does not expose a capacity estimate",
        };
      },
      workerControl: async () => override.workerControl ?? host.workerControl(),
      inventory: async (expectedReleaseId) => {
        if (override.inventoryFailures !== undefined) {
          return { outcome: "Incomplete", failures: override.inventoryFailures };
        }
        return validateReleaseInventory(
          host,
          expectedReleaseId === undefined ? {} : { expectedReleaseId },
        );
      },
    };
  }

  async function readiness(): Promise<ReadinessResult> {
    await host.awaitWorkerControl();
    await delay(override.delayMs);
    return establishReadiness(await readinessPorts());
  }

  async function readWorkspace(): Promise<
    | { readonly outcome: "Workspace"; readonly value: WorkspaceRecord; readonly binding: WorkspaceSnapshotBinding }
    | { readonly outcome: "NoWorkspace" }
    | { readonly outcome: "Unreadable"; readonly detail: string }
  > {
    if (override.noWorkspace === true) return { outcome: "NoWorkspace" };
    try {
      const snapshot = await (await seam()).snapshot(["workspaceMeta", "referenceCatalog"]);
      const row = snapshot.rows("workspaceMeta").find((entry) => entry.key === "workspace");
      if (row === undefined) return { outcome: "NoWorkspace" };
      const stored = row.value as {
        timeZone?: string;
        seedVersions?: { journal?: string; catalog?: string };
      };
      const revisions =
        (snapshot.rows("workspaceMeta").find((entry) => entry.key === "revisions")?.value as
          | Record<string, number>
          | undefined) ?? {};
      const content =
        (snapshot.rows("workspaceMeta").find((entry) => entry.key === "counters")?.value as
          | Record<string, number>
          | undefined) ?? {};
      const catalog = snapshot.rows("referenceCatalog");
      const onboarding: OnboardingState =
        catalog.some((record) => record.kind === "institution" && record.retired !== true) &&
        catalog.some((record) => record.kind === "account" && record.retired !== true)
          ? "Ready for Trade Planning"
          : "Needs Institution and Account";
      return {
        outcome: "Workspace",
        value: {
          timeZone: stored.timeZone ?? timeZone,
          timeZoneRevision: 1,
          onboarding,
          seedVersions: {
            journal: stored.seedVersions?.journal ?? "",
            catalog: stored.seedVersions?.catalog ?? "",
          },
        },
        binding: {
          revision: content.workspaceContentRevision ?? 0,
          factRevision: revisions.tradeRecord ?? 0,
          observationRevision: revisions.marketData ?? 0,
          journalRevision: revisions.journal ?? 0,
          referenceRevision: revisions.referenceCatalog ?? 0,
        },
      };
    } catch (error) {
      return {
        outcome: "Unreadable",
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async function decision(): Promise<ReadinessDecision> {
    const result = await readiness();
    const root = await observeRoot();
    if (result.outcome === "Writable") return { outcome: "Writable", failedChecks: [] };
    return {
      outcome: root === "readable" ? "RecoveryOnly" : "Unsupported",
      failedChecks: result.failedChecks,
      existingRootUnreadable: root === "unreadable",
      safeActions: result.safeActions,
    };
  }

  async function compute(): Promise<ApplicationStart> {
    const readinessResult = await readiness();
    manifest = installedCapabilities(readinessResult.intendedReleaseId ?? "unresolved");
    const root = await observeRoot();
    const status = await getStatus({
      readiness: async () => readinessResult,
      root: async () => root,
      readWorkspace,
      clock,
      capabilityManifest: manifest,
      protection: async () => override.protection ?? host.protection(),
    });
    return { readiness: readinessResult, status, manifest };
  }

  return {
    start: compute,
    refresh: compute,
    capabilityManifest: () => manifest,
    setTimeZone: (value: string) => {
      timeZone = value;
    },
    initialize: async (selectedTimeZone: string) => {
      timeZone = selectedTimeZone;
      const current = await seam();
      return initialize(
        {
          readiness,
          seam: () => current,
          migrate: async () => TRIVIAL_MIGRATION,
          root: observeRoot,
        },
        { openingInstant: clock.now(), timeZone: selectedTimeZone },
      );
    },
    streamInstitutions: async () => {
      await delay(override.queryDelayMs);
      if (override.queryFailure === true) throw new Error("the institutions could not be loaded");
      return catalogQuery(await seam(), {
        kind: "institution",
        view: "includeInactive",
        limit: 50,
      });
    },
    streamSelectableInstitutions: async () =>
      catalogQuery(await seam(), {
        kind: "institution",
        view: "selectable",
        limit: 50,
      }),
    streamAccounts: async () =>
      catalogQuery(await seam(), { kind: "account", view: "selectable", limit: 50 }),
    addAccount: async (
      institutionId: string,
      label: string,
      expectedSnapshotRevision: number,
    ) =>
      catalogSave(await seam(), {
        type: "createAccount",
        institutionId,
        label,
        expectedSnapshotRevision,
      }),
    addInstitution: async (label: string, expectedSnapshotRevision: number) =>
      catalogSave(await seam(), {
        type: "createInstitution",
        label,
        expectedSnapshotRevision,
      }),
    requestDurability: async () =>
      requestDurability({
        protection: () => host.protection(),
        requestDurability: () => host.requestDurability(),
        readiness,
      }),
  };
}

export type { ApplicationRuntime, ApplicationStart, StartupOverride } from "../workspace/runtime";
export { createReadinessLedger };
export type { ReadinessReceipt, ReadinessBoundary };
export type { Instant };
export const SEED_VERSION = CATALOG_SEED_MANIFEST_V1.version;
