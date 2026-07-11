import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TradesPage } from './TradesPage'
import { TradeBookContext } from '../tradeBookContext'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { Account, Institution, PlanDraft } from '@/books/tradebook/types'
import { inMemoryTradeBook } from '../../../tests/support/trade-book'

async function seededBook(): Promise<{ book: TradeBook; accountId: string }> {
  const book = inMemoryTradeBook()
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  return { book, accountId: account.id }
}

function draft(accountId: string, ticker: string): PlanDraft {
  return {
    accountId,
    thesis: `${ticker} thesis`,
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker }, qty: 100 }],
    exitLevels: [],
    plannedAt: '2026-07-10',
  }
}

function renderPage(book: TradeBook) {
  return render(
    <TradeBookContext.Provider value={book}>
      <MemoryRouter>
        <TradesPage />
      </MemoryRouter>
    </TradeBookContext.Provider>,
  )
}

describe('TradeList', () => {
  it("shows the new Trade with a 'planned' badge, newest last (insertion order)", async () => {
    const { book, accountId } = await seededBook()
    await book.confirmPlan(draft(accountId, 'AAPL'))
    await book.confirmPlan(draft(accountId, 'MSFT'))

    renderPage(book)

    const aapl = await screen.findByRole('listitem', { name: /AAPL/i })
    expect(aapl).toHaveTextContent(/planned/i)

    const tickers = screen.getAllByRole('listitem').map((li) => li.getAttribute('aria-label'))
    expect(tickers).toEqual(['AAPL', 'MSFT'])
  })

  it('flips a filled Trade to an open badge', async () => {
    const { book, accountId } = await seededBook()
    const id = await book.confirmPlan(draft(accountId, 'AAPL'))
    await book.recordExecution(
      { tradeId: id, newLeg: 'AAPL' },
      { side: 'buy', qty: 100, price: 15000, fees: 100, timestamp: Date.now() },
    )

    renderPage(book)

    const aapl = await screen.findByRole('listitem', { name: /AAPL/i })
    expect(aapl).toHaveTextContent(/open/i)
  })
})
