import { describe, it, expect } from 'vitest'
import { InMemoryBinding } from '@/storage/in-memory-binding'
import { ListRegistry } from './list-registry'

interface Thing {
  id: string
  name: string
  archived?: boolean
}

function makeRegistry(): ListRegistry<Thing> {
  return new ListRegistry<Thing>(new InMemoryBinding(), 'things')
}

describe('ListRegistry', () => {
  it('save() creates an item with a generated id when absent', async () => {
    const registry = makeRegistry()
    await registry.save({ name: 'Alpha' } as Thing)
    const items = await registry.list()
    expect(items).toHaveLength(1)
    expect(typeof items[0].id).toBe('string')
    expect(items[0].id.length).toBeGreaterThan(0)
    expect(items[0].name).toBe('Alpha')
  })

  it('save() updates in place when the id exists', async () => {
    const registry = makeRegistry()
    const item = { name: 'Alpha' } as Thing
    await registry.save(item)
    await registry.save({ id: item.id, name: 'Beta' })
    const items = await registry.list()
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('Beta')
  })

  it('list() returns items in insertion order', async () => {
    const registry = makeRegistry()
    await registry.save({ name: 'Alpha' } as Thing)
    await registry.save({ name: 'Beta' } as Thing)
    await registry.save({ name: 'Gamma' } as Thing)
    expect((await registry.list()).map((t) => t.name)).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  it('list() excludes archived items by default', async () => {
    const registry = makeRegistry()
    await registry.save({ name: 'Alpha' } as Thing)
    const beta = { name: 'Beta' } as Thing
    await registry.save(beta)
    await registry.archive(beta.id)
    expect((await registry.list()).map((t) => t.name)).toEqual(['Alpha'])
  })

  it('list(true) includes archived items', async () => {
    const registry = makeRegistry()
    await registry.save({ name: 'Alpha' } as Thing)
    const beta = { name: 'Beta' } as Thing
    await registry.save(beta)
    await registry.archive(beta.id)
    expect((await registry.list(true)).map((t) => t.name)).toEqual(['Alpha', 'Beta'])
  })

  it('archive() marks an item archived without removing the record', async () => {
    const registry = makeRegistry()
    const alpha = { name: 'Alpha' } as Thing
    await registry.save(alpha)
    await registry.archive(alpha.id)
    const archived = (await registry.list(true)).find((t) => t.id === alpha.id)
    expect(archived).toBeDefined()
    expect(archived?.archived).toBe(true)
  })

  it('archive() of an unknown id rejects', async () => {
    const registry = makeRegistry()
    await expect(registry.archive('nope')).rejects.toThrow()
  })
})
