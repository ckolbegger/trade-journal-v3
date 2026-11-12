import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { TEST_SESSION_POLICY } from '../../tests/support/session-policy.ts';
import { createPersistence, migrationChain, type Persistence, type StoreRecord, type WriteGate } from './index.ts';

// T7S.1: schema version 7 and the v6 to v7 transform (D7S A199: schema 7 admits the StructureValue
// condition kind; every stored condition already carries kind, so the transform only drops private fields).

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

async function storeNames(database: string): Promise<string[]> {
  const db = await rawOpen(database);
  try {
    return Array.from(db.objectStoreNames).sort();
  } finally {
    db.close();
  }
}

// A Workspace as release D7 left it: schema version 6 (the same stores as schema 5).
const V6_STORES: Readonly<Record<string, string | string[]>> = {
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

async function seedWorkspace(name: string, records: readonly StoreRecord[], schemaVersion = 6): Promise<void> {
  const db = await rawOpen(name, 1, (upgrading, tx) => {
    for (const [store, keyPath] of Object.entries(V6_STORES)) upgrading.createObjectStore(store, { keyPath });
    tx.objectStore('meta').put({ key: 'schema', schemaVersion });
    tx.objectStore('meta').put({ key: 'content', contentRevision: 6 });
    for (const { store, value } of records) tx.objectStore(store).put({ ...value, revision: 6 });
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
const call = { kind: 'Option', symbol: 'XYZ', root: 'XYZ', expiration: '2026-11-20', right: 'Call', strike: '55', multiplier: 100 };
const V6_TRADE = {
  tradeId: 'trade-1',
  lifecycle: 'Open',
  planTime: '2026-10-12T13:30:00Z',
  facts: [
    {
      factId: 'plan-1',
      kind: 'Plan',
      recordedSequence: 1,
      versions: [
        {
          versionNumber: 1,
          value: { legs: [{ legId: 'leg-1', instrument: call, quantity: 2 }], stops: [{ kind: 'UnderlyingPrice', price: '48.00' }], targets: [], exerciseIntent: 'NotAuthorized' },
        },
      ],
    },
    {
      factId: 'ex-1',
      kind: 'Execution',
      recordedSequence: 2,
      versions: [{ versionNumber: 1, value: { instrument: call, quantity: 2, price: '2.00' } }],
    },
  ],
  plannedLegs: [{ legId: 'leg-1', instrument: call, quantity: 2 }],
  closeReasonFacts: [],
  lastActivity: '2026-10-13T14:00:00Z',
};

const V6_RECORDS: readonly StoreRecord[] = [
  { store: 'meta', value: { key: 'settings', timeZone: 'America/New_York' } },
  { store: 'catalog', value: { id: 'institution-1', label: 'Broker' } },
  { store: 'trades', value: V6_TRADE },
  { store: 'journalEntries', value: { id: 'entry-1', obligationKey: 'plan:trade-1' } },
  { store: 'observations', value: { tradingDate: '2026-10-12', instrumentKey: 'XYZ261120C00055000', resolutionRevision: 1 } },
];

describe('schema 7 (A199)', () => {
  it('should open a schema-6 database holding an option Trade at schema 7 with every authoritative record unchanged, private fields dropped for the rebuild, and migrationChain(1) reaching 7', async () => {
    // A stale private terminalTime and terminalDesc are never copied; nothing else is touched.
    const stalePrivate = { terminalTime: '2026-10-13T14:00:00Z', terminalDesc: 'stale' };
    const v6 = V6_RECORDS.map((r) => (r.store === 'trades' ? { ...r, value: { ...r.value, ...stalePrivate } } : r));
    await seedWorkspace('tj-ws-v6', v6);
    const p = persistence('m');
    expect(await p.inspectRoot()).toEqual({ kind: 'OlderSchema', databaseName: 'tj-ws-v6', schemaVersion: 6 });

    const { databaseName: candidate } = await p.createCandidate();
    const { counts } = await p.copySnapshot('tj-ws-v6', candidate, migrationChain(6));

    expect(counts).toEqual({ meta: 1, catalog: 1, trades: 1, journalEntries: 1, observations: 1 });
    expect(await rawGetAll(candidate, 'trades')).toEqual([{ ...V6_TRADE, revision: 1 }]);
    for (const store of ['catalog', 'journalEntries', 'observations']) {
      const [{ value }] = V6_RECORDS.filter((r) => r.store === store) as [StoreRecord];
      expect(await rawGetAll(candidate, store)).toEqual([{ ...value, revision: 1 }]);
    }
    expect(await rawGetAll(candidate, 'meta')).toEqual(
      expect.arrayContaining([{ key: 'schema', schemaVersion: 7 }, { key: 'settings', timeZone: 'America/New_York', revision: 1 }]),
    );
    expect(await storeNames(candidate)).toEqual(Object.keys(V6_STORES).sort());

    // A v1 Workspace passes through every step to v7 in one candidate.
    const v1Trade = { tradeId: 'trade-9', lifecycle: 'Planned', planTime: '2026-10-12T13:30:00Z', plannedLegs: [{ legId: 'leg-1', instrument: stock }], ...stalePrivate };
    await seedWorkspace('tj-ws-v1', [{ store: 'trades', value: v1Trade }, V6_RECORDS[1]!], 1);
    const q = persistence('n');
    const { databaseName: chained } = await q.createCandidate();
    await q.copySnapshot('tj-ws-v1', chained, migrationChain(1));
    expect(await rawGetAll(chained, 'trades')).toEqual([
      { tradeId: 'trade-9', lifecycle: 'Planned', planTime: '2026-10-12T13:30:00Z', plannedLegs: [{ legId: 'leg-1', instrument: stock }], closeReasonFacts: [], revision: 1 },
    ]);
    expect(await rawGetAll(chained, 'meta')).toEqual(expect.arrayContaining([{ key: 'schema', schemaVersion: 7 }]));
  });
});
