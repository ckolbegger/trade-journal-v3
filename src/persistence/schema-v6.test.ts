import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { TEST_SESSION_POLICY } from '../../tests/support/session-policy.ts';
import { createPersistence, migrationChain, type Persistence, type StoreRecord, type WriteGate } from './index.ts';

// T7.7: schema version 6 and the v5 to v6 transform (D7 A118, amended by decision 84: a Stock
// Instrument stays { kind: 'Stock', symbol }, so the transform only drops private fields).

let factory: IDBFactory;
beforeEach(() => {
  factory = new IDBFactory();
});

const writable: WriteGate = { current: () => null, recheck: () => Promise.resolve(null) };

function persistence(prefix = 'p'): Persistence {
  let n = 0;
  return createPersistence({
    indexedDB: factory,
    ids: { next: () => `${prefix}-${String(++n).padStart(4, '0')}` },
    writeGate: writable,
    sessionPolicy: TEST_SESSION_POLICY,
  });
}

// Raw IndexedDB access, independent of the code under test.
function rawOpen(name: string, version?: number, upgrade?: (db: IDBDatabase, tx: IDBTransaction) => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = version === undefined ? factory.open(name) : factory.open(name, version);
    if (upgrade) request.onupgradeneeded = () => upgrade(request.result, request.transaction!);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('open failed'));
  });
}

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('request failed'));
  });
}

async function rawGetAll(database: string, store: string): Promise<Record<string, unknown>[]> {
  const db = await rawOpen(database);
  try {
    return (await request(db.transaction(store).objectStore(store).getAll())) as Record<string, unknown>[];
  } finally {
    db.close();
  }
}

type StoreLayout = { keyPath: unknown; indexes: Record<string, [unknown, boolean]> };

async function layout(database: string): Promise<Record<string, StoreLayout>> {
  const db = await rawOpen(database);
  try {
    const result: Record<string, StoreLayout> = {};
    for (const name of Array.from(db.objectStoreNames)) {
      const store = db.transaction(name).objectStore(name);
      const indexes: Record<string, [unknown, boolean]> = {};
      for (const index of Array.from(store.indexNames)) indexes[index] = [store.index(index).keyPath, store.index(index).unique];
      result[name] = { keyPath: store.keyPath, indexes };
    }
    return result;
  } finally {
    db.close();
  }
}

// A Workspace as release D6 left it: schema version 5.
const V5_STORES: Readonly<Record<string, string | string[]>> = {
  meta: 'key',
  catalog: 'id',
  journalTypes: 'id',
  journalDefinitions: 'id',
  journalEntries: 'id',
  journalDeclines: 'id',
  journalObligations: 'obligationKey',
  journalDebts: 'debtId',
  trades: 'tradeId',
  observations: ['tradingDate', 'instrumentKey'],
};

async function seedWorkspace(name: string, records: readonly StoreRecord[], schemaVersion = 5): Promise<void> {
  const db = await rawOpen(name, 1, (upgrading, tx) => {
    for (const [store, keyPath] of Object.entries(V5_STORES)) upgrading.createObjectStore(store, { keyPath });
    tx.objectStore('meta').put({ key: 'schema', schemaVersion });
    tx.objectStore('meta').put({ key: 'content', contentRevision: 5 });
    for (const { store, value } of records) tx.objectStore(store).put({ ...value, revision: 5 });
  });
  db.close();
  const root = await rawOpen('tj-root', 1, (upgrading) => {
    upgrading.createObjectStore('pointer', { keyPath: 'key' });
    upgrading.createObjectStore('diagnostics', { keyPath: 'id' });
  });
  await request(root.transaction('pointer', 'readwrite').objectStore('pointer').put({ key: 'current', databaseName: name }));
  root.close();
}

const stock = { kind: 'Stock', symbol: 'MSFT' };
const V5_TRADE = {
  tradeId: 'trade-1',
  lifecycle: 'Open',
  planTime: '2026-10-12T13:30:00Z',
  facts: [
    {
      factId: 'ex-1',
      kind: 'Execution',
      recordedSequence: 1,
      versions: [{ versionNumber: 1, value: { instrument: stock, quantity: 10, price: '100.00' } }],
    },
  ],
  plannedLegs: [{ legId: 'leg-1', instrument: stock, quantity: 10 }],
  closeReasonFacts: [],
  lastActivity: '2026-10-13T14:00:00Z',
};

const V5_RECORDS: readonly StoreRecord[] = [
  { store: 'meta', value: { key: 'settings', timeZone: 'America/New_York' } },
  { store: 'catalog', value: { id: 'institution-1', label: 'Broker' } },
  { store: 'trades', value: V5_TRADE },
  { store: 'journalEntries', value: { id: 'entry-1', obligationKey: 'plan:trade-1' } },
  { store: 'journalDebts', value: { debtId: 'debt-1', obligationKey: 'pcr:pc-2' } },
  { store: 'observations', value: { tradingDate: '2026-10-12', instrumentKey: 'stock:MSFT', resolutionRevision: 1 } },
];

describe('schema v6 layout', () => {
  it('should create a fresh Workspace at schema version 6 with the same stores and indexes as schema 5', async () => {
    const p = persistence();
    const created = await p.createWorkspace([]);
    if (created.kind !== 'Created') throw new Error('workspace not created');
    p.close();

    expect(await p.inspectRoot()).toEqual(expect.objectContaining({ kind: 'KnownWorkspace', schemaVersion: 6 }));
    expect(await rawGetAll(created.databaseName, 'meta')).toEqual(expect.arrayContaining([{ key: 'schema', schemaVersion: 6 }]));

    // The schema 5 layout, unchanged: the v5 stores, the byInstrumentDate and byLifecycleTerminal indexes.
    const stores = await layout(created.databaseName);
    expect(Object.keys(stores).sort()).toEqual(Object.keys(V5_STORES).sort());
    expect(stores['trades']!.indexes['byLifecycleTerminal']).toEqual([['lifecycle', 'terminalDesc', 'tradeId'], false]);
    expect(Object.keys(stores['observations']!.indexes)).toContain('byInstrumentDate');
  });
});

describe('v5 → v6 transform (A118, decision 84)', () => {
  it('should leave every Stock Instrument as kind and symbol with no multiplier, change nothing else in any store, and migrate a v1 Workspace through every step to v6 inside one candidate', async () => {
    // A stale private terminalTime and terminalDesc are never copied; nothing else is touched.
    const stalePrivate = { terminalTime: '2026-10-13T14:00:00Z', terminalDesc: 'stale' };
    const v5 = V5_RECORDS.map((r) => (r.store === 'trades' ? { ...r, value: { ...r.value, ...stalePrivate } } : r));
    await seedWorkspace('tj-ws-v5', v5);
    const p = persistence('m');
    expect(await p.inspectRoot()).toEqual({ kind: 'OlderSchema', databaseName: 'tj-ws-v5', schemaVersion: 5 });

    const { databaseName: candidate } = await p.createCandidate();
    const { counts } = await p.copySnapshot('tj-ws-v5', candidate, migrationChain(5));

    expect(counts).toEqual({ meta: 1, catalog: 1, trades: 1, journalEntries: 1, journalDebts: 1, observations: 1 });
    const [migrated] = await rawGetAll(candidate, 'trades');
    expect(migrated).toEqual({ ...V5_TRADE, revision: 1 });
    expect(JSON.stringify(migrated)).not.toContain('multiplier');
    for (const store of ['catalog', 'journalEntries', 'journalDebts', 'observations']) {
      const [{ value }] = V5_RECORDS.filter((r) => r.store === store) as [StoreRecord];
      expect(await rawGetAll(candidate, store)).toEqual([{ ...value, revision: 1 }]);
    }
    expect(await rawGetAll(candidate, 'meta')).toEqual(
      expect.arrayContaining([{ key: 'schema', schemaVersion: 6 }, { key: 'settings', timeZone: 'America/New_York', revision: 1 }]),
    );

    // A v1 Workspace passes through every step to v6 in one candidate.
    const v1Trade = { tradeId: 'trade-9', lifecycle: 'Planned', planTime: '2026-10-12T13:30:00Z', plannedLegs: [{ legId: 'leg-1', instrument: stock }], ...stalePrivate };
    await seedWorkspace('tj-ws-v1', [{ store: 'trades', value: v1Trade }, V5_RECORDS[1]!], 1);
    const q = persistence('n');
    const { databaseName: chained } = await q.createCandidate();
    await q.copySnapshot('tj-ws-v1', chained, migrationChain(1));
    expect(await rawGetAll(chained, 'trades')).toEqual([
      { tradeId: 'trade-9', lifecycle: 'Planned', planTime: '2026-10-12T13:30:00Z', plannedLegs: [{ legId: 'leg-1', instrument: stock }], closeReasonFacts: [], revision: 1 },
    ]);
    const names = (await factory.databases()).map((d) => d.name);
    expect(names.filter((n) => n?.startsWith('tj-ws-')).sort()).toEqual([candidate, chained, 'tj-ws-v1', 'tj-ws-v5'].sort());
  });
});
