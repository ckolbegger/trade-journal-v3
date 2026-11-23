import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  BOOTSTRAP_DB_NAME,
  createPersistenceSeam,
  ensureWorkspaceV5Stores,
} from '../../src/persistence/idb';
import { migrateWorkspaceV5ToV6 } from '../../src/persistence/migrations';

describe('Generation-isolated migration v5 -> v6 seam', () => {
  it('rolls back cleanly on controlled failure and completes v5 -> v6 migration on retry preserving data and creating v6 stores', async () => {
    const idb = new IDBFactory();

    await new Promise<void>((resolve, reject) => {
      const req = idb.open(BOOTSTRAP_DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('pointer', { keyPath: 'key' });
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('pointer', 'readwrite');
        tx.objectStore('pointer').put({ key: 'active', activeGeneration: 1, schemaVersion: 5 });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    await new Promise<void>((resolve, reject) => {
      const req = idb.open('tjv3_ws_gen_1', 5);
      req.onupgradeneeded = () => {
        ensureWorkspaceV5Stores(req.result);
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(
          ['workspace_meta', 'catalog_meta', 'trades', 'journal_entries', 'market_marks'],
          'readwrite',
        );
        tx.objectStore('workspace_meta').put({
          key: 'singleton',
          schemaVersion: 5,
          timeZone: 'America/New_York',
          settingsRevision: 1,
          workspaceRevision: 4,
          initializedAt: '2026-11-20T00:00:00.000Z',
          updatedAt: '2026-11-22T12:00:00.000Z',
        });
        tx.objectStore('catalog_meta').put({
          key: 'singleton',
          catalogRevision: 1,
          seedManifestVersion: 2,
          seededAt: '2026-11-20T00:00:00.000Z',
        });
        tx.objectStore('trades').put({
          id: 'trd_v5_1',
          symbol: 'AAPL',
          strategyId: 'strat_long_stock',
          strategyLabel: 'Long Stock',
          accountId: 'acct_1',
          institutionId: 'inst_1',
          lifecycleState: 'Open',
          factRevision: 2,
          createdAt: '2026-11-20T15:00:00.000Z',
          updatedAt: '2026-11-20T15:00:00.000Z',
        });
        tx.objectStore('journal_entries').put({
          id: 'jrn_v5_1',
          tradeId: 'trd_v5_1',
          entryTypeId: 'plan-reflection',
          definitionId: 'def_plan_v1',
          definitionRevision: 1,
          obligationKey: null,
          responses: { thesis: 'Breakout', invalidation: 'Below 190' },
          recordedAt: '2026-11-20T15:00:00.000Z',
        });
        tx.objectStore('market_marks').put({
          id: 'mrk_v5_1',
          symbol: 'AAPL',
          sessionDate: '2026-11-20',
          price: { num: '205', den: '1' },
          source: 'Manual',
          intent: 'Initial',
          revision: 1,
          effective: true,
          recordedAt: '2026-11-20T21:15:00.000Z',
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    // 1. Injected failure leaves bootstrap pointer at gen 1 / v5, deletes candidate gen 2, and leaves gen 1 untouched
    const failed = await migrateWorkspaceV5ToV6({
      indexedDB: idb,
      fromGeneration: 1,
      injectFailureStage: 'after_copy',
    });
    expect(failed.status).toBe('MigrationBlocked');

    const dbsAfterFail = await idb.databases();
    expect(dbsAfterFail.map((d) => d.name)).not.toContain('tjv3_ws_gen_2');

    const persistence = createPersistenceSeam({
      indexedDB: idb,
      writeGate: { checkWritable: () => ({ writable: true }) },
    });
    const rootAfterFail = await persistence.inspectRoot();
    expect(rootAfterFail.status).toBe('Present');
    if (rootAfterFail.status === 'Present') {
      expect(rootAfterFail.activeGeneration).toBe(1);
      expect(rootAfterFail.schemaVersion).toBe(5);
    }
    const gen1Trades = await persistence.runReadTransaction(['trades'], (tx) => tx.getAll('trades'));
    expect(gen1Trades).toHaveLength(1);
    expect(gen1Trades[0]?.symbol).toBe('AAPL');

    // 2. Clean retry migrates atomically to generation 2 / schemaVersion 6
    const succeeded = await migrateWorkspaceV5ToV6({
      indexedDB: idb,
      fromGeneration: 1,
    });
    expect(succeeded.status).toBe('Migrated');
    if (succeeded.status !== 'Migrated') return;
    expect(succeeded.toGeneration).toBe(2);
    expect(succeeded.toSchemaVersion).toBe(6);

    const rootAfterSuccess = await persistence.inspectRoot();
    expect(rootAfterSuccess.status).toBe('Present');
    if (rootAfterSuccess.status === 'Present') {
      expect(rootAfterSuccess.activeGeneration).toBe(2);
      expect(rootAfterSuccess.schemaVersion).toBe(6);
    }

    const migratedData = await persistence.runReadTransaction(
      [
        'workspace_meta',
        'catalog_meta',
        'trades',
        'journal_entries',
        'market_marks',
        'catalog_close_reasons',
        'lot_matches',
      ],
      async (tx) => ({
        workspaceMeta: await tx.get('workspace_meta', 'singleton'),
        catalogMeta: await tx.get('catalog_meta', 'singleton'),
        trades: await tx.getAll('trades'),
        entries: await tx.getAll('journal_entries'),
        marks: await tx.getAll('market_marks'),
        closeReasons: await tx.getAll('catalog_close_reasons'),
        lotMatches: await tx.getAll('lot_matches'),
      }),
    );
    expect(migratedData.workspaceMeta).toEqual({
      key: 'singleton',
      schemaVersion: 6,
      timeZone: 'America/New_York',
      settingsRevision: 1,
      workspaceRevision: 4,
      initializedAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-22T12:00:00.000Z',
    });
    expect(migratedData.catalogMeta).toEqual({
      key: 'singleton',
      catalogRevision: 1,
      seedManifestVersion: 2,
      seededAt: '2026-11-20T00:00:00.000Z',
    });
    expect(migratedData.trades).toEqual([
      {
        id: 'trd_v5_1',
        symbol: 'AAPL',
        strategyId: 'strat_long_stock',
        strategyLabel: 'Long Stock',
        accountId: 'acct_1',
        institutionId: 'inst_1',
        lifecycleState: 'Open',
        factRevision: 2,
        createdAt: '2026-11-20T15:00:00.000Z',
        updatedAt: '2026-11-20T15:00:00.000Z',
      },
    ]);
    expect(migratedData.entries).toEqual([
      {
        id: 'jrn_v5_1',
        tradeId: 'trd_v5_1',
        entryTypeId: 'plan-reflection',
        definitionId: 'def_plan_v1',
        definitionRevision: 1,
        obligationKey: null,
        responses: { thesis: 'Breakout', invalidation: 'Below 190' },
        recordedAt: '2026-11-20T15:00:00.000Z',
      },
    ]);
    expect(migratedData.marks).toEqual([
      {
        id: 'mrk_v5_1',
        symbol: 'AAPL',
        sessionDate: '2026-11-20',
        price: { num: '205', den: '1' },
        source: 'Manual',
        intent: 'Initial',
        revision: 1,
        effective: true,
        recordedAt: '2026-11-20T21:15:00.000Z',
      },
    ]);
    const gen2 = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = idb.open('tjv3_ws_gen_2', 6);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(gen2.objectStoreNames.contains('catalog_close_reasons')).toBe(true);
    expect(gen2.objectStoreNames.contains('lot_matches')).toBe(true);
    gen2.close();

    expect(migratedData.closeReasons).toEqual([]);
    expect(migratedData.lotMatches).toEqual([]);

    // Confirm new v6 object stores accept writes cleanly
    const writeNewStore = await persistence.runWriteTransaction(['lot_matches'], (tx) => {
      tx.put('lot_matches', {
        id: 'lm_post_mig',
        tradeId: 'trd_v5_1',
        openingExecutionId: 'ex_1',
        disposalExecutionId: 'ex_2',
        matchedQuantity: { num: '10', den: '1' },
        recordedAt: '2026-11-23T15:00:00.000Z',
      });
    });
    expect(writeNewStore.status).toBe('Committed');
  });
});
