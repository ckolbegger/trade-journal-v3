import { describe, it, expect } from 'vitest'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { PriceBook } from '@/books/pricebook/price-book'
import type { Account, Institution, PlanDraft } from '@/books/tradebook/types'
import { inMemoryBooks } from '../../tests/support/trade-book'
import { Valuations } from './valuations'

// The review walk's Marks-needed collection (S7.1.T3): a covered call needs
// Marks for the stock AND the call — but the stock is asked for exactly
// once, since it IS the option's underlying (dedup, mirrors instrumentsOf).

const CONTRACT = 'XYZ 2026-09-18 C 55'

async function coveredCallOpen(): Promise<{
  tradeBook: TradeBook
  priceBook: PriceBook
  tradeId: string
}> {
  const { tradeBook, priceBook } = inMemoryBooks()
  const institution = { id: '', name: 'Schwab' } as Institution
  await tradeBook.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await tradeBook.registries.accounts.save(account)

  const draft: PlanDraft = {
    accountId: account.id,
    thesis: 'Sell premium against XYZ stock',
    strategyId: 'strategy-covered-call',
    ideaSourceId: '',
    plannedLegs: [
      { side: 'buy', instrument: { kind: 'stock', ticker: 'XYZ' }, qty: 100 },
      { side: 'sell', instrument: { kind: 'option', ticker: 'XYZ', type: 'call' }, qty: 1 },
    ],
    exitLevels: [],
    plannedAt: '2026-07-10',
  }
  const tradeId = await tradeBook.confirmPlan(draft)
  await tradeBook.recordExecution(
    { tradeId, newLeg: 'XYZ' },
    {
      side: 'buy',
      qty: 100,
      price: 5000,
      fees: 100,
      timestamp: new Date('2026-07-10T12:00:00').getTime(),
    },
  )
  await tradeBook.recordExecution(
    { tradeId, newLeg: CONTRACT },
    {
      side: 'sell',
      qty: 1,
      price: 150,
      fees: 65,
      timestamp: new Date('2026-07-11T12:00:00').getTime(),
    },
  )
  return { tradeBook, priceBook, tradeId }
}

describe('Valuations.marksNeeded (covered call — stock-as-underlying dedup)', () => {
  it('asks for the stock and the contract, the stock exactly once', async () => {
    const { tradeBook, priceBook, tradeId } = await coveredCallOpen()
    const needed = await new Valuations(tradeBook, priceBook).marksNeeded('2026-07-15')

    const trade = needed.perTrade.find((t) => t.tradeId === tradeId)!
    const instruments = trade.needs.map((n) => n.instrument)
    expect(instruments).toHaveLength(2)
    expect(instruments.filter((i) => i === 'XYZ')).toHaveLength(1)
    expect(instruments).toContain(CONTRACT)
  })
})
