import { describe, it, expect } from 'vitest'
import Dexie from 'dexie'
import { DexieBinding } from '@/storage/dexie-binding'
import { createDatabase } from '@/storage/schema'
import { storageBindingContract } from '../contracts/storage-binding.contract'

function makeContractDb(): Dexie {
  const db = new Dexie('contract-' + crypto.randomUUID())
  db.version(1).stores({ widgets: 'id, kind, meta.group, seq', gadgets: 'id, seq' })
  return db
}

describe('DexieBinding (integration, fake-indexeddb)', () => {
  storageBindingContract(() => new DexieBinding(makeContractDb()))

  it('persists records across a database close and reopen', async () => {
    const name = 'persist-' + crypto.randomUUID()
    const first = createDatabase(name)
    await new DexieBinding(first).put('institutions', { id: 'i1', name: 'Schwab' })
    first.close()

    const second = createDatabase(name)
    expect(await new DexieBinding(second).get('institutions', 'i1')).toEqual({
      id: 'i1',
      name: 'Schwab',
    })
  })

  it('upgrades an empty v0 database to the current schema', async () => {
    const name = 'upgrade-' + crypto.randomUUID()
    const db = createDatabase(name)
    await db.open()
    expect(db.verno).toBe(3)
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'accounts',
      'entries',
      'entryTypes',
      'ideaSources',
      'institutions',
      'strategies',
      'trades',
    ])
    expect(await new DexieBinding(db).list('accounts')).toEqual([])
  })
})
