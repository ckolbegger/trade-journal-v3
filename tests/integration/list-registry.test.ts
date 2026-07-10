import { describe, it, expect } from 'vitest'
import Dexie from 'dexie'
import { DexieBinding } from '@/storage/dexie-binding'
import { ListRegistry } from '@/books/list-registry'

interface Thing {
  id: string
  name: string
  archived?: boolean
}

describe('ListRegistry over Dexie (integration)', () => {
  it('list() returns items in insertion order despite randomly generated ids', async () => {
    const db = new Dexie('list-registry-' + crypto.randomUUID())
    db.version(1).stores({ things: 'id, seq' })
    const registry = new ListRegistry<Thing>(new DexieBinding(db), 'things')

    await registry.save({ name: 'Alpha' } as Thing)
    await registry.save({ name: 'Beta' } as Thing)
    await registry.save({ name: 'Gamma' } as Thing)

    expect((await registry.list()).map((t) => t.name)).toEqual(['Alpha', 'Beta', 'Gamma'])
  })
})
