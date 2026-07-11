import { describe, it, expect } from 'vitest'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { Account, ExecutionDraft, Institution, PlanDraft } from '@/books/tradebook/types'
import { inMemoryTradeBook } from '../../tests/support/trade-book'
import { Valuations } from './valuations'

async function bookWithPlan(): Promise<{ book: TradeBook; tradeId: string }> {
  const book = inMemoryTradeBook()
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  const draft: PlanDraft = {
    accountId: account.id,
    thesis: 'AAPL breaks out',
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 }],
    exitLevels: [],
    plannedAt: '2026-07-10',
  }
  const tradeId = await book.confirmPlan(draft)
  return { book, tradeId }
}

function fill(): ExecutionDraft {
  return {
    side: 'buy',
    qty: 100,
    price: 15000,
    fees: 100,
    timestamp: new Date('2026-07-10T12:00:00').getTime(),
  }
}

describe('Valuations.position', () => {
  it('returns the Position for a Trade id', async () => {
    const { book, tradeId } = await bookWithPlan()
    await book.recordExecution({ tradeId, newLeg: 'AAPL' }, fill())
    const valuations = new Valuations(book)
    const position = await valuations.position(tradeId)
    expect(position.holdings).toEqual([
      { instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100, side: 'long' },
    ])
  })

  it('touches PriceBook not at all (no marks needed)', async () => {
    // Valuations.position is constructed with only a TradeBook — no PriceBook is
    // supplied or consulted; the Position derives purely from Executions.
    const { book, tradeId } = await bookWithPlan()
    const valuations = new Valuations(book)
    const position = await valuations.position(tradeId)
    expect(position.holdings).toEqual([])
  })
})
