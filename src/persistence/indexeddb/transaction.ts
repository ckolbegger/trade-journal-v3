import type { RuntimeNotWritable } from "../../results";
import type { WriteGate } from "./writeGate";

export interface ParticipantEffect {
  readonly store: string;
  readonly put?: readonly Record<string, unknown>[];
  readonly remove?: readonly IDBValidKey[];
}

export interface CommitRequest {
  readonly participants: readonly ParticipantEffect[];
  /** Named Workspace counters incremented exactly once per committed command. */
  readonly counters?: readonly string[];
}

export type CommitResult =
  | {
      readonly kind: "Committed";
      readonly revisions: Readonly<Record<string, number>>;
      readonly counters?: Readonly<Record<string, number>>;
    }
  | { readonly kind: "Rejected"; readonly payload: RuntimeNotWritable };

export interface ReadSnapshot {
  rows(store: string): readonly Record<string, unknown>[];
}

export interface TransactionCounters {
  readwriteTransactions: number;
}

export interface TransactionSeam {
  /** The one commit/rollback boundary per semantic command. */
  commit(request: CommitRequest): Promise<CommitResult>;
  /** One coherent read-only view of the named stores at a single point in time. */
  snapshot(stores: readonly string[]): Promise<ReadSnapshot>;
  readonly counters: TransactionCounters;
}

const REVISIONS_KEY = "revisions";
const COUNTERS_KEY = "counters";
const REVISIONS_STORE = "workspaceMeta";

interface GroupedEffect {
  put: Record<string, unknown>[];
  remove: IDBValidKey[];
}

function group(participants: readonly ParticipantEffect[]): Map<string, GroupedEffect> {
  const grouped = new Map<string, GroupedEffect>();
  for (const participant of participants) {
    const effect = grouped.get(participant.store) ?? { put: [], remove: [] };
    effect.put.push(...(participant.put ?? []));
    effect.remove.push(...(participant.remove ?? []));
    grouped.set(participant.store, effect);
  }
  return grouped;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("the request failed"));
  });
}

export function createTransactionSeam(
  database: IDBDatabase,
  gate: WriteGate,
): TransactionSeam {
  const counters: TransactionCounters = { readwriteTransactions: 0 };

  async function commit(request: CommitRequest): Promise<CommitResult> {
    const grouped = group(request.participants);
    const stores = [...grouped.keys()];
    if (stores.length === 0) return { kind: "Committed", revisions: {} };

    const gated = await gate.beforeWrite();
    if (gated.kind === "Rejected") return { kind: "Rejected", payload: gated.payload };

    const names = [...new Set([...stores, REVISIONS_STORE])];
    return new Promise<CommitResult>((resolve, reject) => {
      const transaction = database.transaction(names, "readwrite");
      counters.readwriteTransactions += 1;
      let committedRevisions: Record<string, number> | undefined;
      let committedCounters: Record<string, number> | undefined;
      const namedCounters = request.counters ?? [];

      transaction.oncomplete = () => {
        const revisions: Record<string, number> = {};
        for (const store of stores) revisions[store] = committedRevisions?.[store] ?? 0;
        const result: CommitResult =
          namedCounters.length === 0
            ? { kind: "Committed", revisions }
            : { kind: "Committed", revisions, counters: committedCounters ?? {} };
        resolve(result);
      };
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("the transaction aborted"));

      const meta = transaction.objectStore(REVISIONS_STORE);
      const revisionsRequest = meta.get(REVISIONS_KEY);
      const countersRequest = meta.get(COUNTERS_KEY);
      let pendingReads = 2;
      let revisionsStored: Record<string, number> = {};
      let countersStored: Record<string, number> = {};

      const fail = (error: unknown): void => {
        try {
          transaction.abort();
        } catch {
          // The transaction already aborted on its own.
        }
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      const write = (): void => {
        const next: Record<string, number> = { ...revisionsStored };
        for (const store of stores) next[store] = (next[store] ?? 0) + 1;
        meta.put({ key: REVISIONS_KEY, value: next });

        const nextCounters: Record<string, number> = { ...countersStored };
        for (const counter of namedCounters) {
          nextCounters[counter] = (nextCounters[counter] ?? 0) + 1;
        }
        if (namedCounters.length > 0) {
          meta.put({ key: COUNTERS_KEY, value: nextCounters });
        }

        try {
          for (const [storeName, effect] of grouped) {
            const store = transaction.objectStore(storeName);
            for (const row of effect.put) store.put(row);
            for (const key of effect.remove) store.delete(key);
          }
        } catch (error) {
          fail(error);
          return;
        }
        committedRevisions = next;
        committedCounters = nextCounters;
      };

      const readDone = (): void => {
        pendingReads -= 1;
        if (pendingReads === 0) write();
      };

      revisionsRequest.onerror = () => fail(revisionsRequest.error);
      revisionsRequest.onsuccess = () => {
        revisionsStored =
          (revisionsRequest.result as { value?: Record<string, number> } | undefined)?.value ?? {};
        readDone();
      };
      countersRequest.onerror = () => fail(countersRequest.error);
      countersRequest.onsuccess = () => {
        countersStored =
          (countersRequest.result as { value?: Record<string, number> } | undefined)?.value ?? {};
        readDone();
      };
    });
  }

  async function snapshot(stores: readonly string[]): Promise<ReadSnapshot> {
    const transaction = database.transaction(stores, "readonly");
    const requests = stores.map((store) =>
      requestResult(transaction.objectStore(store).getAll()),
    );
    const results = await Promise.all(requests);
    const rows = new Map<string, readonly Record<string, unknown>[]>();
    stores.forEach((store, index) => {
      rows.set(store, results[index] as Record<string, unknown>[]);
    });
    return { rows: (store) => rows.get(store) ?? [] };
  }

  return { commit, snapshot, counters };
}
