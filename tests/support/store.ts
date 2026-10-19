import { deleteDatabase, openDatabase } from "../../src/persistence/indexeddb/schema";
import {
  createTransactionSeam,
  type TransactionSeam,
} from "../../src/persistence/indexeddb/transaction";
import {
  createWriteGate,
  type ReadinessDecision,
} from "../../src/persistence/indexeddb/writeGate";

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

export async function seed(
  seam: TransactionSeam,
  store: string,
  row: Record<string, unknown>,
): Promise<void> {
  await seam.commit({ participants: [{ store, put: [row] }] });
}

export async function close(database: IDBDatabase): Promise<void> {
  database.close();
  await deleteDatabase();
}
