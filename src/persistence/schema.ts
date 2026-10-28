import { Temporal } from 'temporal-polyfill';

export const ROOT_DATABASE = 'tj-root';
export const ROOT_VERSION = 1;
export const WORKSPACE_PREFIX = 'tj-ws-';
export const POINTER_KEY = 'current';

// The Workspace schema this release reads and writes.
export const SCHEMA_VERSION = 3;

export function upgradeRoot(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    db.createObjectStore('pointer', { keyPath: 'key' });
    db.createObjectStore('diagnostics', { keyPath: 'id' });
  }
}

// The session policy a release ships, as plain data. Persistence never imports the policy itself
// (D4 A39); the composition root passes its identity in. Recorded in `meta` (D4 A38).
export interface SessionPolicyIdentity {
  readonly id: string;
  readonly revision: number;
  readonly digest: string;
  readonly coverage: { readonly first: string; readonly last: string };
}

export type WorkspaceStore =
  | 'meta'
  | 'catalog'
  | 'journalTypes'
  | 'journalDefinitions'
  | 'journalEntries'
  | 'journalDeclines'
  | 'journalObligations'
  | 'trades'
  | 'observations';

export const WORKSPACE_KEY_PATHS: Readonly<Record<WorkspaceStore, string | readonly string[]>> = {
  meta: 'key',
  catalog: 'id',
  journalTypes: 'id',
  journalDefinitions: 'id',
  journalEntries: 'id',
  journalDeclines: 'id',
  // A private index: one current outcome per obligation key, rebuildable from journalEntries
  // and journalDeclines (D2 A28).
  journalObligations: 'obligationKey',
  trades: 'tradeId',
  // One record per Market Data key, with its Mark and acknowledgment chains (D4 A38).
  observations: ['tradingDate', 'instrumentKey'],
};

// A record's primary key, whether its store's key path is one field or several.
export function keyOf(store: WorkspaceStore, value: Record<string, unknown>): IDBValidKey {
  const keyPath = WORKSPACE_KEY_PATHS[store];
  return (typeof keyPath === 'string' ? value[keyPath] : keyPath.map((field) => value[field])) as IDBValidKey;
}

// Stores holding private derived state: never copied by migration or backed up, only rebuilt.
export const PRIVATE_STORES: ReadonlySet<WorkspaceStore> = new Set(['journalObligations']);

export const WORKSPACE_VERSION = 1;

// The Workspace indexes: private derived state, created by migration and rebuildable from records.
export function createWorkspaceIndexes(store: (name: WorkspaceStore) => IDBObjectStore): void {
  const entries = store('journalEntries');
  // One current outcome per Journal obligation key (Journal, "Debt and obligation semantics").
  entries.createIndex('byObligation', 'obligationKey', { unique: true });
  entries.createIndex('byAnchorTrade', 'anchorTradeId');
  // A Trade's declines, for its narrative.
  store('journalDeclines').createIndex('byAnchorTrade', 'anchorTradeId');
  // The authoritative stored Lifecycle State, ordered by Plan time, for current-state lists.
  store('trades').createIndex('byLifecycle', ['lifecycle', 'planTime', 'tradeId']);
  // The Open list, most recent activity first: `activityDesc` is a descending sort key (D2 A28).
  store('trades').createIndex('byLifecycleActivity', ['lifecycle', 'activityDesc', 'tradeId']);
  // Stale context and gap enumeration read one Instrument's observations by date (D4 A38).
  store('observations').createIndex('byInstrumentDate', ['instrumentKey', 'tradingDate']);
}

export function upgradeWorkspace(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    const stores = new Map(
      Object.entries(WORKSPACE_KEY_PATHS).map(([store, keyPath]) => [store, db.createObjectStore(store, { keyPath: keyPath as string | string[] })]),
    );
    createWorkspaceIndexes((name) => stores.get(name)!);
  }
}

// The private `activityDesc` sort key over a Trade's Last Activity (D2 A28, A139): ascending key
// order is descending Last Activity. Each digit of the zero-padded epoch nanoseconds is replaced by
// its nine's complement, so the key is exact and fixed-width.
export function activityDescOf(lastActivity: string): string {
  const nanoseconds = Temporal.Instant.from(lastActivity).epochNanoseconds.toString().padStart(20, '0');
  return nanoseconds.replace(/\d/g, (digit) => String(9 - Number(digit)));
}
