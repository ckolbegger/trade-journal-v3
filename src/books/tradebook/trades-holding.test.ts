import { describe, it, expect } from 'vitest'
import { inMemoryTradeBook } from '../../../tests/support/trade-book'
import { TradeBook } from './trade-book'
import type { Account, ExecutionDraft, Institution, PlanDraft } from './types'

async function planFor(book: TradeBook, ticker: string): Promise<string> {
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  const draft: PlanDraft = {
    accountId: account.id,
    thesis: `${ticker} breaks out`,
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker }, qty: 100 }],
    exitLevels: [],
    plannedAt: '2026-07-10',
  }
  return book.confirmPlan(draft)
}

const buy100 = (): ExecutionDraft => ({
  side: 'buy',
  qty: 100,
  price: 15000,
  fees: 100,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
})
const sell100 = (): ExecutionDraft => ({
  side: 'sell',
  qty: 100,
  price: 16800,
  fees: 100,
  timestamp: new Date('2026-07-20T12:00:00').getTime(),
})

describe('TradeBook.tradesHolding', () => {
  it('lists every Trade with an open position in the instrument', async () => {
    const book = inMemoryTradeBook()
    const a = await planFor(book, 'AAPL')
    const b = await planFor(book, 'AAPL')
    await book.recordExecution({ tradeId: a, newLeg: 'AAPL' }, buy100())
    await book.recordExecution({ tradeId: b, newLeg: 'AAPL' }, buy100())

    const holding = await book.tradesHolding('AAPL')
    expect(holding.map((t) => t.id).sort()).toEqual([a, b].sort())
  })

  it('excludes a planned Trade (no open position yet)', async () => {
    const book = inMemoryTradeBook()
    const open = await planFor(book, 'AAPL')
    await planFor(book, 'AAPL') // planned, never filled
    await book.recordExecution({ tradeId: open, newLeg: 'AAPL' }, buy100())

    const holding = await book.tradesHolding('AAPL')
    expect(holding.map((t) => t.id)).toEqual([open])
  })

  it('excludes a Trade that has sold back to flat', async () => {
    const book = inMemoryTradeBook()
    const tradeId = await planFor(book, 'AAPL')
    await book.recordExecution({ tradeId, newLeg: 'AAPL' }, buy100())
    const record = await book.get(tradeId)
    await book.recordExecution({ tradeId, legId: record.legs[0].id }, sell100())

    const holding = await book.tradesHolding('AAPL')
    expect(holding).toEqual([])
  })

  it('excludes Trades holding a different instrument', async () => {
    const book = inMemoryTradeBook()
    const aapl = await planFor(book, 'AAPL')
    const msft = await planFor(book, 'MSFT')
    await book.recordExecution({ tradeId: aapl, newLeg: 'AAPL' }, buy100())
    await book.recordExecution({ tradeId: msft, newLeg: 'MSFT' }, buy100())

    const holding = await book.tradesHolding('AAPL')
    expect(holding.map((t) => t.id)).toEqual([aapl])
  })
})
