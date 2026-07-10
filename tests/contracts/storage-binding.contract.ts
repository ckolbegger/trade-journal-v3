import { it, expect, beforeEach } from 'vitest'
import type { StorageBinding } from '@/storage/storage-binding'

// The behavioral contract every StorageBinding implementation must satisfy.
// Written once, run per binding: InMemoryBinding (unit) and DexieBinding
// (integration, fake-indexeddb). Later Books rely on this factory pattern.
//
// The binding factory must supply stores `widgets` (with a `kind` index) and
// `gadgets`.

export function storageBindingContract(
  makeBinding: () => StorageBinding | Promise<StorageBinding>,
) {
  let binding: StorageBinding

  beforeEach(async () => {
    binding = await makeBinding()
  })

  it('returns undefined for a missing key', async () => {
    expect(await binding.get('widgets', 'missing')).toBeUndefined()
  })

  it('round-trips a put record by key', async () => {
    await binding.put('widgets', { id: 'w1', name: 'Gizmo' })
    expect(await binding.get('widgets', 'w1')).toEqual({ id: 'w1', name: 'Gizmo' })
  })

  it('lists all records in a store', async () => {
    await binding.put('widgets', { id: 'w1' })
    await binding.put('widgets', { id: 'w2' })
    expect(await binding.list('widgets')).toHaveLength(2)
  })

  it('lists records in insertion order, not key order', async () => {
    // Ids chosen so key (alphabetical) order differs from insertion order.
    await binding.put('widgets', { id: 'zeta' })
    await binding.put('widgets', { id: 'alpha' })
    await binding.put('widgets', { id: 'mid' })
    const ids = (await binding.list<{ id: string }>('widgets')).map((w) => w.id)
    expect(ids).toEqual(['zeta', 'alpha', 'mid'])
  })

  it('lists records matching an indexed value', async () => {
    await binding.put('widgets', { id: 'w1', kind: 'a' })
    await binding.put('widgets', { id: 'w2', kind: 'b' })
    await binding.put('widgets', { id: 'w3', kind: 'a' })
    const matches = await binding.where<{ id: string }>('widgets', 'kind', 'a')
    expect(matches.map((w) => w.id).sort()).toEqual(['w1', 'w3'])
  })

  it('deletes by key', async () => {
    await binding.put('widgets', { id: 'w1' })
    await binding.delete('widgets', 'w1')
    expect(await binding.get('widgets', 'w1')).toBeUndefined()
  })

  it('rolls back every write in a transaction when the callback throws', async () => {
    await binding.put('widgets', { id: 'w1', name: 'orig' })
    await expect(
      binding.transaction(['widgets'], async () => {
        await binding.put('widgets', { id: 'w1', name: 'changed' })
        await binding.put('widgets', { id: 'w2', name: 'new' })
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(await binding.get('widgets', 'w1')).toEqual({ id: 'w1', name: 'orig' })
    expect(await binding.get('widgets', 'w2')).toBeUndefined()
  })

  it('isolates stores (a put in one store is invisible to another)', async () => {
    await binding.put('widgets', { id: 'x' })
    expect(await binding.get('gadgets', 'x')).toBeUndefined()
    expect(await binding.list('gadgets')).toEqual([])
  })
}
