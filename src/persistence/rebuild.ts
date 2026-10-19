import { openDatabase } from './idb.ts';
import { createWorkspaceIndexes } from './schema.ts';

// Drops every index of a Workspace database and recreates it through the migration path, in one
// version-change transaction, so every index is rebuilt from the stored records (AC-REBUILD-001).
export async function rebuildPrivateState(indexedDB: IDBFactory, databaseName: string): Promise<void> {
  const existing = await openDatabase(indexedDB, databaseName, undefined);
  const version = existing.version;
  existing.close();
  const rebuilt = await openDatabase(indexedDB, databaseName, version + 1, (db, _oldVersion, tx) => {
    for (const name of Array.from(db.objectStoreNames)) {
      const store = tx.objectStore(name);
      for (const index of Array.from(store.indexNames)) store.deleteIndex(index);
    }
    createWorkspaceIndexes((name) => tx.objectStore(name));
  });
  rebuilt.close();
}
