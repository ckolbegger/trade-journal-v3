import { openDatabase } from './idb.ts';
import { activityDescOf, createWorkspaceIndexes } from './schema.ts';

// Drops every index of a Workspace database and recreates it through the migration path, in one
// version-change transaction, so every index is rebuilt from the stored records (AC-REBUILD-001).
// Private fields and the private obligation store are recomputed from authoritative records
// first (D2 A28, A139).
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
    rebuildObligations(tx);
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

// The Journal obligation index (D2 A28): one record per obligation key naming its current outcome,
// rebuilt from the Entries and declines that hold the key, each at the content revision its
// outcome was written at, since both were written by the same commit.
function rebuildObligations(tx: IDBTransaction): void {
  const obligations = tx.objectStore('journalObligations');
  obligations.clear();
  for (const [store, kind] of [['journalEntries', 'Entry'], ['journalDeclines', 'Decline']] as const) {
    const request = tx.objectStore(store).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const outcome = cursor.value as { id: string; obligationKey?: string; revision?: number };
      if (outcome.obligationKey !== undefined) {
        obligations.put({ obligationKey: outcome.obligationKey, outcome: { kind, id: outcome.id }, revision: outcome.revision });
      }
      cursor.continue();
    };
  }
}
