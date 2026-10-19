import type { TransactionSeam } from "../../src/persistence/indexeddb/transaction";
import type { ValueResult } from "../../src/values";
import { close, openSeam, writable } from "./store";

export async function openCatalog(): Promise<{ database: IDBDatabase; seam: TransactionSeam }> {
  return openSeam(writable);
}

export async function openJournal(): Promise<{ database: IDBDatabase; seam: TransactionSeam }> {
  return openSeam(writable);
}

export async function catalogRows(seam: TransactionSeam): Promise<Record<string, unknown>[]> {
  return [...(await seam.snapshot(["referenceCatalog"])).rows("referenceCatalog")];
}

export async function journalRows(seam: TransactionSeam): Promise<Record<string, unknown>[]> {
  return [...(await seam.snapshot(["journal"])).rows("journal")];
}

export const closeCatalog = close;
export const closeJournal = close;

/** Unwrap a successful value-layer result, failing the test on an unexpected typed error. */
export function value<T>(result: ValueResult<T>): T {
  if (!result.ok) {
    throw new Error(`expected a value, received ${result.error.kind}`);
  }
  return result.value;
}
