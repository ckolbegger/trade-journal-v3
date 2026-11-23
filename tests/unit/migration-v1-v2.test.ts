import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createPersistenceSeam } from '../../src/persistence/idb';
import { migrateWorkspaceV1ToV2 } from '../../src/persistence/migrations';

describe('Generation-isolated migration v1 -> v2 seam', () => {
  it('migrates v1 workspace and catalog records into generation 2 atomically and rolls back cleanly on controlled failure', async () => {
    const idb = new IDBFactory();

    // Seed a genuine v1 workspace in tjv3_bootstrap + tjv3_ws_gen_1
    await new Promise<void>((resolve, reject) => {
      const req = idb.open('tjv3_bootstrap', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('pointer', { keyPath: 'key' });
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('pointer', 'readwrite');
        tx.objectStore('pointer').put({ key: 'active', activeGeneration: 1, schemaVersion: 1 });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    await new Promise<void>((resolve, reject) => {
      const req = idb.open('tjv3_ws_gen_1', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('workspace_meta', { keyPath: 'key' });
        db.createObjectStore('catalog_meta', { keyPath: 'key' });
        db.createObjectStore('catalog_institutions', { keyPath: 'id' });
        db.createObjectStore('catalog_accounts', { keyPath: 'id' });
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(
          ['workspace_meta', 'catalog_meta', 'catalog_institutions', 'catalog_accounts'],
          'readwrite',
        );
        tx.objectStore('workspace_meta').put({
          key: 'singleton',
          schemaVersion: 1,
          timeZone: 'America/New_York',
          settingsRevision: 2,
          workspaceRevision: 3,
          initializedAt: '2026-11-22T00:00:00.000Z',
          updatedAt: '2026-11-22T12:00:00.000Z',
        });
        tx.objectStore('catalog_meta').put({
          key: 'singleton',
          catalogRevision: 2,
          seedManifestVersion: 1,
          seededAt: '2026-11-22T00:00:00.000Z',
        });
        tx.objectStore('catalog_institutions').put({
          id: 'inst_1',
          currentLabel: 'Fidelity',
          normalizedLabel: 'fidelity',
          status: 'Active',
          revision: 1,
          createdAt: '2026-11-22T00:00:00.000Z',
          updatedAt: '2026-11-22T00:00:00.000Z',
          history: [],
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    // Controlled failure must leave generation 1 intact and bootstrap pointer at v1
    const failed = await migrateWorkspaceV1ToV2({
      indexedDB: idb,
      fromGeneration: 1,
      injectFailureStage: 'after_copy',
    });
    expect(failed.status).toBe('MigrationBlocked');

    const persistence = createPersistenceSeam({
      indexedDB: idb,
      writeGate: { checkWritable: () => ({ writable: true }) },
    });
    const beforeSuccess = await persistence.inspectRoot();
    expect(beforeSuccess.status).toBe('Present');
    if (beforeSuccess.status === 'Present') {
      expect(beforeSuccess.activeGeneration).toBe(1);
      expect(beforeSuccess.schemaVersion).toBe(1);
    }

    // Real migration succeeds, flips pointer to gen 2 / schemaVersion 2, preserves Fidelity
    const succeeded = await migrateWorkspaceV1ToV2({
      indexedDB: idb,
      fromGeneration: 1,
    });
    expect(succeeded.status).toBe('Migrated');
    if (succeeded.status !== 'Migrated') return;
    expect(succeeded.toGeneration).toBe(2);
    expect(succeeded.toSchemaVersion).toBe(2);

    const afterSuccess = await persistence.inspectRoot();
    expect(afterSuccess.status).toBe('Present');
    if (afterSuccess.status === 'Present') {
      expect(afterSuccess.activeGeneration).toBe(2);
      expect(afterSuccess.schemaVersion).toBe(2);
      expect(afterSuccess.workspaceMeta.timeZone).toBe('America/New_York');
    }

    const institutions = await persistence.runReadTransaction(['catalog_institutions'], (tx) =>
      tx.getAll('catalog_institutions'),
    );
    expect(institutions.map((i) => i.currentLabel)).toEqual(['Fidelity']);
  });
});
