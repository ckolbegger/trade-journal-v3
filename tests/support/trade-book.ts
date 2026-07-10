import { TradeBook } from '@/books/tradebook/trade-book'
import { InMemoryBinding } from '@/storage/in-memory-binding'

// Test-only wiring. Lives in tests/ (not src/ui) so UI component tests can obtain
// a TradeBook without importing storage — keeping the module-boundary rule intact.

export function inMemoryTradeBook(): TradeBook {
  return new TradeBook(new InMemoryBinding())
}
