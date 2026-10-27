import { openDB, type IDBPDatabase, type IDBPTransaction } from 'idb';
import {
  DB_NAME_DEFAULT,
  SCHEMA_VERSION_V1,
  STORE_DIAGNOSTIC_PROBE,
  STORE_REFERENCE_CATALOG,
  STORE_WORKSPACE_META,
  isValidWorkspaceMetaRecord,
  type AuthoritativeStoreName,
  type StoredAccountRecord,
  type StoredCatalogRecord,
  type StoredInstitutionRecord,
  type WorkspaceMetaRecord,
} from './schema-v1';

export type RuntimeReadinessMode = 'Pending' | 'Writable' | 'RecoveryOnly' | 'Unsupported';

export type DiagnosticProbeResult =
  | {
      readonly ok: true;
      readonly probedAt: string;
    }
  | {
      readonly ok: false;
      readonly code: 'DiagnosticTransactionFailed';
      readonly message: string;
    };

export type StorageRootInspectionResult =
  | {
      readonly kind: 'FreshEmptyRoot';
    }
  | {
      readonly kind: 'ExistingReadableWorkspace';
      readonly meta: WorkspaceMetaRecord;
      readonly institutions: readonly StoredInstitutionRecord[];
      readonly accounts: readonly StoredAccountRecord[];
      readonly selectableAccountCount: number;
    }
  | {
      readonly kind: 'IntegrityBlockedRoot';
      readonly reason:
        | 'StorageOpenOrReadFailed'
        | 'CorruptOrPartialMetadata'
        | 'UnsupportedNewerSchemaVersion';
      readonly message: string;
    };

export type WriteTransactionResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: 'RuntimeNotWritable';
        readonly readiness: RuntimeReadinessMode;
        readonly message: string;
      };
    };

export interface TransactionManagerOptions {
  readonly dbName?: string;
  readonly initialReadiness?: RuntimeReadinessMode;
}

export class TransactionManager {
  private readonly dbName: string;
  private readinessMode: RuntimeReadinessMode;
  private dbPromise: Promise<IDBPDatabase> | null = null;
  private injectedProbeFailure: string | null = null;
  private injectedStorageReadFailure: string | null = null;
  private injectedKnownUnreadableRoot = false;
  private injectedMidSessionFailure: string | null = null;

  constructor(options: TransactionManagerOptions = {}) {
    this.dbName = options.dbName ?? DB_NAME_DEFAULT;
    this.readinessMode = options.initialReadiness ?? 'Pending';
  }

  public getReadinessMode(): RuntimeReadinessMode {
    return this.readinessMode;
  }

  public setReadinessMode(mode: RuntimeReadinessMode): void {
    this.readinessMode = mode;
  }

  public injectFaults(faults: {
    readonly probeFailure?: string | null;
    readonly storageReadFailure?: string | null;
    readonly knownUnreadableRoot?: boolean;
    readonly midSessionFailure?: string | null;
  }): void {
    if (faults.probeFailure !== undefined) {
      this.injectedProbeFailure = faults.probeFailure;
    }
    if (faults.storageReadFailure !== undefined) {
      this.injectedStorageReadFailure = faults.storageReadFailure;
    }
    if (faults.knownUnreadableRoot !== undefined) {
      this.injectedKnownUnreadableRoot = faults.knownUnreadableRoot;
    }
    if (faults.midSessionFailure !== undefined) {
      this.injectedMidSessionFailure = faults.midSessionFailure;
      if (faults.midSessionFailure) {
        this.readinessMode = 'RecoveryOnly';
      }
    }
  }

  private async getDb(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(this.dbName, SCHEMA_VERSION_V1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_WORKSPACE_META)) {
            db.createObjectStore(STORE_WORKSPACE_META, { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains(STORE_REFERENCE_CATALOG)) {
            const store = db.createObjectStore(STORE_REFERENCE_CATALOG, { keyPath: 'id' });
            store.createIndex('by_kind', 'kind', { unique: false });
          }
          if (!db.objectStoreNames.contains(STORE_DIAGNOSTIC_PROBE)) {
            db.createObjectStore(STORE_DIAGNOSTIC_PROBE, { keyPath: 'probeKey' });
          }
        },
      });
    }
    return this.dbPromise;
  }

  public async close(): Promise<void> {
    if (this.dbPromise) {
      const db = await this.dbPromise;
      db.close();
      this.dbPromise = null;
    }
  }

  public async runDiagnosticProbeTransaction(
    nowIso = new Date().toISOString(),
  ): Promise<DiagnosticProbeResult> {
    if (this.injectedProbeFailure) {
      return {
        ok: false,
        code: 'DiagnosticTransactionFailed',
        message: this.injectedProbeFailure,
      };
    }

    try {
      const db = await this.getDb();
      const tx = db.transaction(STORE_DIAGNOSTIC_PROBE, 'readwrite');
      const store = tx.objectStore(STORE_DIAGNOSTIC_PROBE);
      await store.put({ probeKey: 'startup-probe', probedAt: nowIso });
      await store.delete('startup-probe');
      await tx.done;
      return {
        ok: true,
        probedAt: nowIso,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        code: 'DiagnosticTransactionFailed',
        message: `IndexedDB diagnostic readwrite transaction failed: ${message}`,
      };
    }
  }

  public async inspectStorageRoot(): Promise<StorageRootInspectionResult> {
    if (this.injectedKnownUnreadableRoot || this.injectedStorageReadFailure) {
      return {
        kind: 'IntegrityBlockedRoot',
        reason: 'StorageOpenOrReadFailed',
        message:
          this.injectedStorageReadFailure ??
          'Existing workspace storage root is known to exist on this origin but could not be opened or read cleanly.',
      };
    }

    try {
      const db = await this.getDb();
      const tx = db.transaction([STORE_WORKSPACE_META, STORE_REFERENCE_CATALOG], 'readonly');
      const metaRaw = (await tx.objectStore(STORE_WORKSPACE_META).get('root')) as unknown;
      const catalogRecords = (await tx
        .objectStore(STORE_REFERENCE_CATALOG)
        .getAll()) as StoredCatalogRecord[];
      await tx.done;

      if (metaRaw === undefined && catalogRecords.length === 0) {
        return { kind: 'FreshEmptyRoot' };
      }

      if (metaRaw === undefined && catalogRecords.length > 0) {
        return {
          kind: 'IntegrityBlockedRoot',
          reason: 'CorruptOrPartialMetadata',
          message:
            'Workspace metadata is missing while catalog records exist. Refusing to treat storage root as fresh or overwrite existing records.',
        };
      }

      if (metaRaw && typeof metaRaw === 'object') {
        const version = (metaRaw as Record<string, unknown>).schemaVersion;
        if (typeof version === 'number' && version > SCHEMA_VERSION_V1) {
          return {
            kind: 'IntegrityBlockedRoot',
            reason: 'UnsupportedNewerSchemaVersion',
            message: `Stored workspace schema version (${version}) is newer than this release supports (${SCHEMA_VERSION_V1}).`,
          };
        }
      }

      if (!isValidWorkspaceMetaRecord(metaRaw)) {
        return {
          kind: 'IntegrityBlockedRoot',
          reason: 'CorruptOrPartialMetadata',
          message:
            'Stored workspace metadata is corrupt or incomplete. Refusing automatic initialization or destructive overwrite.',
        };
      }

      const institutions: StoredInstitutionRecord[] = [];
      const accounts: StoredAccountRecord[] = [];

      for (const rec of catalogRecords) {
        if (!rec || typeof rec !== 'object') {
          return {
            kind: 'IntegrityBlockedRoot',
            reason: 'CorruptOrPartialMetadata',
            message: 'Reference catalog contains an unreadable or malformed record.',
          };
        }
        if (rec.kind === 'Institution') {
          institutions.push(rec);
        } else if (rec.kind === 'Account') {
          accounts.push(rec);
        } else {
          return {
            kind: 'IntegrityBlockedRoot',
            reason: 'CorruptOrPartialMetadata',
            message: 'Reference catalog contains an unrecognized record kind.',
          };
        }
      }

      const selectableAccountCount = accounts.filter(
        (acct) => acct.availability === 'Selectable',
      ).length;

      return {
        kind: 'ExistingReadableWorkspace',
        meta: metaRaw,
        institutions,
        accounts,
        selectableAccountCount,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        kind: 'IntegrityBlockedRoot',
        reason: 'StorageOpenOrReadFailed',
        message: `Failed to inspect local workspace storage root: ${message}`,
      };
    }
  }

  public async executeWriteTransaction<T>(
    stores: readonly AuthoritativeStoreName[],
    mutator: (
      tx: IDBPTransaction<unknown, AuthoritativeStoreName[], 'readwrite'>,
    ) => Promise<T>,
  ): Promise<WriteTransactionResult<T>> {
    if (this.injectedMidSessionFailure) {
      this.readinessMode = 'RecoveryOnly';
    }

    if (this.readinessMode !== 'Writable') {
      return {
        ok: false,
        error: {
          kind: 'RuntimeNotWritable',
          readiness: this.readinessMode,
          message: `Cannot execute authoritative write transaction while RuntimeReadiness is '${this.readinessMode}'.`,
        },
      };
    }

    const db = await this.getDb();
    const tx = db.transaction([...stores], 'readwrite');
    try {
      const value = await mutator(tx);
      await tx.done;
      return { ok: true, value };
    } catch (err) {
      try {
        tx.abort();
      } catch {
        // Transaction may already be aborted
      }
      await tx.done.catch(() => {});
      throw err;
    }
  }

  public async _unsafeWriteRawForTesting(
    storeName: typeof STORE_WORKSPACE_META | typeof STORE_REFERENCE_CATALOG,
    record: unknown,
  ): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(storeName, 'readwrite');
    await tx.objectStore(storeName).put(record);
    await tx.done;
  }
}
