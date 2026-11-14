import { IDBDatabase as FakeIDBDatabase, IDBFactory, IDBObjectStore as FakeIDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_SESSION_POLICY } from '../../tests/support/session-policy.ts';
import { upgradeWorkspace } from './schema.ts';
import { createPersistence, exportLayoutFor, type ExportBatch, type Persistence, type WriteGate } from './index.ts';

// T8.3: the export snapshot read and the layout per schema version (D8 P29, A125, A128, A149).

let factory: IDBFactory;
beforeEach(() => {
  factory = new IDBFactory();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const writable: WriteGate = { current: () => null, recheck: () => Promise.resolve(null) };

function persistence(): Persistence {
  let n = 0;
  return createPersistence({
    indexedDB: factory,
    ids: { next: () => `p-${String(++n).padStart(4, '0')}` },
    writeGate: writable,
    sessionPolicy: TEST_SESSION_POLICY,
  });
}

function rawOpen(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = factory.open(name);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('open failed'));
  });
}

// Puts raw records, bypassing the code under test.
async function rawPut(database: string, records: readonly (readonly [string, Record<string, unknown>])[]): Promise<void> {
  const db = await rawOpen(database);
  try {
    const tx = db.transaction([...new Set(records.map(([store]) => store))], 'readwrite');
    for (const [store, value] of records) tx.objectStore(store).put(value);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('put failed'));
    });
  } finally {
    db.close();
  }
}

async function workspaceWith(records: readonly (readonly [string, Record<string, unknown>])[]) {
  const p = persistence();
  const created = await p.createWorkspace([]);
  if (created.kind !== 'Created') throw new Error('workspace not created');
  await rawPut(created.databaseName, records);
  return { p, database: created.databaseName };
}

const journalType = (n: number): readonly [string, Record<string, unknown>] => ['journalTypes', { id: `type-${String(n).padStart(5, '0')}`, n }];

describe('one read snapshot (P29, A128)', () => {
  it('should read every store of the schema-7 layout in one readonly transaction, in key order and batches of 500, calling onBatch synchronously, and return the meta record and per-store counts read first in that transaction', async () => {
    const trade = { tradeId: 't-1', lifecycle: 'Closed', activityDesc: 'x', exposureStart: 'x', terminalTime: 'x', terminalDesc: 'x', revision: 4 };
    const { p, database } = await workspaceWith([
      ...Array.from({ length: 1200 }, (_, i) => journalType(1200 - i)),
      ['trades', trade],
      ['catalog', { id: 'c-1' }],
      ['observations', { tradingDate: '2026-11-02', instrumentKey: 'B' }],
      ['observations', { tradingDate: '2026-11-02', instrumentKey: 'A' }],
    ]);
    const transactions = vi.spyOn(FakeIDBDatabase.prototype, 'transaction');
    const batches: ExportBatch[] = [];

    const result = await p.readExportSnapshot(database, exportLayoutFor(7)!, (batch) => {
      batches.push(batch);
    });

    if (result.kind !== 'Read') throw new Error(`not read: ${JSON.stringify(result)}`);
    const onSource = transactions.mock.calls.filter((_, i) => (transactions.mock.contexts[i] as IDBDatabase).name === database);
    expect(onSource).toHaveLength(1);
    expect(onSource[0]?.[1] ?? 'readonly').toBe('readonly');
    expect([...(onSource[0]?.[0] as string[])].sort()).toEqual(
      ['catalog', 'journalDebts', 'journalDeclines', 'journalDefinitions', 'journalEntries', 'journalTypes', 'meta', 'observations', 'trades'],
    );
    expect(result.schemaVersion).toBe(7);
    expect(result.binding).toEqual({ databaseName: database, contentRevision: 1 });
    expect(result.counts).toEqual({
      catalog: 1,
      observations: 2,
      trades: 1,
      journalTypes: 1200,
      journalDefinitions: 0,
      journalEntries: 0,
      journalDeclines: 0,
      journalDebts: 0,
    });
    expect(result.meta.map((record) => record['key'])).toEqual(['content', 'schema', 'sessionPolicy']);
    // Stores in the layout's order; each store's records in primary-key order, 500 to a batch.
    expect(batches.map((b) => [b.store, b.records.length])).toEqual([
      ['catalog', 1],
      ['observations', 2],
      ['trades', 1],
      ['journalTypes', 500],
      ['journalTypes', 500],
      ['journalTypes', 200],
    ]);
    const ids = batches.filter((b) => b.store === 'journalTypes').flatMap((b) => b.records.map((r) => r['id']));
    expect(ids).toEqual([...ids].sort());
    expect(batches.find((b) => b.store === 'observations')!.records.map((r) => r['instrumentKey'])).toEqual(['A', 'B']);
    // Private Trade fields are omitted.
    expect(batches.find((b) => b.store === 'trades')!.records[0]).toEqual({ tradeId: 't-1', lifecycle: 'Closed', revision: 4 });
  });

  it('should leave a readwrite commit started after the snapshot began waiting until the read finishes, so no batch contains its record and the commit then succeeds with a later content revision', async () => {
    const { p, database } = await workspaceWith(Array.from({ length: 1200 }, (_, i) => journalType(i + 1)));
    const batches: ExportBatch[] = [];
    let commit: Promise<unknown> | undefined;
    let committedEarly = false;

    const result = await p.readExportSnapshot(database, exportLayoutFor(7)!, (batch) => {
      batches.push(batch);
      // A later key than every stored record: a batch read after the commit would contain it.
      commit ??= p
        .commit({ checks: [], writes: [{ op: 'put', store: 'journalTypes', value: { id: 'type-99999' } }] })
        .then((committed) => {
          committedEarly = result === undefined;
          return committed;
        });
    });

    expect(result.kind).toBe('Read');
    expect(committedEarly).toBe(false);
    expect(batches.flatMap((b) => b.records).some((r) => r['id'] === 'type-99999')).toBe(false);
    expect(batches.flatMap((b) => b.records)).toHaveLength(1200);
    const committed = (await commit) as { kind: string; binding: { contentRevision: number } };
    expect(committed.kind).toBe('Committed');
    expect(committed.binding.contentRevision).toBe(2);
  });

  it('should fail with EarlyAutoCommitGuard when onBatch returns a promise, and with ReadFailed naming the store when a request errors, returning no batches after the failure', async () => {
    const { p, database } = await workspaceWith([...Array.from({ length: 1200 }, (_, i) => journalType(i + 1)), ['catalog', { id: 'c-1' }]]);
    const layout = exportLayoutFor(7)!;

    const guarded: ExportBatch[] = [];
    const early = await p.readExportSnapshot(database, layout, (batch) => {
      guarded.push(batch);
      return Promise.resolve() as unknown as void;
    });
    expect(early).toEqual({ kind: 'EarlyAutoCommitGuard' });
    expect(guarded.map((b) => b.store)).toEqual(['catalog']);

    // The second journalTypes request errors.
    const getAll: (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['getAll']>) => IDBRequest<unknown[]> = Reflect.get(
      FakeIDBObjectStore.prototype,
      'getAll',
    );
    let typeRequests = 0;
    vi.spyOn(FakeIDBObjectStore.prototype, 'getAll').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['getAll']>) {
      const request: IDBRequest<unknown[]> = getAll.apply(this, args);
      if (this.name === 'journalTypes' && ++typeRequests === 2) {
        // Fails the pending request before its result arrives.
        queueMicrotask(() => {
          request.onerror?.(new Event('error', { cancelable: true }));
        });
      }
      return request as never;
    });
    const delivered: ExportBatch[] = [];
    const failed = await p.readExportSnapshot(database, layout, (batch) => {
      delivered.push(batch);
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(failed).toEqual({ kind: 'ReadFailed', store: 'journalTypes' });
    expect(delivered.map((b) => [b.store, b.records.length])).toEqual([
      ['catalog', 1],
      ['journalTypes', 500],
    ]);
  });

  it('should not leave an unhandled rejection when onBatch returns a promise that rejects', async () => {
    const { p, database } = await workspaceWith([['catalog', { id: 'c-1' }]]);
    const unhandled: unknown[] = [];
    const record = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', record);
    try {
      const result = await p.readExportSnapshot(database, exportLayoutFor(7)!, () => Promise.reject(new Error('late failure')) as unknown as void);
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(result).toEqual({ kind: 'EarlyAutoCommitGuard' });
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', record);
    }
  });
});

// A Workspace database as an older or newer release left it: the stores of the current schema, the
// given stored schema version, and the given records.
async function databaseAtSchema(schemaVersion: number, records: readonly (readonly [string, Record<string, unknown>])[]): Promise<string> {
  const name = `tj-ws-old-${schemaVersion}`;
  await new Promise<void>((resolve, reject) => {
    const open = factory.open(name);
    open.onupgradeneeded = () => upgradeWorkspace(open.result, 0);
    open.onsuccess = () => {
      open.result.close();
      resolve();
    };
    open.onerror = () => reject(open.error ?? new Error('open failed'));
  });
  await rawPut(name, [
    ['meta', { key: 'schema', schemaVersion }],
    ['meta', { key: 'content', contentRevision: 48 }],
    ...records,
  ]);
  return name;
}

describe('a missing database (T8.3-B2)', () => {
  it('should report ReadFailed for a missing database without creating it', async () => {
    const p = persistence();

    const read = await p.readExportSnapshot('no-such-workspace', exportLayoutFor(7)!, () => {});

    expect(read).toEqual({ kind: 'ReadFailed', store: 'meta' });
    expect((await factory.databases()).map((d) => d.name)).not.toContain('no-such-workspace');
  });
});

describe('an older schema (T8.3-B3)', () => {
  it('should report UnknownLayout when a schema-1 database is read with the schema-7 layout', async () => {
    // A schema-1 database holds only `meta`, so every store the schema-7 layout names is missing.
    const name = 'tj-ws-schema-1';
    await new Promise<void>((resolve, reject) => {
      const open = factory.open(name);
      open.onupgradeneeded = () => {
        open.result.createObjectStore('meta', { keyPath: 'key' }).put({ key: 'schema', schemaVersion: 1 });
      };
      open.onsuccess = () => {
        open.result.close();
        resolve();
      };
      open.onerror = () => reject(open.error ?? new Error('open failed'));
    });
    const batches: ExportBatch[] = [];

    const read = await persistence().readExportSnapshot(name, exportLayoutFor(7)!, (batch) => {
      batches.push(batch);
    });

    expect(read).toEqual({ kind: 'UnknownLayout', schemaVersion: 1 });
    expect(batches).toEqual([]);
  });
});

describe('layouts per schema (A149)', () => {
  it('should read a schema-5 database with the schema-5 layout, and return UnknownLayout for a database whose meta names schema 9', async () => {
    const v5 = await databaseAtSchema(5, [
      ['trades', { tradeId: 't-1', terminalDesc: 'x', activityDesc: 'y' }],
      ['journalDebts', { debtId: 'd-1' }],
      // A store the schema-5 layout does not hold is not read.
      ['journalObligations', { obligationKey: 'k' }],
    ]);
    const v9 = await databaseAtSchema(9, [['trades', { tradeId: 't-9' }]]);
    const p = persistence();
    const batches: ExportBatch[] = [];

    const read = await p.readExportSnapshot(v5, exportLayoutFor(5)!, (batch) => {
      batches.push(batch);
    });
    const unknown: ExportBatch[] = [];
    const refused = await p.readExportSnapshot(v9, exportLayoutFor(7)!, (batch) => {
      unknown.push(batch);
    });

    if (read.kind !== 'Read') throw new Error(`not read: ${JSON.stringify(read)}`);
    expect(read.schemaVersion).toBe(5);
    expect(read.binding).toEqual({ databaseName: v5, contentRevision: 48 });
    expect(Object.keys(read.counts).sort()).toEqual([...exportLayoutFor(5)!.stores].sort());
    expect(batches).toEqual([
      { store: 'trades', records: [{ tradeId: 't-1' }] },
      { store: 'journalDebts', records: [{ debtId: 'd-1' }] },
    ]);
    expect(exportLayoutFor(9)).toBeUndefined();
    expect(refused).toEqual({ kind: 'UnknownLayout', schemaVersion: 9 });
    expect(unknown).toEqual([]);
  });
});
