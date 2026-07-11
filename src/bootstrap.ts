import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { Workspace } from '@/workspace/workspace'

// Production wiring. Lives outside src/ui so the UI never imports storage
// directly (the module-boundary rule) — the composition root calls this. The
// TradeBook and Journal share one binding so they operate on one database.

export function createBooks(): { tradeBook: TradeBook; journal: Journal } {
  const binding = new DexieBinding(createDatabase())
  return { tradeBook: new TradeBook(binding), journal: new Journal(binding) }
}

export function createWorkspace(tradeBook: TradeBook, journal: Journal): Workspace {
  return new Workspace(tradeBook, journal)
}
