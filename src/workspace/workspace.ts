import type { TradeBook } from '@/books/tradebook/trade-book'
import type { StrategyTemplate } from '@/books/tradebook/types'
import type { Journal } from '@/books/journal/journal'
import type { EntryType } from '@/books/journal/types'

// Workspace owns app-lifecycle concerns rather than trading. This slice
// implements the ensureSeeded subset needed so far: the default Strategy and the
// Plan Entry Type. Seeding is additive and apply-iff-absent by id (Workspace
// design): because registries archive and never delete, existence alone is the
// ledger — edited defaults are never overwritten, archived ones never
// resurrected. Seeding goes through the Book interfaces, never raw stores.

export const LONG_STOCK_STRATEGY_ID = 'strategy-long-stock'
export const PLAN_ENTRY_TYPE_ID = 'entry-type-plan'

const LONG_STOCK_STRATEGY: StrategyTemplate = {
  id: LONG_STOCK_STRATEGY_ID,
  name: 'Long Stock',
  legs: [{ side: 'buy', instrumentKind: 'stock' }],
  exitLevels: [
    { side: 'stop', kind: 'underlyingPrice' },
    { side: 'target', kind: 'underlyingPrice' },
  ],
}

const PLAN_ENTRY_TYPE: EntryType = {
  id: PLAN_ENTRY_TYPE_ID,
  name: 'Plan',
  designatedFor: 'plan',
  prompts: [
    { id: 'why', text: 'Why this trade, why now?', kind: 'text' },
    { id: 'invalidates', text: 'What invalidates the thesis?', kind: 'text' },
    { id: 'conviction', text: 'Conviction', kind: 'scale', scale: { min: 1, max: 5 } },
    {
      id: 'emotion',
      text: 'Emotional state',
      kind: 'select',
      options: ['calm', 'eager', 'anxious', 'FOMO', 'revenge'],
    },
  ],
}

export class Workspace {
  constructor(
    private tradeBook: TradeBook,
    private journal: Journal,
  ) {}

  async ensureSeeded(): Promise<void> {
    const strategies = await this.tradeBook.registries.strategies.list(true)
    if (!strategies.some((s) => s.id === LONG_STOCK_STRATEGY.id)) {
      await this.tradeBook.registries.strategies.save({ ...LONG_STOCK_STRATEGY })
    }

    const entryTypes = await this.journal.entryTypes.list(true)
    if (!entryTypes.some((t) => t.id === PLAN_ENTRY_TYPE.id)) {
      await this.journal.entryTypes.save(structuredClone(PLAN_ENTRY_TYPE))
    }
  }
}
