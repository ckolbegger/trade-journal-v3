import { IDBDatabase as FakeIDBDatabase, IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeNotWritable } from '../delivery/runtime-not-writable.ts';
import { createPersistence, type WriteGate } from './index.ts';

function sequentialIds() {
  let n = 0;
  return { next: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` };
}

let factory: IDBFactory;
beforeEach(() => {
  factory = new IDBFactory();
});
afterEach(() => {
  vi.restoreAllMocks();
});

// Builds stored state with the raw IndexedDB API, independently of the code under test.
function rawOpen(name: string, version: number, upgrade: (db: IDBDatabase) => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, version);
    request.onupgradeneeded = () => upgrade(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('open failed'));
  });
}

async function seedRoot(pointer?: string): Promise<void> {
  const db = await rawOpen('tj-root', 1, (d) => {
    d.createObjectStore('pointer', { keyPath: 'key' });
    d.createObjectStore('diagnostics', { keyPath: 'id' });
  });
  if (pointer) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction('pointer', 'readwrite');
      tx.objectStore('pointer').put({ key: 'current', databaseName: pointer });
      tx.oncomplete = () => resolve();
    });
  }
  db.close();
}

async function seedWorkspace(name: string, meta?: Record<string, unknown>): Promise<void> {
  const db = await rawOpen(name, 1, (d) => d.createObjectStore('meta', { keyPath: 'key' }));
  if (meta) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put(meta);
      tx.oncomplete = () => resolve();
    });
  }
  db.close();
}

async function rawGet(database: string, store: string, key: IDBValidKey): Promise<unknown> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(database);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('open failed'));
  });
  const value = await new Promise((resolve) => {
    const request = db.transaction(store).objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result);
  });
  db.close();
  return value;
}

const writable: WriteGate = { current: () => null, recheck: () => Promise.resolve(null) };

function persistence(writeGate: WriteGate = writable) {
  return createPersistence({ indexedDB: factory, ids: sequentialIds(), writeGate });
}

describe('root inspection', () => {
  it('should report NoWorkspace when the root database is created fresh and holds no pointer', async () => {
    const inspection = await persistence().inspectRoot();
    expect(inspection).toEqual({ kind: 'NoWorkspace', deletedOrphans: [] });
    expect((await factory.databases()).map((d) => d.name)).toEqual(['tj-root']);
  });

  it('should report KnownWorkspace with database name and schema version when the pointer names a database that opens at a supported version', async () => {
    await seedRoot('tj-ws-a');
    await seedWorkspace('tj-ws-a', { key: 'schema', schemaVersion: 1 });
    expect(await persistence().inspectRoot()).toEqual({
      kind: 'KnownWorkspace',
      databaseName: 'tj-ws-a',
      schemaVersion: 1,
      deletedOrphans: [],
    });
  });

  it('should report Unreadable(PossibleRoot) when tj-root exists at a newer version, without upgrading, deleting, or writing to it', async () => {
    const future = await rawOpen('tj-root', 99, (d) => d.createObjectStore('future', { keyPath: 'id' }));
    await new Promise<void>((resolve) => {
      const tx = future.transaction('future', 'readwrite');
      tx.objectStore('future').put({ id: 'marker', value: 'kept' });
      tx.oncomplete = () => resolve();
    });
    future.close();

    expect(await persistence().inspectRoot()).toEqual({ kind: 'Unreadable', root: 'PossibleRoot' });

    expect((await factory.databases()).find((d) => d.name === 'tj-root')?.version).toBe(99);
    const after = await rawOpen('tj-root', 99, () => undefined);
    const marker = await new Promise((resolve) => {
      const request = after.transaction('future').objectStore('future').getAll();
      request.onsuccess = () => resolve(request.result);
    });
    after.close();
    expect(marker).toEqual([{ id: 'marker', value: 'kept' }]);
    expect(Array.from(after.objectStoreNames)).toEqual(['future']);
  });

  it('should report Unreadable(KnownRoot) when the pointer names a database that does not exist, aborting the upgrade so no empty database is created', async () => {
    await seedRoot('tj-ws-missing');
    expect(await persistence().inspectRoot()).toEqual({ kind: 'Unreadable', root: 'KnownRoot' });
    expect((await factory.databases()).map((d) => d.name)).toEqual(['tj-root']);
  });

  it('should report Invalid when the Workspace meta record is missing or names an unknown schema version', async () => {
    await seedRoot('tj-ws-a');
    await seedWorkspace('tj-ws-a');
    expect(await persistence().inspectRoot()).toEqual({
      kind: 'Invalid',
      databaseName: 'tj-ws-a',
      reason: 'MissingMeta',
    });

    factory = new IDBFactory();
    await seedRoot('tj-ws-b');
    await seedWorkspace('tj-ws-b', { key: 'schema', schemaVersion: 7 });
    expect(await persistence().inspectRoot()).toEqual({
      kind: 'Invalid',
      databaseName: 'tj-ws-b',
      reason: 'UnknownSchemaVersion',
    });
  });

  it('should delete an orphaned candidate database (candidate prefix, not named by the pointer) and list it in the inspection receipt', async () => {
    await seedRoot('tj-ws-a');
    await seedWorkspace('tj-ws-a', { key: 'schema', schemaVersion: 1 });
    await seedWorkspace('tj-ws-orphan', { key: 'schema', schemaVersion: 1 });
    await seedWorkspace('unrelated-db');
    expect(await persistence().inspectRoot()).toEqual({
      kind: 'KnownWorkspace',
      databaseName: 'tj-ws-a',
      schemaVersion: 1,
      deletedOrphans: ['tj-ws-orphan'],
    });
    expect((await factory.databases()).map((d) => d.name).sort()).toEqual(['tj-root', 'tj-ws-a', 'unrelated-db']);
  });
});

describe('workspace creation', () => {
  it('should make a new Workspace visible only through the final pointer write, so a reader sees no Workspace or the complete one', async () => {
    const writer = persistence();
    const reader = persistence();
    let done = false;
    const creation = writer
      .createWorkspace([{ store: 'meta', value: { key: 'settings', timeZone: 'America/New_York' } }])
      .finally(() => {
        done = true;
      });
    const seen: string[] = [];
    while (!done) {
      const inspection = await reader.inspectRoot();
      seen.push(inspection.kind);
      if (inspection.kind === 'KnownWorkspace') {
        expect(await rawGet(inspection.databaseName, 'meta', 'settings')).toEqual(
          expect.objectContaining({ timeZone: 'America/New_York' }),
        );
      }
    }
    const created = await creation;
    expect(created).toEqual({
      kind: 'Created',
      databaseName: 'tj-ws-00000000-0000-4000-8000-000000000001',
      binding: { databaseName: 'tj-ws-00000000-0000-4000-8000-000000000001', contentRevision: 1 },
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((kind) => kind === 'NoWorkspace' || kind === 'KnownWorkspace')).toBe(true);
    expect((await reader.inspectRoot()).kind).toBe('KnownWorkspace');
  });

  it('should report AlreadyInitialized and leave the existing pointer unchanged when a second initializer\'s pointer add fails with ConstraintError', async () => {
    await seedRoot('tj-ws-existing');
    await seedWorkspace('tj-ws-existing', { key: 'schema', schemaVersion: 1 });
    expect(await persistence().createWorkspace([])).toEqual({
      kind: 'AlreadyInitialized',
      databaseName: 'tj-ws-existing',
    });
    expect(await rawGet('tj-root', 'pointer', 'current')).toEqual({ key: 'current', databaseName: 'tj-ws-existing' });
    expect((await factory.databases()).map((d) => d.name).sort()).toEqual(['tj-root', 'tj-ws-existing']);
  });
});

describe('semantic commit', () => {
  async function created() {
    const p = persistence();
    const result = await p.createWorkspace([]);
    if (result.kind !== 'Created') throw new Error('workspace not created');
    return { p, databaseName: result.databaseName };
  }

  it('should apply a write set spanning several stores in one readwrite transaction and increment the Workspace content revision exactly once', async () => {
    const { p, databaseName } = await created();
    const transactions = vi.spyOn(FakeIDBDatabase.prototype, 'transaction');
    const result = await p.commit({
      checks: [],
      writes: [
        { op: 'put', store: 'catalog', value: { id: 'institution-1', label: 'Broker' } },
        { op: 'put', store: 'trades', value: { tradeId: 'trade-1' } },
        { op: 'put', store: 'journalEntries', value: { id: 'entry-1' } },
      ],
    });
    expect(result.kind).toBe('Committed');
    const writes = transactions.mock.calls.filter(([, mode]) => mode === 'readwrite');
    expect(writes).toHaveLength(1);
    expect([...(writes[0]?.[0] as string[])].sort()).toEqual(['catalog', 'journalEntries', 'meta', 'trades']);
    expect(await rawGet(databaseName, 'meta', 'content')).toEqual({ key: 'content', contentRevision: 2 });
    expect(await rawGet(databaseName, 'catalog', 'institution-1')).toEqual(expect.objectContaining({ label: 'Broker' }));
    expect(await rawGet(databaseName, 'trades', 'trade-1')).toBeDefined();
    expect(await rawGet(databaseName, 'journalEntries', 'entry-1')).toBeDefined();
  });

  it('should write nothing and leave the content revision unchanged when a binding check fails, returning a typed Conflict that names the stale binding', async () => {
    const { p, databaseName } = await created();
    await p.commit({ checks: [], writes: [{ op: 'put', store: 'catalog', value: { id: 'account-1', label: 'Old' } }] });
    const result = await p.commit({
      checks: [
        {
          name: 'account-1@revision-1',
          store: 'catalog',
          key: 'account-1',
          verify: (current) => current?.['revision'] === 1,
        },
      ],
      writes: [
        { op: 'put', store: 'catalog', value: { id: 'account-1', label: 'New' } },
        { op: 'put', store: 'trades', value: { tradeId: 'trade-1' } },
      ],
    });
    expect(result).toEqual({ kind: 'Conflict', binding: 'account-1@revision-1' });
    expect(await rawGet(databaseName, 'meta', 'content')).toEqual({ key: 'content', contentRevision: 2 });
    expect(await rawGet(databaseName, 'catalog', 'account-1')).toEqual(expect.objectContaining({ label: 'Old' }));
    expect(await rawGet(databaseName, 'trades', 'trade-1')).toBeUndefined();
  });

  it('should leave every earlier write absent when the last write in the set fails with ConstraintError', async () => {
    const { p, databaseName } = await created();
    await p.commit({ checks: [], writes: [{ op: 'put', store: 'catalog', value: { id: 'taken' } }] });
    const result = await p.commit({
      checks: [],
      writes: [
        { op: 'put', store: 'trades', value: { tradeId: 'trade-1' } },
        { op: 'put', store: 'journalEntries', value: { id: 'entry-1' } },
        { op: 'add', store: 'catalog', value: { id: 'taken' } },
      ],
    });
    expect(result).toEqual({ kind: 'ConstraintViolation', store: 'catalog' });
    expect(await rawGet(databaseName, 'trades', 'trade-1')).toBeUndefined();
    expect(await rawGet(databaseName, 'journalEntries', 'entry-1')).toBeUndefined();
    expect(await rawGet(databaseName, 'meta', 'content')).toEqual({ key: 'content', contentRevision: 2 });
  });

  it('should open write transactions with durability "strict"', async () => {
    const { p } = await created();
    const transactions = vi.spyOn(FakeIDBDatabase.prototype, 'transaction');
    await p.commit({ checks: [], writes: [{ op: 'put', store: 'trades', value: { tradeId: 'trade-1' } }] });
    const writes = transactions.mock.calls.filter(([, mode]) => mode === 'readwrite');
    expect(writes).toHaveLength(1);
    expect(writes[0]?.[2]).toEqual({ durability: 'strict' });
  });

  it('should reject with EarlyAutoCommitGuard and write nothing when a binding check returns a promise instead of completing synchronously', async () => {
    const { p, databaseName } = await created();
    const asyncCheck = (() => Promise.resolve(true)) as unknown as (current: unknown) => boolean;
    const result = await p.commit({
      checks: [{ name: 'async-check', store: 'catalog', key: 'x', verify: asyncCheck }],
      writes: [{ op: 'put', store: 'trades', value: { tradeId: 'trade-1' } }],
    });
    expect(result).toEqual({ kind: 'EarlyAutoCommitGuard', binding: 'async-check' });
    expect(await rawGet(databaseName, 'trades', 'trade-1')).toBeUndefined();
    expect(await rawGet(databaseName, 'meta', 'content')).toEqual({ key: 'content', contentRevision: 1 });
  });

  it('should return the committed content revision and the new revision of every written record', async () => {
    const { p, databaseName } = await created();
    const result = await p.commit({
      checks: [],
      writes: [
        { op: 'put', store: 'catalog', value: { id: 'institution-1' } },
        { op: 'add', store: 'trades', value: { tradeId: 'trade-1' } },
      ],
    });
    expect(result).toEqual({
      kind: 'Committed',
      binding: { databaseName, contentRevision: 2 },
      revisions: [
        { store: 'catalog', key: 'institution-1', revision: 2 },
        { store: 'trades', key: 'trade-1', revision: 2 },
      ],
    });
    expect(await rawGet(databaseName, 'catalog', 'institution-1')).toEqual({ id: 'institution-1', revision: 2 });
  });
});

describe('snapshot reads', () => {
  it('should read several stores in one readonly transaction and report the single content revision observed, even when a commit races with the read', async () => {
    const p = persistence();
    const created = await p.createWorkspace([]);
    if (created.kind !== 'Created') throw new Error('workspace not created');
    await p.commit({ checks: [], writes: [{ op: 'put', store: 'trades', value: { tradeId: 'trade-1' } }] });

    const transactions = vi.spyOn(FakeIDBDatabase.prototype, 'transaction');
    const read = p.readSnapshot(['trades', 'catalog'], async (tx) => ({
      trades: await tx.getAll('trades'),
      catalog: await tx.getAll('catalog'),
    }));
    const racing = p.commit({
      checks: [],
      writes: [
        { op: 'put', store: 'trades', value: { tradeId: 'trade-2' } },
        { op: 'put', store: 'catalog', value: { id: 'institution-1' } },
      ],
    });
    const [snapshot] = await Promise.all([read, racing]);

    expect(transactions.mock.calls.filter(([, mode]) => mode !== 'readwrite')).toHaveLength(1);
    expect(snapshot.binding).toEqual({ databaseName: created.databaseName, contentRevision: 2 });
    expect(snapshot.value.trades).toHaveLength(1);
    expect(snapshot.value.catalog).toHaveLength(0);
  });
});

describe('versionchange (amendment agreed during the D2 breakdown, 2026-10-11)', () => {
  function openAtVersion(name: string, version: number): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = factory.open(name, version);
      request.onblocked = () => reject(new Error('blocked: an old connection stayed open'));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('open failed'));
    });
  }

  it('should close its Workspace connection and mark the session superseded when another connection requests a version change of the Workspace database', async () => {
    const p = persistence();
    const created = await p.createWorkspace([]);
    if (created.kind !== 'Created') throw new Error('workspace not created');
    await p.commit({ checks: [], writes: [] });
    expect(p.isSuperseded()).toBe(false);

    const later = await openAtVersion(created.databaseName, 2);
    later.close();
    expect(p.isSuperseded()).toBe(true);
  });

  it('should return RuntimeNotWritable from the next commit after supersession, with readiness rerun and no write attempted', async () => {
    const refusal: RuntimeNotWritable = {
      kind: 'RuntimeNotWritable',
      runtimeReadiness: 'RecoveryOnly',
      failedChecks: [{ check: 'control', reason: 'DifferentRelease' }],
      workspaceStatus: 'RecoveryOnly',
      safeActions: [{ action: 'Reload', explanation: 'Reload to continue with the updated release.' }],
    };
    const recheck = vi.fn<WriteGate['recheck']>(() => Promise.resolve(refusal));
    const p = persistence({ current: () => null, recheck });
    const created = await p.createWorkspace([]);
    if (created.kind !== 'Created') throw new Error('workspace not created');
    await p.commit({ checks: [], writes: [] });
    (await openAtVersion(created.databaseName, 2)).close();

    const transactions = vi.spyOn(FakeIDBDatabase.prototype, 'transaction');
    const result = await p.commit({ checks: [], writes: [{ op: 'put', store: 'trades', value: { tradeId: 'trade-1' } }] });

    expect(result).toEqual({ ...refusal, failedChecks: [...refusal.failedChecks, { check: 'control', reason: 'SessionSuperseded' }] });
    expect(recheck).toHaveBeenCalledTimes(1);
    expect(transactions.mock.calls.filter(([, mode]) => mode === 'readwrite')).toHaveLength(0);
    expect(await rawGet(created.databaseName, 'trades', 'trade-1')).toBeUndefined();
  });

  it('should name the supersession among the failed checks of that RuntimeNotWritable, so the shell can explain it', async () => {
    const reran: RuntimeNotWritable = {
      kind: 'RuntimeNotWritable',
      runtimeReadiness: 'RecoveryOnly',
      failedChecks: [{ check: 'control', reason: 'DifferentRelease' }],
      workspaceStatus: 'RecoveryOnly',
      safeActions: [],
    };
    const p = persistence({ current: () => null, recheck: () => Promise.resolve(reran) });
    const created = await p.createWorkspace([]);
    if (created.kind !== 'Created') throw new Error('workspace not created');
    await p.commit({ checks: [], writes: [] });
    (await openAtVersion(created.databaseName, 2)).close();
    const result = await p.commit({ checks: [], writes: [] });
    expect(result.kind === 'RuntimeNotWritable' && result.failedChecks).toEqual([
      { check: 'control', reason: 'DifferentRelease' },
      { check: 'control', reason: 'SessionSuperseded' },
    ]);
  });
});
