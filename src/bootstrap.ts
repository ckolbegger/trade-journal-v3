import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { PriceBook } from '@/books/pricebook/price-book'
import { Valuations } from '@/coordinators/valuations'
import { Review } from '@/coordinators/review'
import { Workspace } from '@/workspace/workspace'

// Production wiring. Lives outside src/ui so the UI never imports storage
// directly (the module-boundary rule) — the composition root calls this. The
// TradeBook, Journal, and PriceBook share one binding so they operate on one
// database.

export function createBooks(): {
  tradeBook: TradeBook
  journal: Journal
  priceBook: PriceBook
  binding: DexieBinding
} {
  const binding = new DexieBinding(createDatabase())
  return {
    tradeBook: new TradeBook(binding),
    journal: new Journal(binding),
    priceBook: new PriceBook(binding),
    binding,
  }
}

export function createValuations(tradeBook: TradeBook, priceBook: PriceBook): Valuations {
  return new Valuations(tradeBook, priceBook)
}

export function createReview(
  valuations: Valuations,
  journal: Journal,
  tradeBook: TradeBook,
): Review {
  return new Review(valuations, journal, tradeBook)
}

export function createWorkspace(
  tradeBook: TradeBook,
  journal: Journal,
  binding: DexieBinding,
): Workspace {
  return new Workspace(tradeBook, journal, binding)
}
