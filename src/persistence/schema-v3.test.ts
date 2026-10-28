import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { TEST_SESSION_POLICY } from '../../tests/support/session-policy.ts';
import { createPersistence, migrationChain, type Persistence, type StoreRecord, type WriteGate } from './index.ts';

// T4.3: schema version 3, the v2 to v3 transform, and the private rebuild (D4 A38, D8 A139).

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

describe('schema v3 layout', () => {
  it('should create a fresh Workspace at schema version 3 with the observations store keyed by tradingDate and instrumentKey, its byInstrumentDate index, and the meta field sessionPolicy, and no marketDataRevision', async () => {
    const p = persistence();
    const created = await p.createWorkspace([]);
    if (created.kind !== 'Created') throw new Error('workspace not created');
    p.close();

    expect(await p.inspectRoot()).toEqual(expect.objectContaining({ kind: 'KnownWorkspace', schemaVersion: 3 }));
    const db = await rawOpen(created.databaseName);
    const observations = db.transaction('observations').objectStore('observations');
    const keyPath = observations.keyPath;
    const index = observations.index('byInstrumentDate');
    const indexKeyPath = index.keyPath;
    const indexUnique = index.unique;
    db.close();
    const meta = await rawGetAll(created.databaseName, 'meta');

    expect(keyPath).toEqual(['tradingDate', 'instrumentKey']);
    expect(indexKeyPath).toEqual(['instrumentKey', 'tradingDate']);
    expect(indexUnique).toBe(false);
    expect(meta).toEqual(
      expect.arrayContaining([
        { key: 'schema', schemaVersion: 3 },
        { key: 'sessionPolicy', policy: TEST_SESSION_POLICY },
      ]),
    );
    expect(meta.map((m) => m['key'])).not.toContain('marketDataRevision');
  });
});

// A Workspace as release D2/D3 left it: schema version 2, no observations store.
const V2_STORES: Readonly<Record<string, string>> = {
  meta: 'key',
  catalog: 'id',
  journalTypes: 'id',
  journalDefinitions: 'id',
  journalEntries: 'id',
  journalDeclines: 'id',
  journalObligations: 'obligationKey',
  trades: 'tradeId',
};

async function seedV2Workspace(name: string, records: readonly StoreRecord[], schemaVersion = 2): Promise<void> {
  const db = await rawOpen(name, 1, (upgrading, tx) => {
    for (const [store, keyPath] of Object.entries(V2_STORES)) upgrading.createObjectStore(store, { keyPath });
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

const V2_RECORDS: readonly StoreRecord[] = [
  { store: 'meta', value: { key: 'settings', timeZone: 'America/New_York' } },
  { store: 'catalog', value: { id: 'institution-1', label: 'Broker' } },
  { store: 'trades', value: { tradeId: 'trade-1', lifecycle: 'Planned', planTime: '2026-10-12T13:30:00Z', facts: [] } },
  { store: 'journalEntries', value: { id: 'entry-1', obligationKey: 'plan:trade-1' } },
  { store: 'journalDeclines', value: { id: 'decline-1', obligationKey: 'pcr:pc-1' } },
];

describe('v2 → v3 transform', () => {
  it('should copy every v2 store, create an empty observations store, and record the release session-policy identity in meta', async () => {
    await seedV2Workspace('tj-ws-v2', V2_RECORDS);
    const p = persistence('m');
    expect(await p.inspectRoot()).toEqual({ kind: 'OlderSchema', databaseName: 'tj-ws-v2', schemaVersion: 2 });

    const { databaseName: candidate } = await p.createCandidate();
    const { counts } = await p.copySnapshot('tj-ws-v2', candidate, migrationChain(2));

    expect(counts).toEqual({ meta: 1, catalog: 1, trades: 1, journalEntries: 1, journalDeclines: 1 });
    for (const { store, value } of V2_RECORDS.filter((r) => r.store !== 'meta')) {
      expect(await rawGetAll(candidate, store)).toEqual([{ ...value, revision: 1 }]);
    }
    expect(await rawGetAll(candidate, 'observations')).toEqual([]);
    expect(await rawGetAll(candidate, 'meta')).toEqual([
      { key: 'content', contentRevision: 1 },
      { key: 'schema', schemaVersion: 3 },
      { key: 'sessionPolicy', policy: TEST_SESSION_POLICY },
      { key: 'settings', timeZone: 'America/New_York', revision: 1 },
    ]);
  });

  it('should drop every private Trade field, activityDesc and exposureStart, in the v2 to v3 transform', () => {
    const value = { tradeId: 'trade-1', lifecycle: 'Open', facts: [], activityDesc: 'stale', exposureStart: '2026-10-09T15:00:00Z' };
    const out = migrationChain(2)({ store: 'trades', value });
    expect(out).toEqual({ store: 'trades', value: { tradeId: 'trade-1', lifecycle: 'Open', facts: [] } });
    expect(Object.keys(out.value)).not.toContain('activityDesc');
    expect(Object.keys(out.value)).not.toContain('exposureStart');
  });

  it('should migrate a v1 Workspace through v1→v2 and v2→v3 inside one candidate', async () => {
    const stale = { tradeId: 'trade-1', lifecycle: 'Planned', planTime: '2026-10-12T13:30:00Z', activityDesc: 'stale-private-key' };
    await seedV2Workspace('tj-ws-v1', [{ store: 'trades', value: stale }, V2_RECORDS[1]!], 1);
    const p = persistence('m');
    expect(await p.inspectRoot()).toEqual({ kind: 'OlderSchema', databaseName: 'tj-ws-v1', schemaVersion: 1 });

    const { databaseName: candidate } = await p.createCandidate();
    await p.copySnapshot('tj-ws-v1', candidate, migrationChain(1));

    // v1→v2 dropped the private key; v2→v3 left the record otherwise as it was; one candidate only.
    expect(await rawGetAll(candidate, 'trades')).toEqual([
      { tradeId: 'trade-1', lifecycle: 'Planned', planTime: '2026-10-12T13:30:00Z', revision: 1 },
    ]);
    expect(await rawGetAll(candidate, 'catalog')).toHaveLength(1);
    expect(await rawGetAll(candidate, 'observations')).toEqual([]);
    const names = (await factory.databases()).map((d) => d.name).sort();
    expect(names).toEqual(['tj-root', candidate, 'tj-ws-v1'].sort());
  });
});

const observation = (tradingDate: string, instrumentKey: string) => ({ tradingDate, instrumentKey, resolutionRevision: 1 });

async function indexContents(database: string, store: string, index: string): Promise<{ keyPath: unknown; records: unknown[] }> {
  const db = await rawOpen(database);
  try {
    const target = db.transaction(store).objectStore(store).index(index);
    return { keyPath: target.keyPath, records: await request(target.getAll()) };
  } finally {
    db.close();
  }
}

describe('rebuild', () => {
  it('should rebuild byInstrumentDate from observations with identical contents', async () => {
    const p = persistence();
    const created = await p.createWorkspace([]);
    if (created.kind !== 'Created') throw new Error('workspace not created');
    await p.commit({
      checks: [],
      writes: [
        { op: 'put', store: 'observations', value: observation('2026-10-13', 'stock:MSFT') },
        { op: 'put', store: 'observations', value: observation('2026-10-12', 'stock:MSFT') },
        { op: 'put', store: 'observations', value: observation('2026-10-12', 'stock:AAPL') },
      ],
    });
    const name = created.databaseName;
    const before = await indexContents(name, 'observations', 'byInstrumentDate');
    const stored = await rawGetAll(name, 'observations');
    expect(before.records).toHaveLength(3);

    await p.rebuildCandidate(name);

    const after = await indexContents(name, 'observations', 'byInstrumentDate');
    expect(after).toEqual(before);
    expect(after.keyPath).toEqual(['instrumentKey', 'tradingDate']);
    expect(after.records.map((r) => (r as { instrumentKey: string; tradingDate: string }).instrumentKey + (r as { tradingDate: string }).tradingDate)).toEqual([
      'stock:AAPL2026-10-12',
      'stock:MSFT2026-10-12',
      'stock:MSFT2026-10-13',
    ]);
    expect(await rawGetAll(name, 'observations')).toEqual(stored);
  });

  it('should compute exposureStart for each Trade document from its first opening Execution during the private rebuild that follows the chain', async () => {
    const execution = (factId: string, economicTime: string, recordedSequence: number) => ({
      factId,
      kind: 'Execution',
      recordedSequence,
      versions: [{ versionNumber: 1, value: { economicTime, action: 'Buy', quantity: '10' } }],
    });
    const plan = { factId: 'plan-1', kind: 'Plan', recordedSequence: 1, versions: [{ versionNumber: 1, value: { economicTime: '2026-10-01T13:30:00Z' } }] };
    await seedV2Workspace('tj-ws-v2', [
      // Recorded later than its earlier-dated sibling, as an earlier-dated Position Change is.
      { store: 'trades', value: { tradeId: 'open', lifecycle: 'Open', facts: [plan, execution('e1', '2026-10-12T14:30:00Z', 2), execution('e2', '2026-10-09T15:00:00Z', 3)] } },
      { store: 'trades', value: { tradeId: 'planned', lifecycle: 'Planned', facts: [plan] } },
      // A private field is never trusted from a source: it is recomputed.
      { store: 'trades', value: { tradeId: 'stale', lifecycle: 'Open', exposureStart: '1999-01-01T00:00:00Z', facts: [plan, execution('e3', '2026-10-05T14:00:00Z', 2)] } },
    ]);
    const p = persistence('m');
    const { databaseName: candidate } = await p.createCandidate();
    await p.copySnapshot('tj-ws-v2', candidate, migrationChain(2));
    // The chain alone leaves the private field unset.
    expect((await rawGetAll(candidate, 'trades')).some((t) => 'exposureStart' in t)).toBe(false);

    await p.rebuildCandidate(candidate);

    const byId = Object.fromEntries((await rawGetAll(candidate, 'trades')).map((t) => [t['tradeId'] as string, t]));
    expect(byId['open']?.['exposureStart']).toBe('2026-10-09T15:00:00Z');
    expect(byId['stale']?.['exposureStart']).toBe('2026-10-05T14:00:00Z');
    // No Executions: the field is absent, never null or empty.
    expect(byId['planned']).not.toHaveProperty('exposureStart');
    expect(byId['open']).toEqual(expect.objectContaining({ tradeId: 'open', lifecycle: 'Open', revision: 1 }));
  });
});
