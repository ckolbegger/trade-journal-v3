import { describe, expect, it } from 'vitest'
import { openDb, transaction, repo, STORES } from '../../src/persistence/db'

describe('Persistence schema v1 (S3 structural)', () => {
  it('should open the schema with all five authoritative stores', async () => {
    const db = await openDb()
    expect([...db.objectStoreNames].sort()).toEqual([...STORES].sort())
  })

  it('should commit a multi-store transaction atomically', async () => {
    const db = await openDb()
    await transaction(db, ['institutions', 'accounts'], 'readwrite', async tx => {
      await repo.putInTx(tx, 'institutions', { id: 'i-tx', label: 'Broker', active: true })
      await repo.putInTx(tx, 'accounts', { id: 'a-tx', institutionId: 'i-tx', label: 'Main', active: true })
    })
    expect((await repo.get(db, 'institutions', 'i-tx'))?.label).toBe('Broker')
    expect((await repo.get(db, 'accounts', 'a-tx'))?.label).toBe('Main')
  })

  it('should roll back every store when a transaction aborts', async () => {
    const db = await openDb()
    await expect(transaction(db, ['institutions', 'accounts'], 'readwrite', async tx => {
      await repo.putInTx(tx, 'institutions', { id: 'i-rollback', label: 'Rollback', active: true })
      throw new Error('fail')
    })).rejects.toThrow('fail')
    expect(await repo.get(db, 'institutions', 'i-rollback')).toBeUndefined()
  })

  it('should provide a diagnostic transaction that leaves no authoritative fact', async () => {
    const db = await openDb()
    const before = (await repo.all(db, 'institutions')).length
    await transaction(db, ['workspace'], 'readwrite', async tx => {
      await repo.putInTx(tx, 'workspace', { id: '__diagnostic__', probe: true })
    })
    await transaction(db, ['workspace'], 'readwrite', async tx => {
      await requestDelete(tx, '__diagnostic__')
    })
    const after = (await repo.all(db, 'institutions')).length
    expect(after).toBe(before)
  })
})

function requestDelete(tx: IDBTransaction, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = tx.objectStore('workspace').delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
