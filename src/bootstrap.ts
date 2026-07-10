import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'

// Production wiring. Lives outside src/ui so the UI never imports storage
// directly (the module-boundary rule) — the composition root calls this.

export function createTradeBook(): TradeBook {
  return new TradeBook(new DexieBinding(createDatabase()))
}
