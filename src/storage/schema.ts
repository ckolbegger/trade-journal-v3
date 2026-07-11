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
  // v2 adds the Trade lifecycle stores plus the two registries the plan form
  // reads. v1 stores are never reshaped.
  db.version(2).stores({
    trades: 'id, accountId, seq',
    strategies: 'id, seq',
    ideaSources: 'id, seq',
  })
  // v3 adds the Journal's two stores. Entries index the nested anchor.tradeId so
  // entriesFor is one indexed query. Earlier stores are never reshaped.
  db.version(3).stores({
    entries: 'id, seq, anchor.tradeId',
    entryTypes: 'id, seq',
  })
  return db
}
