/**
 * The isolated diagnostic transaction of readiness check one. It writes and removes a non-authoritative
 * probe inside one readwrite transaction, so a successful commit proves the store is writable while
 * leaving no authoritative fact and no revision change.
 */
export type DiagnosticTransactionResult =
  | { readonly outcome: "Passed" }
  | { readonly outcome: "Failed"; readonly detail: string };

const PROBE_STORE = "workspaceMeta";
const PROBE_KEY = "__readiness_probe__";

export function runDiagnosticTransaction(
  database: IDBDatabase,
): Promise<DiagnosticTransactionResult> {
  return new Promise<DiagnosticTransactionResult>((resolve) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction([PROBE_STORE], "readwrite");
    } catch (error) {
      resolve({
        outcome: "Failed",
        detail: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    transaction.oncomplete = () => resolve({ outcome: "Passed" });
    transaction.onabort = () =>
      resolve({
        outcome: "Failed",
        detail: transaction.error?.message ?? "the diagnostic transaction aborted",
      });
    transaction.onerror = () =>
      resolve({
        outcome: "Failed",
        detail: transaction.error?.message ?? "the diagnostic transaction failed",
      });

    try {
      const store = transaction.objectStore(PROBE_STORE);
      store.put({ key: PROBE_KEY, value: "probe" });
      store.delete(PROBE_KEY);
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // The transaction already aborted on its own.
      }
      resolve({
        outcome: "Failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
