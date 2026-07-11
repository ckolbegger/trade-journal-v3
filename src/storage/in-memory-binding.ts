import type { StorageBinding } from './storage-binding'

// The unit-test binding for every Book. Stores are created lazily; records are
// shallow-cloned in and out so callers never share references with the store.

function resolvePath(record: object, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined,
      record,
    )
}

export class InMemoryBinding implements StorageBinding {
  private stores = new Map<string, Map<string, { id: string }>>()

  private storeFor(store: string): Map<string, { id: string }> {
    let s = this.stores.get(store)
    if (!s) {
      s = new Map()
      this.stores.set(store, s)
    }
    return s
  }

  async get<T>(store: string, key: string): Promise<T | undefined> {
    const record = this.storeFor(store).get(key)
    return record ? ({ ...record } as T) : undefined
  }

  async put<T extends { id: string }>(store: string, record: T): Promise<void> {
    this.storeFor(store).set(record.id, { ...record })
  }

  async delete(store: string, key: string): Promise<void> {
    this.storeFor(store).delete(key)
  }

  async list<T>(store: string): Promise<T[]> {
    return [...this.storeFor(store).values()].map((r) => ({ ...r }) as T)
  }

  async where<T>(store: string, index: string, value: unknown): Promise<T[]> {
    // `index` may be a nested key path ('anchor.tradeId'), matching how Dexie
    // indexes nested properties — resolve it the same way here.
    return [...this.storeFor(store).values()]
      .filter((r) => resolvePath(r, index) === value)
      .map((r) => ({ ...r }) as T)
  }

  async transaction<R>(_stores: string[], fn: () => Promise<R>): Promise<R> {
    const snapshot = new Map(
      [...this.stores].map(([name, records]) => [name, new Map(records)] as const),
    )
    try {
      return await fn()
    } catch (error) {
      this.stores = snapshot
      throw error
    }
  }
}
