import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { PriceBook } from '@/books/pricebook/price-book'
import type { PricingSource } from '@/books/pricebook/types'
import { InMemoryBinding } from '@/storage/in-memory-binding'

// Test-only wiring. Lives in tests/ (not src/ui) so UI component tests can obtain
// Books without importing storage — keeping the module-boundary rule intact.

export function inMemoryTradeBook(): TradeBook {
  return new TradeBook(new InMemoryBinding())
}

// A TradeBook, Journal, and PriceBook sharing one binding — the same wiring the
// composition root uses, so seeding and cross-Book reads see one database.
// `sources` lets a test give the PriceBook a fake PricingSource (e.g. to drive
// a Settings "Test this source" flow) without any real adapter's HTTP concerns.
// `binding` is returned too — a Workspace under test must be constructed with
// this SAME binding (`new Workspace(tradeBook, journal, binding)`), or it
// defaults to its own private InMemoryBinding and export/import silently
// operate on a database none of these Books can see.
export function inMemoryBooks(sources: PricingSource[] = []): {
  tradeBook: TradeBook
  journal: Journal
  priceBook: PriceBook
  binding: InMemoryBinding
} {
  const binding = new InMemoryBinding()
  return {
    tradeBook: new TradeBook(binding),
    journal: new Journal(binding),
    priceBook: new PriceBook(binding, sources),
    binding,
  }
}
