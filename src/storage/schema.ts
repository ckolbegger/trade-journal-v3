import Dexie from 'dexie'

// Dexie schema v1. Later stories add stores via new schema versions; these two
// stores are never reshaped. Every store is keyed by its `id`.

export function createDatabase(name = 'trade-journal'): Dexie {
  const db = new Dexie(name)
  // `seq` is a binding-managed insertion counter (indexed for ordered reads);
  // DexieBinding strips it from every result so records match the in-memory
  // binding exactly.
  db.version(1).stores({
    institutions: 'id, seq',
    accounts: 'id, institutionId, seq',
  })
  return db
}
