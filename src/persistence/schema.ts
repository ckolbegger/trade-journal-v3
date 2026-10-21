export const ROOT_DATABASE = 'tj-root';
export const ROOT_VERSION = 1;
export const WORKSPACE_PREFIX = 'tj-ws-';
export const POINTER_KEY = 'current';

// The Workspace schema this release reads and writes.
export const SCHEMA_VERSION = 2;

export function upgradeRoot(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    db.createObjectStore('pointer', { keyPath: 'key' });
    db.createObjectStore('diagnostics', { keyPath: 'id' });
  }
}

export type WorkspaceStore =
  | 'meta'
  | 'catalog'
  | 'journalTypes'
  | 'journalDefinitions'
  | 'journalEntries'
  | 'journalDeclines'
  | 'journalObligations'
  | 'trades';

export const WORKSPACE_KEY_PATHS: Readonly<Record<WorkspaceStore, string>> = {
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
};

// Stores holding private derived state: never copied by migration or backed up, only rebuilt.
export const PRIVATE_STORES: ReadonlySet<WorkspaceStore> = new Set(['journalObligations']);

export const WORKSPACE_VERSION = 1;

// The Workspace indexes: private derived state, created by migration and rebuildable from records.
export function createWorkspaceIndexes(store: (name: WorkspaceStore) => IDBObjectStore): void {
  const entries = store('journalEntries');
  // One current outcome per Journal obligation key (Journal, "Debt and obligation semantics").
  entries.createIndex('byObligation', 'obligationKey', { unique: true });
  entries.createIndex('byAnchorTrade', 'anchorTradeId');
  // The authoritative stored Lifecycle State, ordered by Plan time, for current-state lists.
  store('trades').createIndex('byLifecycle', ['lifecycle', 'planTime', 'tradeId']);
  // The Open list, most recent activity first: `activityDesc` is a descending sort key (D2 A28).
  store('trades').createIndex('byLifecycleActivity', ['lifecycle', 'activityDesc', 'tradeId']);
}

export function upgradeWorkspace(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    const stores = new Map(
      Object.entries(WORKSPACE_KEY_PATHS).map(([store, keyPath]) => [store, db.createObjectStore(store, { keyPath })]),
    );
    createWorkspaceIndexes((name) => stores.get(name)!);
  }
}
