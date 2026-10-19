import { CATALOG_SEED_MANIFEST_V1 } from "../catalog";
import { query as catalogQuery, save as catalogSave } from "../catalog/save";
import { installedCapabilities, type InstalledCapabilityManifest } from "../capability/manifest";
import { runDiagnosticTransaction } from "../persistence/indexeddb/diagnostic";
import type { MigrationOutcome } from "../persistence/indexeddb/migration";
import {
  DATABASE_NAME,
  D2_SCHEMA_MANIFEST,
  D2_SCHEMA_VERSION,
  openDatabaseWithStores,
} from "../persistence/indexeddb/schema";
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
import { getDefinitions } from "../journal/definitions";
import { derive } from "../analysis/trade";
import { confirmPlan as runConfirmPlan } from "../trade-workflows";
import { queryRecords } from "../trade-record";
import type { TradeReadModel } from "../workspace/tradeView";
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
    // The application opens the current schema. D2 adds stores and transforms no data, so the
    // upgrade is the engine's own atomic `onupgradeneeded` store creation; the data-transform
    // migration path with its isolated candidate is `migrateD2`, proven by T1's verification.
    if (database === undefined) {
      database = await openDatabaseWithStores(
        D2_SCHEMA_MANIFEST,
        DATABASE_NAME,
        D2_SCHEMA_VERSION,
      );
    }
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

  async function readTradeModel(
    current: TransactionSeam,
    tradeId: string,
  ): Promise<TradeReadModel | undefined> {
    const snapshot = await current.snapshot([
      "tradeRecord",
      "tradeLifecycle",
      "referenceCatalog",
      "journal",
    ]);
    const facts = snapshot.rows("tradeRecord").filter((row) => row.tradeId === tradeId);
    const header = facts.find((row) => row.kind === "trade");
    if (header === undefined) return undefined;
    const planRow = facts.find((row) => row.kind === "plan");
    const lifecycle = snapshot.rows("tradeLifecycle").find((row) => row.tradeId === tradeId);
    if (lifecycle === undefined) return undefined;

    const plannedLegs = facts
      .filter((row) => row.kind === "planned-leg")
      .map((row) => row.leg as TradeReadModel["plannedLegs"][number]);
    const originalManagement = facts
      .filter((row) => row.kind === "management-condition")
      .map((row) => row.condition as TradeReadModel["originalManagement"][number]);

    const derived = derive({
      tradeId,
      sourceFactRevision: Number(lifecycle.factRevision ?? 0),
      economicTime: String(header.economicTime ?? ""),
      analysisCutoff: clock.now(),
      storedLifecycle: lifecycle.state as TradeReadModel["storedLifecycle"],
      facts: facts.map((fact) => ({ kind: String(fact.kind) })),
    });

    const catalog = snapshot.rows("referenceCatalog");
    const account = catalog.find((row) => row.id === header.accountId);
    const strategy = catalog.find(
      (row) => row.kind === "strategy" && (row.stableKey ?? row.id) === header.strategyStableKey,
    );
    const entry = snapshot
      .rows("journal")
      .find((row) => row.kind === "entry" && (row.anchor as { tradeId?: string } | undefined)?.tradeId === tradeId);

    const baseline = planRow?.baseline as TradeReadModel["baseline"] | undefined;
    if (baseline === undefined) return undefined;

    return {
      tradeId,
      factRevision: Number(lifecycle.factRevision ?? 0),
      accountId: String(header.accountId ?? ""),
      accountLabel: String(account?.label ?? ""),
      strategyLabel: String(strategy?.label ?? ""),
      economicTime: String(header.economicTime ?? ""),
      intendedEntry: planRow?.intendedEntry as TradeReadModel["intendedEntry"],
      plannedLegs,
      originalManagement,
      baseline,
      oneR: baseline.oneR,
      storedLifecycle: lifecycle.state as TradeReadModel["storedLifecycle"],
      expectedLifecycle:
        derived.expectedLifecycle.outcome === "Value" ? derived.expectedLifecycle.value : undefined,
      agreement: derived.agreement.status,
      disagreement:
        derived.agreement.status === "disagreement" &&
        derived.agreement.stored !== undefined &&
        derived.agreement.expected !== undefined
          ? { stored: derived.agreement.stored, expected: derived.agreement.expected }
          : undefined,
      reflection:
        entry === undefined
          ? undefined
          : {
              entryId: String(entry.entryId),
              sourceLabel: String(entry.sourceLabel ?? ""),
              definitionRevision: Number(entry.definitionRevision ?? 0),
              thesis: String(entry.thesis ?? ""),
              invalidation: String(entry.invalidation ?? ""),
            },
    };
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
    streamStrategies: async () => {
      const snapshot = await (await seam()).snapshot(["referenceCatalog"]);
      return snapshot
        .rows("referenceCatalog")
        .filter((row) => row.kind === "strategy" && row.retired !== true)
        .map((row) => ({ stableKey: String(row.stableKey ?? row.id), label: String(row.label) }))
        .sort((left, right) => left.stableKey.localeCompare(right.stableKey));
    },

    planDefinition: async () =>
      getDefinitions(await seam(), { entryTypeStableKey: "entryType.plan-reflection" }),

    confirmPlan: async (command) => {
      const current = await seam();
      return runConfirmPlan(current, command);
    },

    streamTrades: async () => {
      const page = await queryRecords(await seam(), {
        lifecycle: "CurrentState",
        state: "Planned",
        projection: "Summary",
        limit: 50,
      });
      const models: TradeReadModel[] = [];
      for (const row of page.rows) {
        const model = await readTradeModel(await seam(), row.tradeId);
        if (model !== undefined) models.push(model);
      }
      return models;
    },

    readTrade: async (tradeId: string) => readTradeModel(await seam(), tradeId),

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
