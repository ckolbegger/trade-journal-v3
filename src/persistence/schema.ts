export const ROOT_DATABASE = 'tj-root';
export const ROOT_VERSION = 1;
export const WORKSPACE_PREFIX = 'tj-ws-';
export const POINTER_KEY = 'current';

// The Workspace schema this release reads and writes.
export const SCHEMA_VERSION = 1;

export function upgradeRoot(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    db.createObjectStore('pointer', { keyPath: 'key' });
    db.createObjectStore('diagnostics', { keyPath: 'id' });
  }
}

export type WorkspaceStore = 'meta' | 'catalog' | 'journalTypes' | 'journalDefinitions' | 'journalEntries' | 'trades';

export const WORKSPACE_KEY_PATHS: Readonly<Record<WorkspaceStore, string>> = {
  meta: 'key',
  catalog: 'id',
  journalTypes: 'id',
  journalDefinitions: 'id',
  journalEntries: 'id',
  trades: 'tradeId',
};

export const WORKSPACE_VERSION = 1;

export function upgradeWorkspace(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    for (const [store, keyPath] of Object.entries(WORKSPACE_KEY_PATHS)) {
      db.createObjectStore(store, { keyPath });
    }
  }
}
