// Raw Workspace fixtures (D1 T1.31): a dump of every database with its structure, so a later
// release can rebuild exactly this schema version without its own schema code, and the
// normalized views the release that froze it presented.
// idb checks requests against the IndexedDB classes, which Node lacks; install fake-indexeddb's.
import '../../tests/setup/idb-globals.ts';
import { IDBFactory } from 'fake-indexeddb';
import { createApplication, type Application } from '../../src/app/compose.ts';
import { fixedClock } from '../../src/domain/time/index.ts';
import { createInProcessLifecycleLock } from '../../src/persistence/index.ts';
import { nodeTestHost } from '../../tests/support/node-test-host.ts';
import { TEST_CAPACITY } from '../../tests/support/stack.ts';
import { sequentialIds } from '../../tests/support/workspace.ts';

export const FIXTURES_DIR = 'tests/fixtures';
// Bumped only if the dump format itself changes.
export const GENERATOR_VERSION = 1;

export interface DumpedIndex {
  readonly name: string;
  readonly keyPath: string | string[];
  readonly unique: boolean;
  readonly multiEntry: boolean;
}

export interface DumpedStore {
  readonly keyPath: string | string[] | null;
  readonly autoIncrement: boolean;
  readonly indexes: readonly DumpedIndex[];
  readonly records: readonly unknown[];
}

export interface WorkspaceDump {
  readonly schemaVersion: number;
  readonly generatorVersion: number;
  // The fixed clock the fixture was built at; verification runs at the same instant.
  readonly asOf: string;
  readonly databases: Readonly<Record<string, { readonly version: number; readonly stores: Readonly<Record<string, DumpedStore>> }>>;
}

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('request failed'));
  });
}

export async function dumpDatabases(factory: IDBFactory): Promise<WorkspaceDump['databases']> {
  const out: Record<string, { version: number; stores: Record<string, DumpedStore> }> = {};
  const databases: IDBDatabaseInfo[] = await factory.databases();
  for (const { name } of databases.sort((a, b) => ((a.name ?? '') < (b.name ?? '') ? -1 : 1))) {
    if (!name) continue;
    const db = await request(factory.open(name));
    const stores: Record<string, DumpedStore> = {};
    for (const storeName of Array.from(db.objectStoreNames).sort()) {
      const store = db.transaction(storeName).objectStore(storeName);
      const indexes = Array.from(store.indexNames)
        .sort()
        .map((indexName) => {
          const index = store.index(indexName);
          return { name: indexName, keyPath: index.keyPath, unique: index.unique, multiEntry: index.multiEntry };
        });
      stores[storeName] = { keyPath: store.keyPath, autoIncrement: store.autoIncrement, indexes, records: await request(store.getAll()) };
    }
    db.close();
    out[name] = { version: db.version, stores };
  }
  return out;
}

// Recreates every dumped database, structure and records, in a new factory.
export async function loadDump(dump: WorkspaceDump): Promise<IDBFactory> {
  const factory = new IDBFactory();
  for (const [name, database] of Object.entries(dump.databases)) {
    const open = factory.open(name, database.version);
    open.onupgradeneeded = () => {
      for (const [storeName, store] of Object.entries(database.stores)) {
        const created = open.result.createObjectStore(storeName, { keyPath: store.keyPath, autoIncrement: store.autoIncrement });
        for (const index of store.indexes) created.createIndex(index.name, index.keyPath, { unique: index.unique, multiEntry: index.multiEntry });
      }
    };
    const db = await request(open);
    for (const [storeName, store] of Object.entries(database.stores)) {
      const tx = db.transaction(storeName, 'readwrite');
      for (const record of store.records) tx.objectStore(storeName).put(record);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error ?? new Error('load failed'));
      });
    }
    db.close();
  }
  return factory;
}

export async function launchOn(factory: IDBFactory, asOf: string, ids = sequentialIds('fx')): Promise<Application> {
  const testHost = await nodeTestHost(factory);
  return createApplication({
    indexedDB: factory,
    host: testHost.host,
    clock: fixedClock(asOf),
    ids,
    releaseId: testHost.releaseId,
    capacityRequirement: TEST_CAPACITY,
    locks: createInProcessLifecycleLock(),
  });
}

// Exact values as "numerator/denominator" so views compare as plain JSON.
function normalize(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record['numerator'] === 'bigint' && typeof record['denominator'] === 'bigint') {
      return `${String(record['numerator'])}/${String(record['denominator'])}`;
    }
    return Object.fromEntries(Object.entries(record).map(([key, inner]) => [key, normalize(inner)]));
  }
  return value;
}

// The normalized Planned list and every Detail; bindings are opaque revision tokens and omitted.
export async function viewsOf(app: Pick<Application, 'TradeViewsAndReporting'>): Promise<unknown> {
  const list = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Planned' });
  if (list.kind !== 'Ready') throw new Error(`browseTrades: ${list.kind}`);
  const details = [];
  for (const item of list.view.items) {
    const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId: item.tradeId });
    if (detail.kind !== 'Ready') throw new Error(`getTradeDetail ${item.tradeId}: ${detail.kind}`);
    details.push(detail.view);
  }
  return normalize({ planned: list.view.items, details });
}
