import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { InMemoryBinding } from '@/storage/in-memory-binding'

// Test-only wiring. Lives in tests/ (not src/ui) so UI component tests can obtain
// Books without importing storage — keeping the module-boundary rule intact.

export function inMemoryTradeBook(): TradeBook {
  return new TradeBook(new InMemoryBinding())
}

// A TradeBook and Journal sharing one binding — the same wiring the composition
// root uses, so seeding and cross-Book reads see one database.
export function inMemoryBooks(): { tradeBook: TradeBook; journal: Journal } {
  const binding = new InMemoryBinding()
  return { tradeBook: new TradeBook(binding), journal: new Journal(binding) }
}
