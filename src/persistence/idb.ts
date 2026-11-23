import type { ReadinessCheckId, RuntimeNotWritableReason } from '../shared/result';

export const SCHEMA_VERSION_V1 = 1 as const;
export const BOOTSTRAP_DB_NAME = 'tjv3_bootstrap';
export const DIAGNOSTICS_DB_NAME = 'tjv3_diagnostics';
export const WORKSPACE_DB_PREFIX = 'tjv3_ws_gen_';

export type CatalogAvailability = 'Active' | 'Archived';

export interface CatalogHistoryEntry {
  readonly revision: number;
  readonly action: 'Created' | 'Renamed' | 'Archived' | 'Reactivated';
  readonly label: string;
  readonly status: CatalogAvailability;
  readonly recordedAt: string;
}

export interface InstitutionRecord {
  readonly id: string;
  readonly currentLabel: string;
  readonly normalizedLabel: string;
  readonly status: CatalogAvailability;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly history: readonly CatalogHistoryEntry[];
}

export interface AccountRecord {
  readonly id: string;
  readonly institutionId: string;
  readonly currentLabel: string;
  readonly normalizedLabel: string;
  readonly status: CatalogAvailability;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly history: readonly CatalogHistoryEntry[];
}

export interface WorkspaceMetaRecord {
  readonly key: 'singleton';
  readonly schemaVersion: number;
  readonly timeZone: string;
  readonly settingsRevision: number;
  readonly workspaceRevision: number;
  readonly initializedAt: string;
  readonly updatedAt: string;
}

export interface CatalogMetaRecord {
  readonly key: 'singleton';
  readonly catalogRevision: number;
  readonly seedManifestVersion: number;
  readonly seededAt: string;
}

export interface StoreSchemaMap {
  workspace_meta: WorkspaceMetaRecord;
  catalog_meta: CatalogMetaRecord;
  catalog_institutions: InstitutionRecord;
  catalog_accounts: AccountRecord;
}

export type StoreName = keyof StoreSchemaMap;

export type WriteGateDecision =
  | { readonly writable: true }
  | {
      readonly writable: false;
      readonly reason: RuntimeNotWritableReason;
      readonly failedChecks: readonly ReadinessCheckId[];
    };

export interface RuntimeWriteGate {
  checkWritable(): WriteGateDecision;
}

export type RootInspectionResult =
  | { readonly status: 'Empty' }
  | {
      readonly status: 'Present';
      readonly activeGeneration: number;
      readonly schemaVersion: number;
      readonly workspaceMeta: WorkspaceMetaRecord;
    }
  | { readonly status: 'IntegrityBlocked'; readonly reason: string };

export interface ReadTxHandle {
  get<S extends StoreName>(store: S, key: string): Promise<StoreSchemaMap[S] | undefined>;
  getAll<S extends StoreName>(store: S): Promise<StoreSchemaMap[S][]>;
}

export interface WriteTxHandle extends ReadTxHandle {
  put<S extends StoreName>(store: S, value: StoreSchemaMap[S]): void;
  delete<S extends StoreName>(store: S, key: string): void;
}

export type WriteTransactionResult<T> =
  | { readonly status: 'Committed'; readonly value: T }
  | {
      readonly status: 'RuntimeNotWritable';
      readonly reason: RuntimeNotWritableReason;
      readonly failedChecks: readonly ReadinessCheckId[];
    };

export interface PersistenceSeam {
  runDiagnosticProbe(): Promise<{ ok: true } | { ok: false; error: string }>;
  inspectRoot(): Promise<RootInspectionResult>;
  runReadTransaction<T>(
    stores: readonly StoreName[],
    fn: (tx: ReadTxHandle) => Promise<T>,
  ): Promise<T>;
  runWriteTransaction<T>(
    stores: readonly StoreName[],
    fn: (tx: WriteTxHandle) => T | Promise<T>,
  ): Promise<WriteTransactionResult<T>>;
}

interface BootstrapPointerRecord {
  readonly key: 'active';
  readonly activeGeneration: number;
  readonly schemaVersion: number;
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function openDatabase(
  idb: IDBFactory,
  name: string,
  version: number,
  onUpgrade: (db: IDBDatabase) => void,
): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    let settled = false;
    const req = idb.open(name, version);
    req.onupgradeneeded = () => {
      onUpgrade(req.result);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
      };
      if (settled) {
        db.close();
        return;
      }
      settled = true;
      resolve(db);
    };
    req.onerror = () => {
      if (settled) return;
      settled = true;
      reject(req.error ?? new Error(`Failed to open database ${name}`));
    };
    req.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(new Error(`Opening database ${name} was blocked`));
    };
  });
}

function ensureBootstrapStores(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains('pointer')) {
    db.createObjectStore('pointer', { keyPath: 'key' });
  }
}

function ensureDiagnosticsStores(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains('probe')) {
    db.createObjectStore('probe', { keyPath: 'id' });
  }
}

function ensureWorkspaceV1Stores(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains('workspace_meta')) {
    db.createObjectStore('workspace_meta', { keyPath: 'key' });
  }
  if (!db.objectStoreNames.contains('catalog_meta')) {
    db.createObjectStore('catalog_meta', { keyPath: 'key' });
  }
  if (!db.objectStoreNames.contains('catalog_institutions')) {
    const instStore = db.createObjectStore('catalog_institutions', { keyPath: 'id' });
    instStore.createIndex('by_normalized_label', 'normalizedLabel', { unique: false });
  }
  if (!db.objectStoreNames.contains('catalog_accounts')) {
    const accStore = db.createObjectStore('catalog_accounts', { keyPath: 'id' });
    accStore.createIndex('by_institution', 'institutionId', { unique: false });
  }
}

function isValidPointer(raw: unknown): raw is BootstrapPointerRecord {
  if (typeof raw !== 'object' || raw === null) {
    return false;
  }
  const rec = raw as Record<string, unknown>;
  return (
    rec.key === 'active' &&
    typeof rec.activeGeneration === 'number' &&
    Number.isInteger(rec.activeGeneration) &&
    rec.activeGeneration >= 1 &&
    typeof rec.schemaVersion === 'number' &&
    Number.isInteger(rec.schemaVersion) &&
    rec.schemaVersion === SCHEMA_VERSION_V1
  );
}

function isValidWorkspaceMeta(raw: unknown): raw is WorkspaceMetaRecord {
  if (typeof raw !== 'object' || raw === null) {
    return false;
  }
  const rec = raw as Record<string, unknown>;
  return (
    rec.key === 'singleton' &&
    typeof rec.schemaVersion === 'number' &&
    rec.schemaVersion === SCHEMA_VERSION_V1 &&
    typeof rec.timeZone === 'string' &&
    rec.timeZone.length > 0 &&
    typeof rec.settingsRevision === 'number' &&
    Number.isInteger(rec.settingsRevision) &&
    rec.settingsRevision >= 1 &&
    typeof rec.workspaceRevision === 'number' &&
    Number.isInteger(rec.workspaceRevision) &&
    rec.workspaceRevision >= 1 &&
    typeof rec.initializedAt === 'string' &&
    typeof rec.updatedAt === 'string'
  );
}

export function createPersistenceSeam(options: {
  readonly indexedDB: IDBFactory | null | undefined;
  readonly writeGate: RuntimeWriteGate;
}): PersistenceSeam {
  const { indexedDB: idb, writeGate } = options;

  async function readBootstrapPointer(): Promise<
    | { status: 'Unavailable' }
    | { status: 'Missing' }
    | { status: 'Valid'; pointer: BootstrapPointerRecord }
    | { status: 'Corrupt'; reason: string }
  > {
    if (!idb) {
      return { status: 'Unavailable' };
    }
    let db: IDBDatabase | undefined;
    try {
      db = await openDatabase(idb, BOOTSTRAP_DB_NAME, 1, ensureBootstrapStores);
      const tx = db.transaction('pointer', 'readonly');
      const raw = await requestToPromise(tx.objectStore('pointer').get('active'));
      if (raw === undefined) {
        return { status: 'Missing' };
      }
      if (!isValidPointer(raw)) {
        return {
          status: 'Corrupt',
          reason: 'Bootstrap pointer record failed schema/generation validation.',
        };
      }
      return { status: 'Valid', pointer: raw };
    } catch (error) {
      return {
        status: 'Corrupt',
        reason: error instanceof Error ? error.message : 'Unable to read bootstrap database.',
      };
    } finally {
      db?.close();
    }
  }

  async function writeBootstrapPointer(pointer: BootstrapPointerRecord): Promise<void> {
    if (!idb) {
      throw new Error('IndexedDB is unavailable.');
    }
    const db = await openDatabase(idb, BOOTSTRAP_DB_NAME, 1, ensureBootstrapStores);
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('pointer', 'readwrite');
        tx.objectStore('pointer').put(pointer);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Bootstrap pointer write failed'));
        tx.onabort = () => reject(tx.error ?? new Error('Bootstrap pointer write aborted'));
      });
    } finally {
      db.close();
    }
  }

  async function openActiveWorkspaceDb(generation: number): Promise<IDBDatabase> {
    if (!idb) {
      throw new Error('IndexedDB is unavailable.');
    }
    return openDatabase(
      idb,
      `${WORKSPACE_DB_PREFIX}${generation}`,
      SCHEMA_VERSION_V1,
      ensureWorkspaceV1Stores,
    );
  }

  return {
    async runDiagnosticProbe() {
      if (!idb) {
        return { ok: false, error: 'IndexedDB API is not available in this browser context.' };
      }
      let db: IDBDatabase | undefined;
      try {
        db = await openDatabase(idb, DIAGNOSTICS_DB_NAME, 1, ensureDiagnosticsStores);
        const probeId = `probe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await new Promise<void>((resolve, reject) => {
          const tx = db!.transaction('probe', 'readwrite');
          const store = tx.objectStore('probe');
          store.put({ id: probeId, ts: Date.now() });
          store.delete(probeId);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error('Diagnostic transaction failed'));
          tx.onabort = () => reject(tx.error ?? new Error('Diagnostic transaction aborted'));
        });
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Diagnostic storage probe failed',
        };
      } finally {
        db?.close();
      }
    },

    async inspectRoot(): Promise<RootInspectionResult> {
      const pointerResult = await readBootstrapPointer();
      if (pointerResult.status === 'Unavailable' || pointerResult.status === 'Missing') {
        return { status: 'Empty' };
      }
      if (pointerResult.status === 'Corrupt') {
        return { status: 'IntegrityBlocked', reason: pointerResult.reason };
      }

      const { activeGeneration, schemaVersion } = pointerResult.pointer;
      let db: IDBDatabase | undefined;
      try {
        db = await openActiveWorkspaceDb(activeGeneration);
        const tx = db.transaction('workspace_meta', 'readonly');
        const meta = await requestToPromise(tx.objectStore('workspace_meta').get('singleton'));
        if (!isValidWorkspaceMeta(meta)) {
          return {
            status: 'IntegrityBlocked',
            reason: 'Active workspace metadata is missing or failed integrity validation.',
          };
        }
        return {
          status: 'Present',
          activeGeneration,
          schemaVersion,
          workspaceMeta: meta,
        };
      } catch (error) {
        return {
          status: 'IntegrityBlocked',
          reason: error instanceof Error ? error.message : 'Unable to read active workspace store.',
        };
      } finally {
        db?.close();
      }
    },

    async runReadTransaction<T>(
      stores: readonly StoreName[],
      fn: (tx: ReadTxHandle) => Promise<T>,
    ): Promise<T> {
      const pointerResult = await readBootstrapPointer();
      if (pointerResult.status === 'Unavailable') {
        throw new Error('IndexedDB is unavailable.');
      }
      if (pointerResult.status === 'Corrupt') {
        throw new Error(`Workspace root integrity blocked: ${pointerResult.reason}`);
      }
      if (pointerResult.status === 'Missing') {
        const emptyHandle: ReadTxHandle = {
          get: async () => undefined,
          getAll: async () => [],
        };
        return await fn(emptyHandle);
      }

      const db = await openActiveWorkspaceDb(pointerResult.pointer.activeGeneration);
      try {
        const tx = db.transaction([...stores], 'readonly');
        const handle: ReadTxHandle = {
          get: <S extends StoreName>(store: S, key: string) =>
            requestToPromise(tx.objectStore(store).get(key)) as Promise<
              StoreSchemaMap[S] | undefined
            >,
          getAll: <S extends StoreName>(store: S) =>
            requestToPromise(tx.objectStore(store).getAll()) as Promise<StoreSchemaMap[S][]>,
        };
        return await fn(handle);
      } finally {
        db.close();
      }
    },

    async runWriteTransaction<T>(
      stores: readonly StoreName[],
      fn: (tx: WriteTxHandle) => T | Promise<T>,
    ): Promise<WriteTransactionResult<T>> {
      const initialDecision = writeGate.checkWritable();
      if (!initialDecision.writable) {
        return {
          status: 'RuntimeNotWritable',
          reason: initialDecision.reason,
          failedChecks: initialDecision.failedChecks,
        };
      }

      const pointerResult = await readBootstrapPointer();
      if (pointerResult.status === 'Unavailable') {
        return {
          status: 'RuntimeNotWritable',
          reason: 'Unsupported',
          failedChecks: ['storage_diagnostic'],
        };
      }
      if (pointerResult.status === 'Corrupt') {
        return {
          status: 'RuntimeNotWritable',
          reason: 'IntegrityBlocked',
          failedChecks: ['storage_diagnostic'],
        };
      }

      const needsPointer = pointerResult.status === 'Missing';
      const generation = pointerResult.status === 'Valid' ? pointerResult.pointer.activeGeneration : 1;
      const db = await openActiveWorkspaceDb(generation);
      try {
        // Re-check write gate immediately before opening the readwrite transaction.
        const latestDecision = writeGate.checkWritable();
        if (!latestDecision.writable) {
          return {
            status: 'RuntimeNotWritable',
            reason: latestDecision.reason,
            failedChecks: latestDecision.failedChecks,
          };
        }

        let wroteWorkspaceMeta = false;

        const value = await new Promise<T>((resolve, reject) => {
          const tx = db.transaction([...stores], 'readwrite');
          let result!: T;
          let callbackError: unknown = null;
          let hasCallbackError = false;
          let callbackDone = false;
          let txDone = false;

          const tryResolve = () => {
            if (callbackDone && txDone && !hasCallbackError) {
              resolve(result);
            }
          };

          const handle: WriteTxHandle = {
            get: <S extends StoreName>(store: S, key: string) =>
              requestToPromise(tx.objectStore(store).get(key)) as Promise<
                StoreSchemaMap[S] | undefined
              >,
            getAll: <S extends StoreName>(store: S) =>
              requestToPromise(tx.objectStore(store).getAll()) as Promise<StoreSchemaMap[S][]>,
            put: <S extends StoreName>(store: S, record: StoreSchemaMap[S]) => {
              if (store === 'workspace_meta') {
                wroteWorkspaceMeta = true;
              }
              tx.objectStore(store).put(record);
            },
            delete: <S extends StoreName>(store: S, key: string) => {
              tx.objectStore(store).delete(key);
            },
          };

          tx.oncomplete = () => {
            txDone = true;
            tryResolve();
          };
          tx.onerror = () =>
            reject(hasCallbackError ? callbackError : (tx.error ?? new Error('Write transaction failed')));
          tx.onabort = () =>
            reject(hasCallbackError ? callbackError : (tx.error ?? new Error('Write transaction aborted')));

          Promise.resolve()
            .then(() => fn(handle))
            .then((res) => {
              result = res;
              callbackDone = true;
              tryResolve();
            })
            .catch((err) => {
              callbackError = err;
              hasCallbackError = true;
              try {
                tx.abort();
              } catch {
                reject(err);
              }
            });
        });

        if (needsPointer && wroteWorkspaceMeta) {
          await writeBootstrapPointer({
            key: 'active',
            activeGeneration: generation,
            schemaVersion: SCHEMA_VERSION_V1,
          });
        }

        return { status: 'Committed', value };
      } finally {
        db.close();
      }
    },
  };
}
