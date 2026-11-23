import {
  BOOTSTRAP_DB_NAME,
  ensureWorkspaceV2Stores,
  SCHEMA_VERSION_V2,
  WORKSPACE_DB_PREFIX,
  type AccountRecord,
  type CatalogMetaRecord,
  type InstitutionRecord,
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
 * Generation-isolated forward migration from Schema v1 to Schema v2.
 * Copies all authoritative v1 records into a new candidate database (gen N+1),
 * validates candidate completeness, and only then flips tjv3_bootstrap to gen N+1.
 * Any error discards the candidate DB and leaves gen N untouched.
 */
export async function migrateWorkspaceV1ToV2(options: {
  readonly indexedDB: IDBFactory;
  readonly fromGeneration: number;
  readonly injectFailureStage?: 'after_copy';
}): Promise<MigrationResult> {
  const { indexedDB: idb, fromGeneration, injectFailureStage } = options;
  const toGeneration = fromGeneration + 1;
  const sourceName = `${WORKSPACE_DB_PREFIX}${fromGeneration}`;
  const candidateName = `${WORKSPACE_DB_PREFIX}${toGeneration}`;

  let sourceDb: IDBDatabase | undefined;
  let candidateDb: IDBDatabase | undefined;
  let bootstrapDb: IDBDatabase | undefined;

  try {
    // Confirm bootstrap pointer still points at fromGeneration / v1 before touching candidate DB
    bootstrapDb = await openRaw(idb, BOOTSTRAP_DB_NAME, 1);
    const preCheck = (await reqToPromise(
      bootstrapDb.transaction('pointer', 'readonly').objectStore('pointer').get('active'),
    )) as { activeGeneration?: number; schemaVersion?: number } | undefined;
    bootstrapDb.close();
    bootstrapDb = undefined;

    if (preCheck?.schemaVersion === SCHEMA_VERSION_V2 && (preCheck.activeGeneration ?? 0) >= toGeneration) {
      return {
        status: 'Migrated',
        fromGeneration,
        toGeneration: preCheck.activeGeneration!,
        fromSchemaVersion: 1,
        toSchemaVersion: SCHEMA_VERSION_V2,
      };
    }
    if (preCheck?.activeGeneration !== fromGeneration || preCheck?.schemaVersion !== 1) {
      return {
        status: 'MigrationBlocked',
        reason: 'Bootstrap pointer changed before migration started.',
      };
    }

    sourceDb = await openRaw(idb, sourceName, 1);
    const readTx = sourceDb.transaction(
      ['workspace_meta', 'catalog_meta', 'catalog_institutions', 'catalog_accounts'],
      'readonly',
    );
    const [workspaceMeta, catalogMeta, institutions, accounts] = (await Promise.all([
      reqToPromise(readTx.objectStore('workspace_meta').get('singleton')),
      reqToPromise(readTx.objectStore('catalog_meta').get('singleton')),
      reqToPromise(readTx.objectStore('catalog_institutions').getAll()),
      reqToPromise(readTx.objectStore('catalog_accounts').getAll()),
    ])) as [
      WorkspaceMetaRecord | undefined,
      CatalogMetaRecord | undefined,
      InstitutionRecord[],
      AccountRecord[],
    ];
    sourceDb.close();
    sourceDb = undefined;

    if (!workspaceMeta) {
      return {
        status: 'MigrationBlocked',
        reason: 'Source v1 workspace_meta is missing; cannot migrate.',
      };
    }

    // Create fresh isolated candidate DB at Schema v2
    await deleteDb(idb, candidateName);
    candidateDb = await openRaw(idb, candidateName, SCHEMA_VERSION_V2, ensureWorkspaceV2Stores);

    const migratedWorkspaceMeta: WorkspaceMetaRecord = {
      ...workspaceMeta,
      schemaVersion: SCHEMA_VERSION_V2,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = candidateDb!.transaction(
        ['workspace_meta', 'catalog_meta', 'catalog_institutions', 'catalog_accounts'],
        'readwrite',
      );
      tx.objectStore('workspace_meta').put(migratedWorkspaceMeta);
      if (catalogMeta) {
        tx.objectStore('catalog_meta').put(catalogMeta);
      }
      for (const inst of institutions) {
        tx.objectStore('catalog_institutions').put(inst);
      }
      for (const acct of accounts) {
        tx.objectStore('catalog_accounts').put(acct);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Candidate migration write failed'));
      tx.onabort = () => reject(tx.error ?? new Error('Candidate migration write aborted'));
    });

    // Controlled failure hook for rollback verification (AC-REST-004)
    if (injectFailureStage === 'after_copy') {
      throw new Error('Injected migration failure after candidate copy.');
    }

    // Validate candidate before pointer flip
    const verifyTx = candidateDb.transaction(
      ['workspace_meta', 'catalog_institutions', 'catalog_accounts'],
      'readonly',
    );
    const [vMeta, vInsts, vAccts] = await Promise.all([
      reqToPromise(verifyTx.objectStore('workspace_meta').get('singleton')),
      reqToPromise(verifyTx.objectStore('catalog_institutions').getAll()),
      reqToPromise(verifyTx.objectStore('catalog_accounts').getAll()),
    ]);
    if (
      !vMeta ||
      vInsts.length !== institutions.length ||
      vAccts.length !== accounts.length
    ) {
      throw new Error('Candidate migration verification count mismatch.');
    }
    candidateDb.close();
    candidateDb = undefined;

    // Atomically flip bootstrap pointer to the new generation
    bootstrapDb = await openRaw(idb, BOOTSTRAP_DB_NAME, 1);
    await new Promise<void>((resolve, reject) => {
      const tx = bootstrapDb!.transaction('pointer', 'readwrite');
      tx.objectStore('pointer').put({
        key: 'active',
        activeGeneration: toGeneration,
        schemaVersion: SCHEMA_VERSION_V2,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Bootstrap pointer flip failed'));
      tx.onabort = () => reject(tx.error ?? new Error('Bootstrap pointer flip aborted'));
    });
    bootstrapDb.close();
    bootstrapDb = undefined;

    return {
      status: 'Migrated',
      fromGeneration,
      toGeneration,
      fromSchemaVersion: 1,
      toSchemaVersion: SCHEMA_VERSION_V2,
    };
  } catch (error) {
    sourceDb?.close();
    candidateDb?.close();
    bootstrapDb?.close();
    await deleteDb(idb, candidateName);
    return {
      status: 'MigrationBlocked',
      reason: error instanceof Error ? error.message : 'Migration failed; prior workspace intact.',
    };
  }
}
