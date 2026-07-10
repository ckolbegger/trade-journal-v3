import type { StorageBinding } from '@/storage/storage-binding'

// One generic shape, reused by every trader-managed list. Items are never
// deleted — Trades reference them forever — so `archive` marks a flag instead.

export interface RegistryItem {
  id: string
  archived?: boolean
}

export class ListRegistry<T extends RegistryItem> {
  constructor(
    private binding: StorageBinding,
    private store: string,
    private validate?: (item: T) => void | Promise<void>,
  ) {}

  async list(includeArchived = false): Promise<T[]> {
    const all = await this.binding.list<T>(this.store)
    return includeArchived ? all : all.filter((item) => !item.archived)
  }

  async save(item: T): Promise<void> {
    if (!item.id) item.id = crypto.randomUUID()
    if (this.validate) await this.validate(item)
    await this.binding.put(this.store, item)
  }

  async archive(id: string): Promise<void> {
    const existing = await this.binding.get<T>(this.store, id)
    if (!existing) throw new Error(`Cannot archive unknown item ${id}`)
    existing.archived = true
    await this.binding.put(this.store, existing)
  }
}
