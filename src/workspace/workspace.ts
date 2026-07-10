import type { TradeBook } from '@/books/tradebook/trade-book'
import type { StrategyTemplate } from '@/books/tradebook/types'

// Workspace owns app-lifecycle concerns rather than trading. This slice
// implements the first subset of ensureSeeded: seeding the default Strategy.
// Seeding is additive and apply-iff-absent by id (Workspace design): because
// registries archive and never delete, existence alone is the ledger — edited
// defaults are never overwritten, archived ones never resurrected. Seeding goes
// through the Book interfaces, never raw stores.

export const LONG_STOCK_STRATEGY_ID = 'strategy-long-stock'

const LONG_STOCK_STRATEGY: StrategyTemplate = {
  id: LONG_STOCK_STRATEGY_ID,
  name: 'Long Stock',
  legs: [{ side: 'buy', instrumentKind: 'stock' }],
  exitLevels: [
    { side: 'stop', kind: 'underlyingPrice' },
    { side: 'target', kind: 'underlyingPrice' },
  ],
}

export class Workspace {
  constructor(private tradeBook: TradeBook) {}

  async ensureSeeded(): Promise<void> {
    const strategies = await this.tradeBook.registries.strategies.list(true)
    if (!strategies.some((s) => s.id === LONG_STOCK_STRATEGY.id)) {
      await this.tradeBook.registries.strategies.save({ ...LONG_STOCK_STRATEGY })
    }
  }
}
