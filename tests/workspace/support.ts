import type { MigrationOutcome } from "../../src/persistence/indexeddb/migration";
import { deleteDatabase, openDatabase } from "../../src/persistence/indexeddb/schema";
import { createTransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { createWriteGate } from "../../src/persistence/indexeddb/writeGate";
import { establishReadiness } from "../../src/readiness";
import type { WorkspacePorts } from "../../src/workspace";
import { passingPorts } from "../readiness/support";

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
