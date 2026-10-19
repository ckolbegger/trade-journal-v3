import { deleteDatabase, openDatabase } from "../../src/persistence/indexeddb/schema";
import { createTransactionSeam, type TransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { createWriteGate, type ReadinessDecision } from "../../src/persistence/indexeddb/writeGate";

const writable: ReadinessDecision = { outcome: "Writable", failedChecks: [] };

export async function openJournal(): Promise<{ database: IDBDatabase; seam: TransactionSeam }> {
  const database = await openDatabase();
  const seam = createTransactionSeam(database, createWriteGate({ current: async () => writable }));
  return { database, seam };
}

export async function journalRows(
  seam: TransactionSeam,
): Promise<Record<string, unknown>[]> {
  return [...(await seam.snapshot(["journal"])).rows("journal")];
}

export async function closeJournal(database: IDBDatabase): Promise<void> {
  database.close();
  await deleteDatabase();
}
