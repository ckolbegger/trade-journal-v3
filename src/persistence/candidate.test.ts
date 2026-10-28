import { IDBDatabase as FakeIDBDatabase, IDBFactory, IDBObjectStore as FakeIDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInProcessLifecycleLock,
  createPersistence,
  type LifecycleLock,
  type Persistence,
  type StoreRecord,
  type WriteGate,
} from './index.ts';
import { TEST_SESSION_POLICY } from '../../tests/support/session-policy.ts';

// T2.8: schema version 2, the candidate database, the pointer flip, and cleanup (D2 A28, A30, A139).

function ids(prefix: string) {
  let n = 0;
  return { next: () => `${prefix}-${String(++n).padStart(4, '0')}` };
}

let factory: IDBFactory;
beforeEach(() => {
  factory = new IDBFactory();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const writable: WriteGate = { current: () => null, recheck: () => Promise.resolve(null) };

function persistence(prefix = 'p') {
  return createPersistence({ indexedDB: factory, ids: ids(prefix), writeGate: writable, sessionPolicy: TEST_SESSION_POLICY });
}

// Raw IndexedDB access, independent of the code under test.
function rawOpen(name: string, version?: number, upgrade?: (db: IDBDatabase) => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = version === undefined ? factory.open(name) : factory.open(name, version);
    if (upgrade) request.onupgradeneeded = () => upgrade(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('open failed'));
  });
}

describe('schema v2 layout', () => {
  it('should create a fresh Workspace at schema version 2 with the byLifecycleActivity index, journalDeclines, and journalObligations', async () => {
    const p = persistence();
    const created = await p.createWorkspace([]);
    if (created.kind !== 'Created') throw new Error('workspace not created');
    p.close();

    expect(await p.inspectRoot()).toEqual(expect.objectContaining({ kind: 'KnownWorkspace', schemaVersion: 3 }));
    const db = await rawOpen(created.databaseName);
    const stores = Array.from(db.objectStoreNames);
    const tx = db.transaction(stores);
    const meta = await new Promise((resolve) => {
      const request = tx.objectStore('meta').get('schema');
      request.onsuccess = () => resolve(request.result);
    });
    const index = tx.objectStore('trades').index('byLifecycleActivity');
    const obligations = tx.objectStore('journalObligations');
    const declines = tx.objectStore('journalDeclines');
    db.close();

    expect(meta).toEqual({ key: 'schema', schemaVersion: 3 });
    expect(stores).toEqual(expect.arrayContaining(['journalDeclines', 'journalObligations']));
    expect(index.keyPath).toEqual(['lifecycle', 'activityDesc', 'tradeId']);
    expect(obligations.keyPath).toBe('obligationKey');
    expect(declines.keyPath).toBe('id');
  });
});

async function rawGet(database: string, store: string, key: IDBValidKey): Promise<unknown> {
  const db = await rawOpen(database);
  const value = await new Promise((resolve) => {
    const request = db.transaction(store).objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result);
  });
  db.close();
  return value;
}

async function rawGetAll(database: string, store: string): Promise<unknown[]> {
  const db = await rawOpen(database);
  const values = await new Promise<unknown[]>((resolve) => {
    const request = db.transaction(store).objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result);
  });
  db.close();
  return values;
}

// Every store with its key path, indexes, and records, for comparing a database before and after.
async function dump(database: string) {
  const db = await rawOpen(database);
  const stores = Array.from(db.objectStoreNames);
  const tx = db.transaction(stores);
  const result = await Promise.all(
    stores.map(
      (name) =>
        new Promise((resolve) => {
          const store = tx.objectStore(name);
          const indexes = Array.from(store.indexNames).map((i) => [i, store.index(i).keyPath, store.index(i).unique]);
          const request = store.getAll();
          request.onsuccess = () => resolve({ name, keyPath: store.keyPath, indexes, records: request.result });
        }),
    ),
  );
  db.close();
  return result;
}

const identity = (record: StoreRecord) => record;

// A Workspace holding records in several stores, still open in an earlier session.
async function oldWorkspace() {
  const session = persistence('old');
  const created = await session.createWorkspace([
    { store: 'meta', value: { key: 'settings', timeZone: 'America/New_York' } },
    { store: 'catalog', value: { id: 'institution-1', label: 'Broker' } },
    { store: 'trades', value: { tradeId: 'trade-1', lifecycle: 'Planned', planTime: '2026-10-12T13:30:00Z' } },
  ]);
  if (created.kind !== 'Created') throw new Error('workspace not created');
  await session.commit({ checks: [], writes: [{ op: 'put', store: 'journalEntries', value: { id: 'entry-1', obligationKey: 'plan:trade-1' } }] });
  return { session, databaseName: created.databaseName };
}

describe('candidate and activation', () => {
  it('should name the candidate in the root candidates record before creating it', async () => {
    const p = persistence('c');
    const created = await p.createWorkspace([]);
    if (created.kind !== 'Created') throw new Error('workspace not created');
    const open = factory.open.bind(factory);
    const opened: string[] = [];
    vi.spyOn(factory, 'open').mockImplementation((name: string, version?: number) => {
      opened.push(name);
      if (name === 'tj-ws-c-0002') throw new Error('candidate creation interrupted');
      return open(name, version);
    });

    await expect(p.createCandidate()).rejects.toThrow('candidate creation interrupted');

    expect(opened).toContain('tj-ws-c-0002');
    expect(await rawGet('tj-root', 'pointer', 'candidates')).toEqual({ key: 'candidates', databaseNames: ['tj-ws-c-0002'] });
    expect(await rawGet('tj-root', 'pointer', 'current')).toEqual({ key: 'current', databaseName: created.databaseName });
    vi.restoreAllMocks();
    expect((await factory.databases()).map((d) => d.name).sort()).toEqual(['tj-root', created.databaseName]);
  });

  it('should bump the old database IndexedDB version without changing any store, closing every other connection to it first', async () => {
    const old = await oldWorkspace();
    const migrator = persistence('m');
    await migrator.inspectRoot();
    await migrator.readSnapshot(['trades'], (tx) => tx.getAll('trades'));
    const before = await dump(old.databaseName);
    const version = (await factory.databases()).find((d) => d.name === old.databaseName)?.version ?? 0;
    const { databaseName: candidate } = await migrator.createCandidate();

    await migrator.copySnapshot(old.databaseName, candidate, identity);

    expect(old.session.isSuperseded()).toBe(true);
    expect(migrator.isSuperseded()).toBe(false);
    expect((await factory.databases()).find((d) => d.name === old.databaseName)?.version).toBe(version + 1);
    expect(await dump(old.databaseName)).toEqual(before);
  });

  it('should copy every store through the supplied per-record transforms in one read-only snapshot', async () => {
    const old = await oldWorkspace();
    await old.session.commit({
      checks: [],
      writes: [
        { op: 'put', store: 'journalDeclines', value: { id: 'decline-1', obligationKey: 'pcr:pc-1' } },
        { op: 'add', store: 'journalObligations', value: { obligationKey: 'pcr:pc-1', outcome: 'decline-1' } },
      ],
    });
    const migrator = persistence('m');
    const { databaseName: candidate } = await migrator.createCandidate();
    const seen: StoreRecord[] = [];
    const transform = (record: StoreRecord): StoreRecord => {
      seen.push(record);
      return { store: record.store, value: { ...record.value, copied: true } };
    };
    const transactions = vi.spyOn(FakeIDBDatabase.prototype, 'transaction');

    await migrator.copySnapshot(old.databaseName, candidate, transform);

    const onSource = transactions.mock.calls.filter(
      ([, mode], i) => mode !== 'versionchange' && (transactions.mock.contexts[i] as IDBDatabase).name === old.databaseName,
    );
    expect(onSource).toHaveLength(1);
    expect(onSource[0]?.[1] ?? 'readonly').toBe('readonly');
    expect([...(onSource[0]?.[0] as string[])].sort()).toEqual(
      ['catalog', 'journalDeclines', 'journalDefinitions', 'journalEntries', 'journalTypes', 'meta', 'observations', 'trades'],
    );
    // Transforms see authoritative records only: no persistence stamp, no private store.
    expect(seen.map((r) => r.store).sort()).toEqual(['catalog', 'journalDeclines', 'journalEntries', 'meta', 'meta', 'trades']);
    expect(seen.some((r) => 'revision' in r.value)).toBe(false);
    expect(await rawGetAll(candidate, 'catalog')).toEqual([{ id: 'institution-1', label: 'Broker', copied: true, revision: 1 }]);
    expect(await rawGetAll(candidate, 'journalDeclines')).toEqual([
      { id: 'decline-1', obligationKey: 'pcr:pc-1', copied: true, revision: 1 },
    ]);
    expect(await rawGetAll(candidate, 'trades')).toEqual([
      { tradeId: 'trade-1', lifecycle: 'Planned', planTime: '2026-10-12T13:30:00Z', copied: true, revision: 1 },
    ]);
    expect(await rawGetAll(candidate, 'journalObligations')).toEqual([]);
    expect(await rawGetAll(candidate, 'meta')).toEqual([
      { key: 'content', contentRevision: 1 },
      { key: 'schema', schemaVersion: 3 },
      { key: 'sessionPolicy', policy: TEST_SESSION_POLICY, copied: true, revision: 1 },
      { key: 'settings', timeZone: 'America/New_York', copied: true, revision: 1 },
    ]);
  });

  it('should switch the pointer, remove the candidate entry, and list the old database as retired in one root transaction', async () => {
    const old = await oldWorkspace();
    old.session.close();
    const migrator = persistence('m');
    await migrator.inspectRoot();
    const { databaseName: candidate } = await migrator.createCandidate();
    await migrator.copySnapshot(old.databaseName, candidate, identity);
    const puts = vi.spyOn(FakeIDBObjectStore.prototype, 'put');

    await migrator.activateCandidate(candidate, old.databaseName);

    const rootPuts = puts.mock.calls
      .map(([value], i) => ({ value: value as unknown, store: puts.mock.contexts[i] as IDBObjectStore }))
      .filter(({ store }) => store.transaction.db.name === 'tj-root');
    const flip = rootPuts.find(({ value }) => (value as { key: string }).key === 'current');
    expect(flip?.value).toEqual({ key: 'current', databaseName: candidate });
    expect(rootPuts.filter(({ store }) => store.transaction === flip?.store.transaction).map(({ value }) => value)).toEqual(
      expect.arrayContaining([
        { key: 'current', databaseName: candidate },
        { key: 'candidates', databaseNames: [] },
        { key: 'retired', databaseNames: [old.databaseName] },
      ]),
    );
    expect(await rawGet('tj-root', 'pointer', 'current')).toEqual({ key: 'current', databaseName: candidate });
    expect(await rawGet('tj-root', 'pointer', 'candidates')).toEqual({ key: 'candidates', databaseNames: [] });
    expect((await migrator.readSnapshot([], () => Promise.resolve(null))).binding.databaseName).toBe(candidate);
  });

  it('should delete a retired database after activation and on the next inspection if deletion was interrupted', async () => {
    const old = await oldWorkspace();
    old.session.close();
    const migrator = persistence('m');
    const { databaseName: candidate } = await migrator.createCandidate();
    await migrator.copySnapshot(old.databaseName, candidate, identity);

    await migrator.activateCandidate(candidate, old.databaseName);

    expect((await factory.databases()).map((d) => d.name).sort()).toEqual(['tj-root', candidate]);
    expect(await rawGet('tj-root', 'pointer', 'retired')).toEqual({ key: 'retired', databaseNames: [] });

    // An activation whose deletion was interrupted: the retired database is still listed.
    await rawOpen('tj-ws-interrupted', 1, (db) => db.createObjectStore('meta', { keyPath: 'key' })).then((db) => db.close());
    const root = await rawOpen('tj-root');
    await new Promise<void>((resolve) => {
      const tx = root.transaction('pointer', 'readwrite');
      tx.objectStore('pointer').put({ key: 'retired', databaseNames: ['tj-ws-interrupted'] });
      tx.oncomplete = () => resolve();
    });
    root.close();

    const inspection = await persistence('next').inspectRoot();

    expect(inspection).toEqual(
      expect.objectContaining({ kind: 'KnownWorkspace', databaseName: candidate, deletedOrphans: ['tj-ws-interrupted'] }),
    );
    expect((await factory.databases()).map((d) => d.name).sort()).toEqual(['tj-root', candidate]);
    expect(await rawGet('tj-root', 'pointer', 'retired')).toEqual({ key: 'retired', databaseNames: [] });
  });

  it('should delete a listed candidate that the pointer does not name on the next inspection, leaving the pointer unchanged', async () => {
    const old = await oldWorkspace();
    old.session.close();
    const { databaseName: abandoned } = await persistence('m').createCandidate();

    const inspection = await persistence('next').inspectRoot();

    expect(inspection).toEqual(
      expect.objectContaining({ kind: 'KnownWorkspace', databaseName: old.databaseName, deletedOrphans: [abandoned] }),
    );
    expect((await factory.databases()).map((d) => d.name).sort()).toEqual(['tj-root', old.databaseName]);
    expect(await rawGet('tj-root', 'pointer', 'candidates')).toEqual({ key: 'candidates', databaseNames: [] });
    expect(await rawGet('tj-root', 'pointer', 'current')).toEqual({ key: 'current', databaseName: old.databaseName });
  });
});

describe('discarding', () => {
  it('should delete the candidate and leave the old database stores and the pointer exactly as they were', async () => {
    const old = await oldWorkspace();
    old.session.close();
    const before = await dump(old.databaseName);
    const pointer = await rawGet('tj-root', 'pointer', 'current');
    const migrator = persistence('m');
    const { databaseName: candidate } = await migrator.createCandidate();
    await migrator.copySnapshot(old.databaseName, candidate, identity);

    await migrator.discardCandidate(candidate);

    expect((await factory.databases()).map((d) => d.name).sort()).toEqual(['tj-root', old.databaseName]);
    expect(await rawGet('tj-root', 'pointer', 'candidates')).toEqual({ key: 'candidates', databaseNames: [] });
    expect(await rawGet('tj-root', 'pointer', 'current')).toEqual(pointer);
    expect(await dump(old.databaseName)).toEqual(before);
  });
});

describe('versionchange', () => {
  it('should close its Workspace connection and mark the session superseded when another connection requests a version change', async () => {
    const p = persistence();
    const created = await p.createWorkspace([]);
    if (created.kind !== 'Created') throw new Error('workspace not created');
    await p.commit({ checks: [], writes: [{ op: 'put', store: 'trades', value: { tradeId: 'trade-1' } }] });
    expect(p.isSuperseded()).toBe(false);

    const later = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(created.databaseName, 2);
      request.onblocked = () => reject(new Error('blocked: the Workspace connection stayed open'));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('open failed'));
    });
    later.close();

    expect(p.isSuperseded()).toBe(true);
  });
});

describe('lifecycle lock', () => {
  it('should run at most one migration at a time; a second caller waits and then sees the already-activated Workspace', async () => {
    const old = await oldWorkspace();
    old.session.close();
    const meta = await rawOpen(old.databaseName);
    await new Promise<void>((resolve) => {
      const tx = meta.transaction('meta', 'readwrite');
      tx.objectStore('meta').put({ key: 'schema', schemaVersion: 1 });
      tx.oncomplete = () => resolve();
    });
    meta.close();
    const lock = createInProcessLifecycleLock();
    let running = 0;
    let most = 0;

    // A caller that migrates under the lock only when its inspection under the lock needs it.
    function migrate(p: Persistence, l: LifecycleLock) {
      return l.run(async () => {
        most = Math.max(most, ++running);
        try {
          const inspection = await p.inspectRoot();
          if (inspection.kind === 'KnownWorkspace') return { activated: false, databaseName: inspection.databaseName };
          if (inspection.kind !== 'OlderSchema') throw new Error(`unexpected ${inspection.kind}`);
          const { databaseName } = await p.createCandidate();
          await p.copySnapshot(inspection.databaseName, databaseName, identity);
          await p.activateCandidate(databaseName, inspection.databaseName);
          return { activated: true, databaseName };
        } finally {
          running--;
        }
      });
    }

    const [first, second] = await Promise.all([migrate(persistence('a'), lock), migrate(persistence('b'), lock)]);

    expect(most).toBe(1);
    expect(first).toEqual({ activated: true, databaseName: 'tj-ws-a-0001' });
    expect(second).toEqual({ activated: false, databaseName: 'tj-ws-a-0001' });
    expect((await factory.databases()).map((d) => d.name).sort()).toEqual(['tj-root', 'tj-ws-a-0001']);
  });
});
