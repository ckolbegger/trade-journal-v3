import {
  DATABASE_NAME,
  D2_SCHEMA_MANIFEST,
  D2_SCHEMA_VERSION,
  deleteDatabase,
  openDatabase,
  openDatabaseWithStores,
} from "../../src/persistence/indexeddb/schema";
import {
  createTransactionSeam,
  type TransactionSeam,
} from "../../src/persistence/indexeddb/transaction";
import {
  createWriteGate,
  type ReadinessDecision,
} from "../../src/persistence/indexeddb/writeGate";
import { migrateD2 } from "../../src/persistence/indexeddb/d2Migration";
import { readActiveDatabaseName } from "../../src/persistence/indexeddb/migration";

export const writable: ReadinessDecision = { outcome: "Writable", failedChecks: [] };

export const recovery: ReadinessDecision = {
  outcome: "RecoveryOnly",
  failedChecks: [{ check: "capacity", detail: "below the derived minimum" }],
};

export async function openSeam(
  decision: ReadinessDecision = writable,
): Promise<{ database: IDBDatabase; seam: TransactionSeam }> {
  const database = await openDatabase();
  const seam = createTransactionSeam(database, createWriteGate({ current: async () => decision }));
  return { database, seam };
}

/**
 * The D2 fixture: a real D1 database migrated forward to the D2 version through D1's migration
 * runner, then opened through the real transaction seam. `fake-indexeddb` is the only substitution.
 */
export async function openD2Seam(
  decision: ReadinessDecision = writable,
): Promise<{ database: IDBDatabase; seam: TransactionSeam; activeDatabaseName: string }> {
  const d1 = await openDatabase(DATABASE_NAME);
  d1.close();
  const migration = await migrateD2(createWriteGate({ current: async () => writable }));
  if (migration.outcome !== "Migrated") {
    throw new Error(`the D2 fixture migration did not run: ${migration.outcome}`);
  }
  const activeDatabaseName = await readActiveDatabaseName();
  const database = await openDatabaseWithStores(
    D2_SCHEMA_MANIFEST,
    activeDatabaseName,
    D2_SCHEMA_VERSION,
  );
  const seam = createTransactionSeam(database, createWriteGate({ current: async () => decision }));
  return { database, seam, activeDatabaseName };
}

export async function seed(
  seam: TransactionSeam,
  store: string,
  row: Record<string, unknown>,
): Promise<void> {
  await seam.commit({ participants: [{ store, put: [row] }] });
}

export async function close(database: IDBDatabase): Promise<void> {
  database.close();
  const databases = await indexedDB.databases();
  for (const database of databases) {
    if (database.name !== undefined) await deleteDatabase(database.name);
  }
}
