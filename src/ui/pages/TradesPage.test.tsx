import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TradesPage } from './TradesPage'
import { TradeBookContext } from '../tradeBookContext'
import { ValuationsContext } from '../valuationsContext'
import { Valuations } from '@/coordinators/valuations'
import { todayISO } from '../format'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { PriceBook } from '@/books/pricebook/price-book'
import type { Account, Institution, PlanDraft } from '@/books/tradebook/types'
import { inMemoryBooks } from '../../../tests/support/trade-book'

async function seededBook(): Promise<{ book: TradeBook; priceBook: PriceBook; accountId: string }> {
  const { tradeBook: book, priceBook } = inMemoryBooks()
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  return { book, priceBook, accountId: account.id }
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

function renderPage(book: TradeBook, priceBook?: PriceBook) {
  const valuations = new Valuations(book, priceBook)
  return render(
    <TradeBookContext.Provider value={book}>
      <ValuationsContext.Provider value={valuations}>
        <MemoryRouter>
          <TradesPage />
        </MemoryRouter>
      </ValuationsContext.Provider>
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
    const { book, priceBook, accountId } = await seededBook()
    const id = await book.confirmPlan(draft(accountId, 'AAPL'))
    await book.recordExecution(
      { tradeId: id, newLeg: 'AAPL' },
      { side: 'buy', qty: 100, price: 15000, fees: 100, timestamp: Date.now() },
    )

    renderPage(book, priceBook)

    const aapl = await screen.findByRole('listitem', { name: /AAPL/i })
    expect(aapl).toHaveTextContent(/open/i)
  })

  it('shows P&L for a marked open Trade (via Valuations.value)', async () => {
    const { book, priceBook, accountId } = await seededBook()
    const id = await book.confirmPlan(draft(accountId, 'AAPL'))
    await book.recordExecution(
      { tradeId: id, newLeg: 'AAPL' },
      { side: 'buy', qty: 100, price: 15000, fees: 100, timestamp: Date.now() },
    )
    await priceBook.record('AAPL', todayISO(), 16000, 'manual')

    renderPage(book, priceBook)

    const aapl = await screen.findByRole('listitem', { name: /AAPL/i })
    // worked example total P&L: 999.00
    expect(within(aapl).getByLabelText('pnl')).toHaveTextContent(/999\.00/)
  })

  it('shows a closed Trade with a closed badge', async () => {
    const { book, accountId } = await seededBook()
    await book.registries.closeReasons.save({
      id: 'close-reason-never-filled',
      name: 'Never Filled',
    })
    const id = await book.confirmPlan(draft(accountId, 'AAPL'))
    await book.setCloseReason(id, { id: 'close-reason-never-filled', name: 'Never Filled' })

    renderPage(book)

    const aapl = await screen.findByRole('listitem', { name: /AAPL/i })
    expect(aapl).toHaveTextContent(/closed/i)
  })
})
