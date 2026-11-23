import {
  BOOTSTRAP_DB_NAME,
  ensureWorkspaceV2Stores,
  ensureWorkspaceV3Stores,
  ensureWorkspaceV4Stores,
  ensureWorkspaceV5Stores,
  ensureWorkspaceV6Stores,
  SCHEMA_VERSION_V1,
  SCHEMA_VERSION_V2,
  SCHEMA_VERSION_V3,
  SCHEMA_VERSION_V4,
  SCHEMA_VERSION_V5,
  SCHEMA_VERSION_V6,
  WORKSPACE_DB_PREFIX,
  type WorkspaceMetaRecord,
} from './idb';

export type MigrationResult =
  | {
      readonly status: 'Migrated';
      readonly fromGeneration: number;
      readonly toGeneration: number;
      readonly fromSchemaVersion: number;
      readonly toSchemaVersion: number;
    }
  | {
      readonly status: 'MigrationBlocked';
      readonly reason: string;
    };

export interface WorkspaceMigrationOptions {
  readonly indexedDB: IDBFactory;
  readonly fromGeneration: number;
  readonly injectFailureStage?: 'after_copy';
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IDB request failed'));
  });
}

function openRaw(
  idb: IDBFactory,
  name: string,
  version: number,
  onUpgrade?: (db: IDBDatabase) => void,
): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = idb.open(name, version);
    req.onupgradeneeded = () => {
      onUpgrade?.(req.result);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error(`Failed to open ${name}`));
    req.onblocked = () => reject(new Error(`Opening ${name} was blocked`));
  });
}

function deleteDb(idb: IDBFactory, name: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const req = idb.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

/**
 * Shared generation-isolated forward migration helper.
 * Derives copied stores from `sourceDb.objectStoreNames`, copies all rows into a fresh
 * candidate DB (`gen N+1`) initialized with `ensureTargetStores`, verifies exact row counts
 * via `count()`, and atomically flips `tjv3_bootstrap` to `gen N+1`.
 * Any failure before pointer flip deletes the candidate DB and leaves `gen N` untouched.
 */
async function runCandidateCopyMigration(config: {
  readonly indexedDB: IDBFactory;
  readonly fromGeneration: number;
  readonly fromSchemaVersion: number;
  readonly toSchemaVersion: number;
  readonly ensureTargetStores: (db: IDBDatabase) => void;
  readonly injectFailureStage?: 'after_copy';
}): Promise<MigrationResult> {
  const {
    indexedDB: idb,
    fromGeneration,
    fromSchemaVersion,
    toSchemaVersion,
    ensureTargetStores,
    injectFailureStage,
  } = config;
  const toGeneration = fromGeneration + 1;
  const sourceName = `${WORKSPACE_DB_PREFIX}${fromGeneration}`;
  const candidateName = `${WORKSPACE_DB_PREFIX}${toGeneration}`;

  let sourceDb: IDBDatabase | undefined;
  let candidateDb: IDBDatabase | undefined;
  let bootstrapDb: IDBDatabase | undefined;
  let pointerFlipped = false;

  try {
    bootstrapDb = await openRaw(idb, BOOTSTRAP_DB_NAME, 1);
    const preCheck = (await reqToPromise(
      bootstrapDb.transaction('pointer', 'readonly').objectStore('pointer').get('active'),
    )) as { activeGeneration?: number; schemaVersion?: number } | undefined;
    bootstrapDb.close();
    bootstrapDb = undefined;

    if (
      preCheck?.schemaVersion === toSchemaVersion &&
      (preCheck.activeGeneration ?? 0) >= toGeneration
    ) {
      return {
        status: 'Migrated',
        fromGeneration,
        toGeneration: preCheck.activeGeneration!,
        fromSchemaVersion,
        toSchemaVersion,
      };
    }
    if (
      preCheck?.activeGeneration !== fromGeneration ||
      preCheck?.schemaVersion !== fromSchemaVersion
    ) {
      return {
        status: 'MigrationBlocked',
        reason: `Bootstrap pointer changed before v${fromSchemaVersion}->v${toSchemaVersion} migration started.`,
      };
    }

    sourceDb = await openRaw(idb, sourceName, fromSchemaVersion);
    const sourceStores = Array.from(sourceDb.objectStoreNames);
    if (!sourceStores.includes('workspace_meta')) {
      sourceDb.close();
      sourceDb = undefined;
      return {
        status: 'MigrationBlocked',
        reason: `Source v${fromSchemaVersion} workspace_meta store is missing; cannot migrate.`,
      };
    }

    const readTx = sourceDb.transaction(sourceStores, 'readonly');
    const storeData = new Map<string, unknown[]>();
    await Promise.all(
      sourceStores.map(async (storeName) => {
        const rows = (await reqToPromise(readTx.objectStore(storeName).getAll())) as unknown[];
        storeData.set(storeName, rows);
      }),
    );
    sourceDb.close();
    sourceDb = undefined;

    const metaRows = (storeData.get('workspace_meta') ?? []) as WorkspaceMetaRecord[];
    const workspaceMeta = metaRows.find((r) => r.key === 'singleton');
    if (!workspaceMeta) {
      return {
        status: 'MigrationBlocked',
        reason: `Source v${fromSchemaVersion} workspace_meta singleton is missing; cannot migrate.`,
      };
    }

    await deleteDb(idb, candidateName);
    candidateDb = await openRaw(idb, candidateName, toSchemaVersion, ensureTargetStores);

    const missingInTarget = sourceStores.filter((s) => !candidateDb!.objectStoreNames.contains(s));
    if (missingInTarget.length > 0) {
      throw new Error(
        `Candidate v${toSchemaVersion} schema lacks source stores: ${missingInTarget.join(', ')}`,
      );
    }

    await new Promise<void>((resolve, reject) => {
      const tx = candidateDb!.transaction(sourceStores, 'readwrite');
      for (const storeName of sourceStores) {
        const rows = storeData.get(storeName) ?? [];
        const objStore = tx.objectStore(storeName);
        for (const row of rows) {
          if (storeName === 'workspace_meta') {
            objStore.put({ ...(row as WorkspaceMetaRecord), schemaVersion: toSchemaVersion });
          } else {
            objStore.put(row);
          }
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error(`Candidate v${toSchemaVersion} migration write failed`));
      tx.onabort = () =>
        reject(tx.error ?? new Error(`Candidate v${toSchemaVersion} migration write aborted`));
    });

    // Controlled failure hook for rollback verification (AC-REST-004)
    if (injectFailureStage === 'after_copy') {
      throw new Error(
        `Injected v${fromSchemaVersion}->v${toSchemaVersion} migration failure after candidate copy.`,
      );
    }

    // Verify exact row counts across all copied stores before pointer flip
    const verifyTx = candidateDb.transaction(sourceStores, 'readonly');
    const countsOk = await Promise.all(
      sourceStores.map(async (storeName) => {
        const copied = await reqToPromise(verifyTx.objectStore(storeName).count());
        return copied === (storeData.get(storeName)?.length ?? 0);
      }),
    );
    if (countsOk.some((ok) => !ok)) {
      throw new Error(`Candidate v${toSchemaVersion} migration verification count mismatch.`);
    }

    candidateDb.close();
    candidateDb = undefined;

    bootstrapDb = await openRaw(idb, BOOTSTRAP_DB_NAME, 1);
    await new Promise<void>((resolve, reject) => {
      const tx = bootstrapDb!.transaction('pointer', 'readwrite');
      tx.objectStore('pointer').put({
        key: 'active',
        activeGeneration: toGeneration,
        schemaVersion: toSchemaVersion,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error(`Bootstrap pointer v${toSchemaVersion} flip failed`));
      tx.onabort = () =>
        reject(tx.error ?? new Error(`Bootstrap pointer v${toSchemaVersion} flip aborted`));
    });
    pointerFlipped = true;
    bootstrapDb.close();
    bootstrapDb = undefined;

    return {
      status: 'Migrated',
      fromGeneration,
      toGeneration,
      fromSchemaVersion,
      toSchemaVersion,
    };
  } catch (error) {
    sourceDb?.close();
    candidateDb?.close();
    bootstrapDb?.close();
    if (!pointerFlipped) {
      await deleteDb(idb, candidateName);
    }
    return {
      status: 'MigrationBlocked',
      reason:
        error instanceof Error
          ? error.message
          : `v${fromSchemaVersion}->v${toSchemaVersion} migration failed; prior workspace intact.`,
    };
  }
}

export function migrateWorkspaceV1ToV2(
  options: WorkspaceMigrationOptions,
): Promise<MigrationResult> {
  return runCandidateCopyMigration({
    ...options,
    fromSchemaVersion: SCHEMA_VERSION_V1,
    toSchemaVersion: SCHEMA_VERSION_V2,
    ensureTargetStores: ensureWorkspaceV2Stores,
  });
}

export function migrateWorkspaceV2ToV3(
  options: WorkspaceMigrationOptions,
): Promise<MigrationResult> {
  return runCandidateCopyMigration({
    ...options,
    fromSchemaVersion: SCHEMA_VERSION_V2,
    toSchemaVersion: SCHEMA_VERSION_V3,
    ensureTargetStores: ensureWorkspaceV3Stores,
  });
}

export function migrateWorkspaceV3ToV4(
  options: WorkspaceMigrationOptions,
): Promise<MigrationResult> {
  return runCandidateCopyMigration({
    ...options,
    fromSchemaVersion: SCHEMA_VERSION_V3,
    toSchemaVersion: SCHEMA_VERSION_V4,
    ensureTargetStores: ensureWorkspaceV4Stores,
  });
}

export function migrateWorkspaceV4ToV5(
  options: WorkspaceMigrationOptions,
): Promise<MigrationResult> {
  return runCandidateCopyMigration({
    ...options,
    fromSchemaVersion: SCHEMA_VERSION_V4,
    toSchemaVersion: SCHEMA_VERSION_V5,
    ensureTargetStores: ensureWorkspaceV5Stores,
  });
}

export function migrateWorkspaceV5ToV6(
  options: WorkspaceMigrationOptions,
): Promise<MigrationResult> {
  return runCandidateCopyMigration({
    ...options,
    fromSchemaVersion: SCHEMA_VERSION_V5,
    toSchemaVersion: SCHEMA_VERSION_V6,
    ensureTargetStores: ensureWorkspaceV6Stores,
  });
}
