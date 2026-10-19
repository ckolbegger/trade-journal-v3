import { installedCapabilities } from "../../src/capability/manifest";
import type { MigrationOutcome } from "../../src/persistence/indexeddb/migration";
import { deleteDatabase, openDatabase } from "../../src/persistence/indexeddb/schema";
import { createTransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { createWriteGate } from "../../src/persistence/indexeddb/writeGate";
import { FixedClock } from "../../src/platform/clock";
import { establishReadiness } from "../../src/readiness";
import type { WorkspacePorts } from "../../src/workspace";
import type {
  StatusPorts,
  WorkspaceRead,
  WorkspaceSnapshotBinding,
} from "../../src/workspace/status";
import { passingPorts } from "./readiness";

export const trivialMigration: MigrationOutcome = {
  outcome: "Migrated",
  activeDatabaseName: "trade-journal",
  receipt: {
    migrationId: "none",
    schemaTransitions: [],
    migrationsApplied: [],
    seedVersion: "",
    seedAdditions: [],
    privateRebuilds: [],
  },
};

export async function workspaceFixture(overrides: Partial<WorkspacePorts> = {}): Promise<{
  database: IDBDatabase;
  seam: ReturnType<typeof createTransactionSeam>;
  readiness: Awaited<ReturnType<typeof establishReadiness>>;
  ports: WorkspacePorts;
}> {
  const database = await openDatabase();
  const seam = createTransactionSeam(
    database,
    createWriteGate({ current: async () => ({ outcome: "Writable", failedChecks: [] }) }),
  );
  const readiness = await establishReadiness(passingPorts());
  const ports: WorkspacePorts = {
    readiness: async () => readiness,
    seam: () => seam,
    migrate: async () => trivialMigration,
    root: async () => "absent",
    ...overrides,
  };
  return { database, seam, readiness, ports };
}

export async function closeWorkspace(database: IDBDatabase): Promise<void> {
  database.close();
  await deleteDatabase();
}

export async function rowsOf(
  seam: ReturnType<typeof createTransactionSeam>,
  store: string,
): Promise<Record<string, unknown>[]> {
  return [...(await seam.snapshot([store])).rows(store)];
}

export const statusClock = new FixedClock("2026-10-19T20:30:00.000Z");

export const fullBinding: WorkspaceSnapshotBinding = {
  revision: 7,
  factRevision: 3,
  observationRevision: 2,
  journalRevision: 4,
  referenceRevision: 5,
};

export const workspaceRead: WorkspaceRead = {
  outcome: "Workspace",
  value: {
    timeZone: "America/New_York",
    timeZoneRevision: 2,
    onboarding: "Needs Institution and Account",
    seedVersions: { journal: "journal-seed-v1", catalog: "catalog-seed-v1" },
  },
  binding: fullBinding,
};

export async function statusPorts(overrides: Partial<StatusPorts> = {}): Promise<StatusPorts> {
  const readiness = await establishReadiness(passingPorts());
  return {
    readiness: async () => readiness,
    root: async () => "readable",
    readWorkspace: async () => workspaceRead,
    clock: statusClock,
    capabilityManifest: installedCapabilities("release-1"),
    protection: async () => ({ kind: "Protected" }),
    ...overrides,
  };
}
