import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { TEST_SESSION_POLICY } from '../../tests/support/session-policy.ts';
import { createPersistence, migrationChain, type Persistence, type StoreRecord, type WriteGate } from './index.ts';
import { activityDescOf } from './schema.ts';

// T6.5: schema version 5, the v4 to v5 transform, and the private rebuild (D6 A87, A96, P23).

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

async function indexContents(database: string, store: string, index: string): Promise<{ keyPath: unknown; unique: boolean; records: unknown[] }> {
  const db = await rawOpen(database);
  try {
    const target = db.transaction(store).objectStore(store).index(index);
    return { keyPath: target.keyPath, unique: target.unique, records: await request(target.getAll()) };
  } finally {
    db.close();
  }
}

describe('schema v5 layout', () => {
  it('should create a fresh Workspace at schema version 5 with the sparse byLifecycleTerminal index on trades', async () => {
    const p = persistence();
    const created = await p.createWorkspace([]);
    if (created.kind !== 'Created') throw new Error('workspace not created');
    p.close();

    expect(await p.inspectRoot()).toEqual(expect.objectContaining({ kind: 'KnownWorkspace', schemaVersion: 6 }));
    const db = await rawOpen(created.databaseName);
    const index = db.transaction('trades').objectStore('trades').index('byLifecycleTerminal');
    const shape = [index.keyPath, index.unique];
    db.close();

    expect(shape).toEqual([['lifecycle', 'terminalDesc', 'tradeId'], false]);
    expect(await rawGetAll(created.databaseName, 'meta')).toEqual(expect.arrayContaining([{ key: 'schema', schemaVersion: 6 }]));
  });
});

// A Workspace as release D5 left it: schema version 4, with the journalDebts store.
const V4_STORES: Readonly<Record<string, string | string[]>> = {
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

async function seedWorkspace(name: string, records: readonly StoreRecord[], schemaVersion = 4): Promise<void> {
  const db = await rawOpen(name, 1, (upgrading, tx) => {
    for (const [store, keyPath] of Object.entries(V4_STORES)) upgrading.createObjectStore(store, { keyPath });
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

const V4_RECORDS: readonly StoreRecord[] = [
  { store: 'meta', value: { key: 'settings', timeZone: 'America/New_York' } },
  { store: 'catalog', value: { id: 'institution-1', label: 'Broker' } },
  { store: 'trades', value: { tradeId: 'trade-1', lifecycle: 'Planned', planTime: '2026-10-12T13:30:00Z', facts: [] } },
  { store: 'trades', value: { tradeId: 'trade-2', lifecycle: 'Open', planTime: '2026-10-12T13:30:00Z', facts: [], deviations: [], lastActivity: '2026-10-13T14:00:00Z' } },
  { store: 'journalEntries', value: { id: 'entry-1', obligationKey: 'plan:trade-1' } },
  { store: 'journalDeclines', value: { id: 'decline-1', obligationKey: 'pcr:pc-1' } },
  { store: 'journalDebts', value: { debtId: 'debt-1', obligationKey: 'pcr:pc-2', anchor: { kind: 'Trade', tradeId: 'trade-2' } } },
  { store: 'observations', value: { tradingDate: '2026-10-12', instrumentKey: 'stock:MSFT', resolutionRevision: 1 } },
];

describe('v4 → v5 transform', () => {
  it('should copy every v4 store, give each Trade document an empty Close Reason fact list and no terminalTime, and migrate a v1 Workspace through every step to v5 inside one candidate', async () => {
    // A stale private terminalTime and terminalDesc on a v4 Trade are never copied.
    const stalePrivate = { terminalTime: '2026-10-13T14:00:00Z', terminalDesc: activityDescOf('2026-10-13T14:00:00Z') };
    const v4 = V4_RECORDS.map((r) => (r.store === 'trades' && r.value['tradeId'] === 'trade-2' ? { ...r, value: { ...r.value, ...stalePrivate } } : r));
    await seedWorkspace('tj-ws-v4', v4);
    const p = persistence('m');
    expect(await p.inspectRoot()).toEqual({ kind: 'OlderSchema', databaseName: 'tj-ws-v4', schemaVersion: 4 });

    const { databaseName: candidate } = await p.createCandidate();
    const { counts } = await p.copySnapshot('tj-ws-v4', candidate, migrationChain(4));

    expect(counts).toEqual({ meta: 1, catalog: 1, trades: 2, journalEntries: 1, journalDeclines: 1, journalDebts: 1, observations: 1 });
    expect(await rawGetAll(candidate, 'trades')).toEqual([
      { ...V4_RECORDS[2]!.value, closeReasonFacts: [], revision: 1 },
      { ...V4_RECORDS[3]!.value, closeReasonFacts: [], revision: 1 },
    ]);
    for (const store of ['catalog', 'journalEntries', 'journalDeclines', 'journalDebts', 'observations']) {
      const [{ value }] = V4_RECORDS.filter((r) => r.store === store) as [StoreRecord];
      expect(await rawGetAll(candidate, store)).toEqual([{ ...value, revision: 1 }]);
    }
    expect(await rawGetAll(candidate, 'meta')).toEqual(
      expect.arrayContaining([{ key: 'schema', schemaVersion: 6 }, { key: 'settings', timeZone: 'America/New_York', revision: 1 }]),
    );

    // A v1 Workspace passes through v1→v2, v2→v3, v3→v4, and v4→v5 in one candidate.
    const stale = { tradeId: 'trade-9', lifecycle: 'Planned', planTime: '2026-10-12T13:30:00Z', activityDesc: 'stale-private-key', ...stalePrivate };
    await seedWorkspace('tj-ws-v1', [{ store: 'trades', value: stale }, V4_RECORDS[1]!], 1);
    const q = persistence('n');
    const { databaseName: chained } = await q.createCandidate();
    await q.copySnapshot('tj-ws-v1', chained, migrationChain(1));
    expect(await rawGetAll(chained, 'trades')).toEqual([
      { tradeId: 'trade-9', lifecycle: 'Planned', planTime: '2026-10-12T13:30:00Z', closeReasonFacts: [], revision: 1 },
    ]);
    const names = (await factory.databases()).map((d) => d.name);
    expect(names.filter((n) => n?.startsWith('tj-ws-')).sort()).toEqual([candidate, chained, 'tj-ws-v1', 'tj-ws-v4'].sort());
  });
});

const positionChange = (factId: string, recordedSequence: number, economicTime: string) => ({
  factId,
  kind: 'PositionChange',
  recordedSequence,
  versions: [{ versionNumber: 1, value: { economicTime, originTradeId: 'x', participatingTradeIds: ['x'], memberIds: [] } }],
});

const trade = (tradeId: string, lifecycle: string, changeTimes: readonly string[], extra: Record<string, unknown> = {}) => ({
  tradeId,
  lifecycle,
  planTime: '2026-10-12T13:30:00Z',
  facts: changeTimes.map((time, i) => positionChange(`${tradeId}-pc${i + 1}`, i + 1, time)),
  closeReasonFacts: [],
  ...extra,
});

describe('rebuild', () => {
  it('should rebuild byLifecycleTerminal from trades with identical contents, holding only Closed Trades', async () => {
    const p = persistence();
    const created = await p.createWorkspace([]);
    if (created.kind !== 'Created') throw new Error('workspace not created');
    const name = created.databaseName;
    // A Closed Trade's terminal Position Change is its last fact; its Economic Time is terminalTime.
    const closed = (tradeId: string, changeTimes: readonly string[]) => {
      const terminalTime = changeTimes[changeTimes.length - 1]!;
      return trade(tradeId, 'Closed', changeTimes, { terminalTime, terminalDesc: activityDescOf(terminalTime) });
    };
    await p.commit({
      checks: [],
      writes: [
        { op: 'put', store: 'trades', value: closed('trade-b', ['2026-10-12T14:00:00Z', '2026-10-13T15:00:00Z']) },
        { op: 'put', store: 'trades', value: closed('trade-a', ['2026-10-12T14:30:00Z', '2026-10-13T15:00:00Z']) },
        { op: 'put', store: 'trades', value: closed('trade-c', ['2026-10-12T14:00:00Z', '2026-10-14T15:00:00Z']) },
        { op: 'put', store: 'trades', value: trade('trade-open', 'Open', ['2026-10-12T14:00:00Z']) },
        { op: 'put', store: 'trades', value: trade('trade-planned', 'Planned', []) },
      ],
    });
    const before = await indexContents(name, 'trades', 'byLifecycleTerminal');
    const stored = await rawGetAll(name, 'trades');
    expect(before.records.map((r) => (r as { tradeId: string }).tradeId)).toEqual(['trade-c', 'trade-a', 'trade-b']);

    // The rebuild recomputes the private fields from the facts, not from the stored ones: a stale
    // terminalDesc on a Closed Trade and a leftover terminalTime on an Open one are both repaired.
    const db = await rawOpen(name);
    const writes = db.transaction('trades', 'readwrite').objectStore('trades');
    await request(writes.put({ ...stored.find((t) => t['tradeId'] === 'trade-c'), terminalDesc: 'stale' }));
    await request(writes.put({ ...stored.find((t) => t['tradeId'] === 'trade-open'), terminalTime: '2026-10-14T15:00:00Z', terminalDesc: activityDescOf('2026-10-14T15:00:00Z') }));
    db.close();

    await p.rebuildCandidate(name);

    expect(await indexContents(name, 'trades', 'byLifecycleTerminal')).toEqual(before);
    expect(before.keyPath).toEqual(['lifecycle', 'terminalDesc', 'tradeId']);
    expect(await rawGetAll(name, 'trades')).toEqual(stored);
  });
});
