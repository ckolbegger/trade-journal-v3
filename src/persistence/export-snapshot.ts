import type { ExportLayout } from './export-layout.ts';
import { keyOf, type WorkspaceStore } from './schema.ts';

// Records per batch (D8 A128).
const EXPORT_BATCH_SIZE = 500;

export interface ExportBatch {
  readonly store: WorkspaceStore;
  // One store's records, in primary-key order, with the layout's private fields omitted.
  readonly records: readonly Record<string, unknown>[];
}

// What the snapshot has read before any batch: the same values the final `Read` result reports.
export interface ExportStart {
  readonly binding: { readonly databaseName: string; readonly contentRevision: number };
  readonly meta: readonly Record<string, unknown>[];
  readonly counts: Readonly<Record<string, number>>;
}

export type ExportReadResult =
  | {
      readonly kind: 'Read';
      readonly binding: { readonly databaseName: string; readonly contentRevision: number };
      // The schema version the database's own `meta` names, which is the layout's.
      readonly schemaVersion: number;
      // Every `meta` record: the Workspace section, plus the schema and content records.
      readonly meta: readonly Record<string, unknown>[];
      // Per layout store, counted at the start of the same transaction.
      readonly counts: Readonly<Record<string, number>>;
    }
  // The database's stored schema version is not the layout's (or `meta` names none).
  | { readonly kind: 'UnknownLayout'; readonly schemaVersion: number | undefined }
  // `onBatch` returned a promise, which would let IndexedDB auto-commit the transaction early.
  | { readonly kind: 'EarlyAutoCommitGuard' }
  | { readonly kind: 'ReadFailed'; readonly store: WorkspaceStore };

const probeFailed = Symbol('schema probe failed');

type Failure =Exclude<ExportReadResult, { kind: 'Read' }>;

function withoutPrivateFields(record: Record<string, unknown>, fields: readonly string[] | undefined): Record<string, unknown> {
  if (!fields) return record;
  const copy = { ...record };
  for (const field of fields) delete copy[field];
  return copy;
}

// Reads a Workspace database's authoritative records in one readonly transaction (D8 A128): the
// `meta` records and every store's count first, then each store in key order through chained
// `getAll` requests in their success callbacks. Everything is synchronous, so the transaction never
// auto-commits early, and IndexedDB queues any overlapping write until it finishes.
export async function readExportSnapshot(
  indexedDB: IDBFactory,
  databaseName: string,
  layout: ExportLayout,
  onBatch: (batch: ExportBatch) => void,
  // Called once, synchronously inside the transaction, before the first `onBatch`.
  onStart?: (start: ExportStart) => void,
): Promise<ExportReadResult> {
  let db: IDBDatabase;
  try {
    db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open(databaseName);
      // An upgrade means the database did not exist; abort it so the read-only export creates nothing.
      open.onupgradeneeded = () => open.transaction?.abort();
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error ?? new Error('open failed'));
    });
  } catch {
    return { kind: 'ReadFailed', store: 'meta' };
  }
  db.onversionchange = () => db.close();
  try {
    const missing = ['meta', ...layout.stores].find((store) => !db.objectStoreNames.contains(store));
    if (missing) {
      // An older schema lacks stores the layout names: that is UnknownLayout, not a failed read.
      if (missing !== 'meta') {
        const stored = await new Promise<unknown>((resolve) => {
          const request = db.transaction('meta', 'readonly').objectStore('meta').get('schema');
          request.onsuccess = () => resolve((request.result as Record<string, unknown> | undefined)?.['schemaVersion']);
          request.onerror = (event) => {
            event.preventDefault();
            resolve(probeFailed);
          };
        });
        if (stored === probeFailed) return { kind: 'ReadFailed', store: 'meta' };
        if (stored !== layout.schemaVersion) return { kind: 'UnknownLayout', schemaVersion: typeof stored === 'number' ? stored : undefined };
      }
      return { kind: 'ReadFailed', store: missing as WorkspaceStore };
    }
    return await new Promise<ExportReadResult>((resolve, reject) => {
      const tx = db.transaction(['meta', ...layout.stores], 'readonly');
      let failure: Failure | undefined;
      let thrown: Error | undefined;
      let result: ExportReadResult | undefined;
      const stop = () => {
        try {
          tx.abort();
        } catch {
          // Already finished or aborted.
        }
      };
      tx.oncomplete = () => resolve(result!);
      tx.onabort = () => {
        if (thrown) reject(thrown);
        else if (failure) resolve(failure);
        else reject(tx.error ?? new Error('export snapshot aborted'));
      };
      const fail = (reason: Failure) => {
        failure ??= reason;
        stop();
      };
      // Runs `onDone` with the request's result; a request error or a throw ends the snapshot.
      const watch = <T>(store: WorkspaceStore, request: IDBRequest<T>, onDone: (value: T) => void) => {
        request.onerror = (event) => {
          event.preventDefault();
          fail({ kind: 'ReadFailed', store });
        };
        request.onsuccess = () => {
          try {
            onDone(request.result);
          } catch (error) {
            thrown ??= error instanceof Error ? error : new Error(String(error));
            stop();
          }
        };
      };

      const readFrom = (index: number, after: IDBValidKey | undefined) => {
        const store = layout.stores[index];
        if (store === undefined) return;
        const range = after === undefined ? undefined : IDBKeyRange.lowerBound(after, true);
        watch(store, tx.objectStore(store).getAll(range, EXPORT_BATCH_SIZE) as IDBRequest<Record<string, unknown>[]>, (rows) => {
          // Read before onBatch: it may be handed the original records and change their key fields.
          const lastKey = rows.length === EXPORT_BATCH_SIZE ? keyOf(store, rows[rows.length - 1]!) : undefined;
          if (rows.length > 0) {
            const returned: unknown = onBatch({ store, records: rows.map((row) => withoutPrivateFields(row, layout.privateFields[store])) });
            if (typeof (returned as { then?: unknown } | undefined)?.then === 'function') {
              // The snapshot ends here, so nothing waits on this promise: absorb a later rejection.
              (returned as Promise<unknown>).then(undefined, () => undefined);
              fail({ kind: 'EarlyAutoCommitGuard' });
              return;
            }
          }
          if (lastKey === undefined) readFrom(index + 1, undefined);
          else readFrom(index, lastKey);
        });
      };

      let meta: Record<string, unknown>[] = [];
      const counts: Record<string, number> = {};
      let pending = 1 + layout.stores.length;
      const started = () => {
        if (--pending > 0) return;
        const schema = meta.find((record) => record['key'] === 'schema')?.['schemaVersion'];
        if (schema !== layout.schemaVersion) {
          fail({ kind: 'UnknownLayout', schemaVersion: typeof schema === 'number' ? schema : undefined });
          return;
        }
        const content = meta.find((record) => record['key'] === 'content')?.['contentRevision'] as number;
        const binding = { databaseName, contentRevision: content };
        result = { kind: 'Read', binding, schemaVersion: schema, meta, counts };
        // A throw here ends the snapshot like one from onBatch.
        onStart?.({ binding, meta, counts });
        readFrom(0, undefined);
      };
      watch('meta', tx.objectStore('meta').getAll() as IDBRequest<Record<string, unknown>[]>, (records) => {
        meta = records;
        started();
      });
      for (const store of layout.stores) {
        watch(store, tx.objectStore(store).count(), (count) => {
          counts[store] = count;
          started();
        });
      }
    });
  } finally {
    db.close();
  }
}
