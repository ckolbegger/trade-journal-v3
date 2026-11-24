import { describe, expect, it } from 'vitest'
import { openDb, repo, transaction } from '../../src/persistence/db'

describe('Schema v2 migration (D2-S2 structural)', () => {
  it('should preserve D1 data and expose trade records after migration', async () => {
    const db = await openDb()
    expect(db.version).toBe(2)
    expect([...db.objectStoreNames]).toContain('trade')
  })

  it('should keep D1 institution/account records readable', async () => {
    const db = await openDb()
    await repo.put(db, 'institutions', { id: 'i-migration', label: 'Schwab', active: true })
    const read = await repo.get(db, 'institutions', 'i-migration')
    expect(read?.label).toBe('Schwab')
  })

  it('should atomically commit a Trade record to the trade store', async () => {
    const db = await openDb()
    await transaction(db, ['trade'], 'readwrite', async tx => {
      await repo.putInTx(tx, 'trade', { id: 'trade-1', lifecycle: 'Planned' })
    })
    const read = await repo.get<{ lifecycle: string }>(db, 'trade', 'trade-1')
    expect(read?.lifecycle).toBe('Planned')
  })
})
