import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import type { StorageBinding } from '@/storage/storage-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { PriceBook } from '@/books/pricebook/price-book'
import type { PricingSource } from '@/books/pricebook/types'
import {
  MarketDataAdapter,
  MARKETDATA_SOURCE_ID,
} from '@/books/pricebook/adapters/marketdata-adapter'
import { Valuations } from '@/coordinators/valuations'
import { Review } from '@/coordinators/review'
import { Workspace, type Settings } from '@/workspace/workspace'

// Production wiring. Lives outside src/ui so the UI never imports storage
// directly (the module-boundary rule) — the composition root calls this. The
// TradeBook, Journal, and PriceBook share one binding so they operate on one
// database.

export function createBooks(): {
  tradeBook: TradeBook
  journal: Journal
  binding: DexieBinding
} {
  const binding = new DexieBinding(createDatabase())
  return {
    tradeBook: new TradeBook(binding),
    journal: new Journal(binding),
    binding,
  }
}

// One adapter per registered provider id, in Settings.pricingSources' order —
// that order IS the priority order PriceBook routes through (pricebook.md).
// Disabled entries register nothing; an empty/all-disabled list is the
// Slice 1 no-op path, unchanged.
export function buildPricingSources(configs: Settings['pricingSources']): PricingSource[] {
  const sources: PricingSource[] = []
  for (const config of configs) {
    if (!config.enabled) continue
    if (config.id === MARKETDATA_SOURCE_ID) sources.push(new MarketDataAdapter(config.apiKey ?? ''))
  }
  return sources
}

export function createPriceBook(
  binding: StorageBinding,
  pricingSources: Settings['pricingSources'],
): PriceBook {
  return new PriceBook(binding, buildPricingSources(pricingSources))
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
