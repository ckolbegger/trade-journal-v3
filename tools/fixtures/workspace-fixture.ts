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

// The normalized views the release that froze a fixture of this schema version presented: the
// Planned list (and from schema 2 the Open list) and every listed Trade's Detail. Bindings are opaque
// revision tokens and omitted.
// From schema 3 it adds the Daily Review (D4 T4.29): its overview and each eligible Trade's Action form,
// without their bindings, which are opaque revision tokens like the views' own.
// From schema 4 it adds the Debt-bearing views (D5 T5.20, A73): the Outstanding Debt list, without each
// Debt's revision token, and each Trade's Outstanding reflections in the Review's Trade walk, without their
// save bindings. Trade Detail already carries each Trade's Debt, settled or declined outcome in its narrative.
export async function viewsOf(app: Pick<Application, 'TradeViewsAndReporting'> & Partial<Pick<Application, 'DailyReview' | 'Journal'>>, schemaVersion: number, asOf?: string): Promise<unknown> {
  const planned = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Planned' });
  if (planned.kind !== 'Ready') throw new Error(`browseTrades Planned: ${planned.kind}`);
  const open = schemaVersion >= 2 ? await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' }) : undefined;
  if (open && open.kind !== 'Ready') throw new Error(`browseTrades Open: ${open.kind}`);
  const details = [];
  for (const item of [...planned.view.items, ...(open?.view.items ?? [])]) {
    const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId: item.tradeId });
    if (detail.kind !== 'Ready') throw new Error(`getTradeDetail ${item.tradeId}: ${detail.kind}`);
    details.push(detail.view);
  }
  const lists = open ? { planned: planned.view.items, open: open.view.items, details } : { planned: planned.view.items, details };
  if (schemaVersion < 3) return normalize(lists);
  if (!app.DailyReview || asOf === undefined) throw new Error('viewsOf: schema 3 needs DailyReview and the as-of instant');
  const review = await reviewViews(app.DailyReview, asOf);
  if (schemaVersion < 4) return normalize({ ...lists, ...review });
  if (!app.Journal) throw new Error('viewsOf: schema 4 needs Journal');
  return normalize({ ...lists, ...review, debts: await outstandingDebts(app.Journal) });
}

async function outstandingDebts(journal: Application['Journal']) {
  const outstanding = await journal.query({ scope: 'OutstandingDebt' });
  if (!('debts' in outstanding)) throw new Error(`Journal.query OutstandingDebt: ${outstanding.kind}`);
  return outstanding.debts.map((debt) => without(debt, 'revision'));
}

// A copy of the record without one opaque revision token.
function without(record: object, key: string): object {
  return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));
}

// The Debt-bearing views alone, for a Workspace migrated from an earlier schema (A73). A Workspace
// with no Open Trade has an empty Review, so it has no Trade walk.
export async function debtViewsOf(app: Pick<Application, 'DailyReview' | 'Journal'>, asOf: string): Promise<unknown> {
  const review = await reviewViews(app.DailyReview, asOf, true);
  return normalize({ ...review, debts: await outstandingDebts(app.Journal) });
}

async function reviewViews(dailyReview: Application['DailyReview'], asOf: string, emptyIsNoTrades = false) {
  const opened = await dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf });
  if (opened.kind === 'Empty' && emptyIsNoTrades) return { reviewTrades: [] };
  if (opened.kind !== 'Ready')throw new Error(`DailyReview.open: ${opened.kind}`);
  const { binding, ...review } = opened;
  const trades = [];
  for (const family of opened.families) {
    if (family.family !== 'Trades') continue;
    for (const item of family.trades) {
      const form = await dailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId: item.tradeId, binding });
      if (form.kind !== 'Ready') throw new Error(`DailyReview.getTrade ${item.tradeId}: ${form.kind}`);
      trades.push({ ...form.trade, saveBinding: undefined, reflections: form.trade.reflections.map((owed) => without(owed, 'saveBinding')) });
    }
  }
  return { review, reviewTrades: trades };
}
