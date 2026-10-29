import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { TEST_SESSION_POLICY } from '../../tests/support/session-policy.ts';
import { createPersistence, migrationChain, type Persistence, type StoreRecord, type WriteGate } from './index.ts';

// T5.1: schema version 4, the v3 to v4 transform, and the private rebuild (D5 A61, A62, D8 A139).

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

describe('schema v4 layout', () => {
  it('should create a fresh Workspace at schema version 4 with the journalDebts store keyed by debtId and its byOutstandingDue and byAnchorTrade indexes', async () => {
    const p = persistence();
    const created = await p.createWorkspace([]);
    if (created.kind !== 'Created') throw new Error('workspace not created');
    p.close();

    expect(await p.inspectRoot()).toEqual(expect.objectContaining({ kind: 'KnownWorkspace', schemaVersion: 4 }));
    const db = await rawOpen(created.databaseName);
    const debts = db.transaction('journalDebts').objectStore('journalDebts');
    const keyPath = debts.keyPath;
    const due = debts.index('byOutstandingDue');
    const anchor = debts.index('byAnchorTrade');
    const shape = { due: [due.keyPath, due.unique], anchor: [anchor.keyPath, anchor.unique] };
    db.close();

    expect(keyPath).toBe('debtId');
    expect(shape).toEqual({ due: [['outstandingDue', 'debtId'], false], anchor: ['anchorTradeId', false] });
    expect(await rawGetAll(created.databaseName, 'meta')).toEqual(expect.arrayContaining([{ key: 'schema', schemaVersion: 4 }]));
  });
});

// A Workspace as release D4 left it: schema version 3, with the observations store, no journalDebts.
const V3_STORES: Readonly<Record<string, string | string[]>> = {
  meta: 'key',
  catalog: 'id',
  journalTypes: 'id',
  journalDefinitions: 'id',
  journalEntries: 'id',
  journalDeclines: 'id',
  journalObligations: 'obligationKey',
  trades: 'tradeId',
  observations: ['tradingDate', 'instrumentKey'],
};

async function seedWorkspace(name: string, records: readonly StoreRecord[], schemaVersion = 3): Promise<void> {
  const db = await rawOpen(name, 1, (upgrading, tx) => {
    for (const [store, keyPath] of Object.entries(V3_STORES)) upgrading.createObjectStore(store, { keyPath });
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

const V3_RECORDS: readonly StoreRecord[] = [
  { store: 'meta', value: { key: 'settings', timeZone: 'America/New_York' } },
  { store: 'catalog', value: { id: 'institution-1', label: 'Broker' } },
  { store: 'trades', value: { tradeId: 'trade-1', lifecycle: 'Planned', planTime: '2026-10-12T13:30:00Z', facts: [] } },
  { store: 'journalEntries', value: { id: 'entry-1', obligationKey: 'plan:trade-1' } },
  { store: 'journalDeclines', value: { id: 'decline-1', obligationKey: 'pcr:pc-1' } },
  { store: 'observations', value: { tradingDate: '2026-10-12', instrumentKey: 'stock:MSFT', resolutionRevision: 1 } },
];

describe('v3 → v4 transform', () => {
  it('should copy every v3 store unchanged and create an empty journalDebts store, and migrate a v1 Workspace through every step to v4 inside one candidate', async () => {
    await seedWorkspace('tj-ws-v3', V3_RECORDS);
    const p = persistence('m');
    expect(await p.inspectRoot()).toEqual({ kind: 'OlderSchema', databaseName: 'tj-ws-v3', schemaVersion: 3 });

    const { databaseName: candidate } = await p.createCandidate();
    const { counts } = await p.copySnapshot('tj-ws-v3', candidate, migrationChain(3));

    expect(counts).toEqual({ meta: 1, catalog: 1, trades: 1, journalEntries: 1, journalDeclines: 1, observations: 1 });
    for (const { store, value } of V3_RECORDS.filter((r) => r.store !== 'meta')) {
      expect(await rawGetAll(candidate, store)).toEqual([{ ...value, revision: 1 }]);
    }
    expect(await rawGetAll(candidate, 'journalDebts')).toEqual([]);
    expect(await rawGetAll(candidate, 'meta')).toEqual(
      expect.arrayContaining([{ key: 'schema', schemaVersion: 4 }, { key: 'settings', timeZone: 'America/New_York', revision: 1 }]),
    );

    // A v1 Workspace passes through v1→v2, v2→v3, and v3→v4 in one candidate.
    const stale = { tradeId: 'trade-9', lifecycle: 'Planned', planTime: '2026-10-12T13:30:00Z', activityDesc: 'stale-private-key' };
    await seedWorkspace('tj-ws-v1', [{ store: 'trades', value: stale }, V3_RECORDS[1]!], 1);
    const q = persistence('n');
    const { databaseName: chained } = await q.createCandidate();
    await q.copySnapshot('tj-ws-v1', chained, migrationChain(1));
    expect(await rawGetAll(chained, 'trades')).toEqual([{ tradeId: 'trade-9', lifecycle: 'Planned', planTime: '2026-10-12T13:30:00Z', revision: 1 }]);
    expect(await rawGetAll(chained, 'journalDebts')).toEqual([]);
    const names = (await factory.databases()).map((d) => d.name);
    expect(names.filter((n) => n?.startsWith('tj-ws-')).sort()).toEqual([candidate, chained, 'tj-ws-v1', 'tj-ws-v3'].sort());
  });
});

const debt = (debtId: string, tradeId: string, dueAnchor: string, statuses: readonly string[]) => ({
  debtId,
  obligationKey: `pcr:${debtId}`,
  entryType: 'PositionChangeReflection',
  anchor: { kind: 'Trade', tradeId },
  dueAnchor,
  versions: statuses.map((status, i) => ({ versionId: `${debtId}-v${i + 1}`, status, savedAt: '2026-10-12T14:00:00Z' })),
});

describe('rebuild', () => {
  it('should rebuild byOutstandingDue and byAnchorTrade from journalDebts with identical contents, with only Outstanding Debt in byOutstandingDue', async () => {
    const p = persistence();
    const created = await p.createWorkspace([]);
    if (created.kind !== 'Created') throw new Error('workspace not created');
    const name = created.databaseName;
    const withPrivate = (value: ReturnType<typeof debt>) => ({
      ...value,
      anchorTradeId: value.anchor.tradeId,
      ...(value.versions[value.versions.length - 1]!.status === 'Outstanding' ? { outstandingDue: value.dueAnchor } : {}),
    });
    await p.commit({
      checks: [],
      writes: [
        { op: 'put', store: 'journalDebts', value: withPrivate(debt('debt-b', 'trade-1', '2026-10-12T15:00:00Z', ['Outstanding'])) },
        { op: 'put', store: 'journalDebts', value: withPrivate(debt('debt-a', 'trade-1', '2026-10-12T15:00:00Z', ['Outstanding'])) },
        { op: 'put', store: 'journalDebts', value: withPrivate(debt('debt-c', 'trade-2', '2026-10-09T18:00:00Z', ['Outstanding', 'Settled'])) },
        { op: 'put', store: 'journalEntries', value: { id: 'entry-c', obligationKey: 'pcr:debt-c', settledDebtId: 'debt-c' } },
        { op: 'put', store: 'journalDebts', value: withPrivate(debt('debt-d', 'trade-2', '2026-10-09T19:00:00Z', ['Outstanding', 'Declined'])) },
      ],
    });
    const due = await indexContents(name, 'journalDebts', 'byOutstandingDue');
    const anchor = await indexContents(name, 'journalDebts', 'byAnchorTrade');
    const stored = await rawGetAll(name, 'journalDebts');
    expect(due.records.map((r) => (r as { debtId: string }).debtId)).toEqual(['debt-a', 'debt-b']);
    expect(anchor.records).toHaveLength(4);

    // The rebuild recomputes the private fields from the authoritative record, not the stored ones.
    const db = await rawOpen(name);
    await request(db.transaction('journalDebts', 'readwrite').objectStore('journalDebts').put({ ...stored.find((d) => d['debtId'] === 'debt-c'), outstandingDue: 'stale' }));
    db.close();

    await p.rebuildCandidate(name);

    expect(await indexContents(name, 'journalDebts', 'byOutstandingDue')).toEqual(due);
    expect(await indexContents(name, 'journalDebts', 'byAnchorTrade')).toEqual(anchor);
    expect(due.keyPath).toEqual(['outstandingDue', 'debtId']);
    expect(await rawGetAll(name, 'journalDebts')).toEqual(stored);

    // The obligation index derives a key's outcome from Outstanding Debt, or from the Entry that
    // settled it; a Declined Debt without a decline record names nothing.
    const outcomes: Record<string, unknown> = Object.fromEntries((await rawGetAll(name, 'journalObligations')).map((o) => [o['obligationKey'] as string, o['outcome']]));
    expect(outcomes).toEqual({
      'pcr:debt-a': { kind: 'Debt', id: 'debt-a' },
      'pcr:debt-b': { kind: 'Debt', id: 'debt-b' },
      'pcr:debt-c': { kind: 'Entry', id: 'entry-c' },
    });
  });
});
