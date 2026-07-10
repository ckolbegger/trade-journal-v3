import Dexie, { type IndexableType, type Table } from 'dexie'
import type { StorageBinding } from './storage-binding'

// The same StorageBinding behavior over a Dexie database. Operations join the
// current Dexie transaction zone automatically, so `transaction` aborts (rolls
// back) every write when the callback throws.
//
// A binding-managed `seq` gives `list()` insertion order (Dexie's default
// toArray() is primary-key order). `seq` is stripped from every result so
// records are identical to the in-memory binding's.

export class DexieBinding implements StorageBinding {
  constructor(private db: Dexie) {}

  async get<T>(store: string, key: string): Promise<T | undefined> {
    const record = await this.db.table(store).get(key)
    return record ? (stripSeq(record) as T) : undefined
  }

  async put<T extends { id: string }>(store: string, record: T): Promise<void> {
    const table = this.db.table(store)
    const existing = (await table.get(record.id)) as { seq?: number } | undefined
    const seq = existing?.seq ?? (await nextSeq(table))
    await table.put({ ...record, seq })
  }

  async delete(store: string, key: string): Promise<void> {
    await this.db.table(store).delete(key)
  }

  async list<T>(store: string): Promise<T[]> {
    const records = await this.db.table(store).orderBy('seq').toArray()
    return records.map((record) => stripSeq(record) as T)
  }

  async where<T>(store: string, index: string, value: unknown): Promise<T[]> {
    const records = await this.db
      .table(store)
      .where(index)
      .equals(value as IndexableType)
      .toArray()
    return records.map((record) => stripSeq(record) as T)
  }

  async transaction<R>(stores: string[], fn: () => Promise<R>): Promise<R> {
    return this.db.transaction('rw', stores, () => fn())
  }
}

async function nextSeq(table: Table): Promise<number> {
  const last = (await table.orderBy('seq').last()) as { seq?: number } | undefined
  return last?.seq !== undefined ? last.seq + 1 : 0
}

function stripSeq(record: object): object {
  const copy = { ...record } as Record<string, unknown>
  delete copy.seq
  return copy
}
