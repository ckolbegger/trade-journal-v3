import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  createPersistenceSeam,
  SCHEMA_VERSION_V1,
  type RuntimeWriteGate,
} from '../../src/persistence/idb';

function makeTestIdb(): IDBFactory {
  return new IDBFactory();
}

function makeGate(writable: boolean): RuntimeWriteGate {
  return {
    checkWritable: () =>
      writable
        ? { writable: true }
        : {
            writable: false,
            reason: 'RecoveryOnly',
            failedChecks: ['service_worker_control'],
          },
  };
}

describe('Persistence/Transaction seam', () => {
  it('completes an isolated diagnostic transaction without creating authoritative workspace records', async () => {
    const idb = makeTestIdb();
    const persistence = createPersistenceSeam({
      indexedDB: idb,
      writeGate: makeGate(true),
    });

    const diag = await persistence.runDiagnosticProbe();
    expect(diag).toEqual({ ok: true });

    const inspection = await persistence.inspectRoot();
    expect(inspection.status).toBe('Empty');
  });

  it('rejects writes with RuntimeNotWritable and leaves authoritative state untouched when gate is not Writable', async () => {
    const idb = makeTestIdb();
    let isWritable = true;
    const persistence = createPersistenceSeam({
      indexedDB: idb,
      writeGate: {
        checkWritable: () =>
          isWritable
            ? { writable: true }
            : {
                writable: false,
                reason: 'RecoveryOnly',
                failedChecks: ['offline_inventory'],
              },
      },
    });

    const seeded = await persistence.runWriteTransaction(['workspace_meta'], (tx) => {
      tx.put('workspace_meta', {
        key: 'singleton',
        schemaVersion: SCHEMA_VERSION_V1,
        timeZone: 'America/New_York',
        settingsRevision: 1,
        workspaceRevision: 1,
        initializedAt: '2026-11-23T00:00:00.000Z',
        updatedAt: '2026-11-23T00:00:00.000Z',
      });
      return 'seeded';
    });
    expect(seeded).toEqual({ status: 'Committed', value: 'seeded' });

    isWritable = false;

    const blocked = await persistence.runWriteTransaction(['workspace_meta'], (tx) => {
      tx.put('workspace_meta', {
        key: 'singleton',
        schemaVersion: SCHEMA_VERSION_V1,
        timeZone: 'America/Chicago',
        settingsRevision: 2,
        workspaceRevision: 2,
        initializedAt: '2026-11-23T00:00:00.000Z',
        updatedAt: '2026-11-23T01:00:00.000Z',
      });
      return 'mutated';
    });

    expect(blocked).toEqual({
      status: 'RuntimeNotWritable',
      reason: 'RecoveryOnly',
      failedChecks: ['offline_inventory'],
    });

    const readBack = await persistence.runReadTransaction(['workspace_meta'], async (tx) =>
      tx.get('workspace_meta', 'singleton'),
    );
    expect(readBack?.timeZone).toBe('America/New_York');
    expect(readBack?.workspaceRevision).toBe(1);
  });

  it('rolls back all stores atomically including workspace_meta when a write transaction fails partway through', async () => {
    const idb = makeTestIdb();
    const persistence = createPersistenceSeam({
      indexedDB: idb,
      writeGate: makeGate(true),
    });

    await expect(
      persistence.runWriteTransaction(['workspace_meta', 'catalog_institutions'], (tx) => {
        tx.put('workspace_meta', {
          key: 'singleton',
          schemaVersion: SCHEMA_VERSION_V1,
          timeZone: 'America/New_York',
          settingsRevision: 1,
          workspaceRevision: 1,
          initializedAt: '2026-11-23T00:00:00.000Z',
          updatedAt: '2026-11-23T00:00:00.000Z',
        });
        tx.put('catalog_institutions', {
          id: 'inst-1',
          currentLabel: 'Fidelity',
          normalizedLabel: 'fidelity',
          status: 'Active',
          revision: 1,
          createdAt: '2026-11-23T00:00:00.000Z',
          updatedAt: '2026-11-23T00:00:00.000Z',
          history: [],
        });
        throw new Error('simulated mid-transaction failure');
      }),
    ).rejects.toThrow('simulated mid-transaction failure');

    const inspection = await persistence.inspectRoot();
    expect(inspection.status).toBe('Empty');

    // Verify directly against the underlying IDB store that neither record survived rollback
    const rawCounts = await new Promise<{ meta: unknown; instCount: number }>((resolve, reject) => {
      const req = idb.open('tjv3_ws_gen_1', 1);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['workspace_meta', 'catalog_institutions'], 'readonly');
        const metaReq = tx.objectStore('workspace_meta').get('singleton');
        const instReq = tx.objectStore('catalog_institutions').getAll();
        tx.oncomplete = () => {
          db.close();
          resolve({ meta: metaReq.result, instCount: instReq.result.length });
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
    expect(rawCounts).toEqual({ meta: undefined, instCount: 0 });
  });

  it('supports atomic read-modify-write inside a single readwrite transaction', async () => {
    const idb = makeTestIdb();
    const persistence = createPersistenceSeam({
      indexedDB: idb,
      writeGate: makeGate(true),
    });

    const first = await persistence.runWriteTransaction(['workspace_meta'], async (tx) => {
      const existing = await tx.get('workspace_meta', 'singleton');
      expect(existing).toBeUndefined();
      tx.put('workspace_meta', {
        key: 'singleton',
        schemaVersion: SCHEMA_VERSION_V1,
        timeZone: 'America/New_York',
        settingsRevision: 1,
        workspaceRevision: 1,
        initializedAt: '2026-11-23T00:00:00.000Z',
        updatedAt: '2026-11-23T00:00:00.000Z',
      });
      return 'created';
    });
    expect(first).toEqual({ status: 'Committed', value: 'created' });

    const second = await persistence.runWriteTransaction(['workspace_meta'], async (tx) => {
      const existing = await tx.get('workspace_meta', 'singleton');
      expect(existing?.timeZone).toBe('America/New_York');
      tx.put('workspace_meta', {
        ...existing!,
        timeZone: 'America/Chicago',
        settingsRevision: 2,
        workspaceRevision: 2,
      });
      return 'updated';
    });
    expect(second).toEqual({ status: 'Committed', value: 'updated' });

    const readBack = await persistence.runReadTransaction(['workspace_meta'], (tx) =>
      tx.get('workspace_meta', 'singleton'),
    );
    expect(readBack?.timeZone).toBe('America/Chicago');
  });

  it('reports IntegrityBlocked rather than Empty when an existing bootstrap root is corrupted or workspace_meta is missing', async () => {
    const idb = makeTestIdb();
    const persistence = createPersistenceSeam({
      indexedDB: idb,
      writeGate: makeGate(true),
    });

    await persistence.runWriteTransaction(['workspace_meta'], (tx) => {
      tx.put('workspace_meta', {
        key: 'singleton',
        schemaVersion: SCHEMA_VERSION_V1,
        timeZone: 'America/New_York',
        settingsRevision: 1,
        workspaceRevision: 1,
        initializedAt: '2026-11-23T00:00:00.000Z',
        updatedAt: '2026-11-23T00:00:00.000Z',
      });
    });

    // Corrupt bootstrap pointer
    await new Promise<void>((resolve, reject) => {
      const req = idb.open('tjv3_bootstrap', 1);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('pointer', 'readwrite');
        tx.objectStore('pointer').put({
          key: 'active',
          activeGeneration: -99,
          schemaVersion: 'corrupt',
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    const inspection = await persistence.inspectRoot();
    expect(inspection.status).toBe('IntegrityBlocked');

    // Writes must be rejected with IntegrityBlocked after corruption
    const blocked = await persistence.runWriteTransaction(['workspace_meta'], () => 'nope');
    expect(blocked.status).toBe('RuntimeNotWritable');
    if (blocked.status === 'RuntimeNotWritable') {
      expect(blocked.reason).toBe('IntegrityBlocked');
    }
  });
});
