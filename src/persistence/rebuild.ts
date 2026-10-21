import { openDatabase } from './idb.ts';
import { activityDescOf, createWorkspaceIndexes } from './schema.ts';

// Drops every index of a Workspace database and recreates it through the migration path, in one
// version-change transaction, so every index is rebuilt from the stored records (AC-REBUILD-001).
// Private fields are recomputed from authoritative ones first (D2 A139).
export async function rebuildPrivateState(indexedDB: IDBFactory, databaseName: string): Promise<void> {
  const existing = await openDatabase(indexedDB, databaseName, undefined);
  const version = existing.version;
  existing.close();
  const rebuilt = await openDatabase(indexedDB, databaseName, version + 1, (db, _oldVersion, tx) => {
    for (const name of Array.from(db.objectStoreNames)) {
      const store = tx.objectStore(name);
      for (const index of Array.from(store.indexNames)) store.deleteIndex(index);
    }
    recomputeActivityKeys(tx.objectStore('trades'));
    createWorkspaceIndexes((name) => tx.objectStore(name));
  });
  rebuilt.close();
}

// Each Trade's private Last Activity sort key, from its stored Last Activity (D2 A28).
function recomputeActivityKeys(trades: IDBObjectStore): void {
  const request = trades.openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    const trade = { ...(cursor.value as Record<string, unknown>) };
    delete trade['activityDesc'];
    if (typeof trade['lastActivity'] === 'string') trade['activityDesc'] = activityDescOf(trade['lastActivity']);
    cursor.update(trade);
    cursor.continue();
  };
}
