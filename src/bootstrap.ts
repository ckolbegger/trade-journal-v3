import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Workspace } from '@/workspace/workspace'

// Production wiring. Lives outside src/ui so the UI never imports storage
// directly (the module-boundary rule) — the composition root calls this.

export function createTradeBook(): TradeBook {
  return new TradeBook(new DexieBinding(createDatabase()))
}

export function createWorkspace(tradeBook: TradeBook): Workspace {
  return new Workspace(tradeBook)
}
