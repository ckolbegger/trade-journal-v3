import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { TradeDetail } from './TradeDetail'
import { TradeBookContext } from '../tradeBookContext'
import { JournalContext } from '../journalContext'
import { PriceBookContext } from '../priceBookContext'
import { ValuationsContext } from '../valuationsContext'
import { Valuations } from '@/coordinators/valuations'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { Journal } from '@/books/journal/journal'
import type { PriceBook } from '@/books/pricebook/price-book'
import type { Account, Institution, PlanDraft } from '@/books/tradebook/types'
import { Workspace } from '@/workspace/workspace'
import { inMemoryBooks } from '../../../tests/support/trade-book'

// Detail & walk UI (S7.1.T3): the covered call's Position block lists both
// Legs signed, per-Leg P&L rows appear once valued, and the dashboard asks
// for BOTH Marks (stock and contract) — stock IS the underlying, so it is
// asked for once, not twice.

const CONTRACT = 'XYZ 2026-09-18 C 55'

async function coveredCallOpen(): Promise<{
  book: TradeBook
  journal: Journal
  priceBook: PriceBook
  id: string
}> {
  const { tradeBook: book, journal, priceBook } = inMemoryBooks()
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  await new Workspace(book, journal).ensureSeeded()

  const draft: PlanDraft = {
    accountId: account.id,
    thesis: 'Sell premium against XYZ stock',
    strategyId: 'strategy-covered-call',
    ideaSourceId: '',
    plannedLegs: [
      { side: 'buy', instrument: { kind: 'stock', ticker: 'XYZ' }, qty: 100 },
      { side: 'sell', instrument: { kind: 'option', ticker: 'XYZ', type: 'call' }, qty: 1 },
    ],
    exitLevels: [
      { scope: { level: 'trade' }, side: 'stop', kind: 'underlyingPrice', price: 4600 },
      { scope: { level: 'trade' }, side: 'target', kind: 'underlyingPrice', price: 5500 },
    ],
    plannedAt: '2026-07-10',
  }
  const id = await book.confirmPlan(draft)
  await book.recordExecution(
    { tradeId: id, newLeg: 'XYZ' },
    { side: 'buy', qty: 100, price: 5000, fees: 100, timestamp: Date.now() },
  )
  await book.recordExecution(
    { tradeId: id, newLeg: CONTRACT },
    { side: 'sell', qty: 1, price: 150, fees: 65, timestamp: Date.now() },
  )
  return { book, journal, priceBook, id }
}

function renderDetail(book: TradeBook, journal: Journal, priceBook: PriceBook, id: string) {
  return render(
    <TradeBookContext.Provider value={book}>
      <JournalContext.Provider value={journal}>
        <PriceBookContext.Provider value={priceBook}>
          <ValuationsContext.Provider value={new Valuations(book, priceBook)}>
            <MemoryRouter initialEntries={[`/trades/${id}`]}>
              <Routes>
                <Route path="/trades/:id" element={<TradeDetail />} />
              </Routes>
            </MemoryRouter>
          </ValuationsContext.Provider>
        </PriceBookContext.Provider>
      </JournalContext.Provider>
    </TradeBookContext.Provider>,
  )
}

describe('TradeDetail (covered call)', () => {
  it('lists both Legs signed in the Position block', async () => {
    const { book, journal, priceBook, id } = await coveredCallOpen()
    renderDetail(book, journal, priceBook, id)

    const position = await screen.findByLabelText('position')
    expect(position).toHaveTextContent('100 XYZ long')
    expect(position).toHaveTextContent("-1 × XYZ Sep'26 55C")
  })

  it('prompts for both the stock and contract Marks — stock asked once, as itself', async () => {
    const { book, journal, priceBook, id } = await coveredCallOpen()
    renderDetail(book, journal, priceBook, id)

    await screen.findByText(/enter today's price/i)
    const marksNeeded = screen.getAllByLabelText(/today's mark/i)
    expect(marksNeeded).toHaveLength(2)
    expect(screen.getAllByText('XYZ').length).toBeGreaterThan(0)
    expect(screen.getByText(CONTRACT)).toBeInTheDocument()
  })

  it('shows a per-Leg P&L row for both the stock and the call once valued', async () => {
    const { book, journal, priceBook, id } = await coveredCallOpen()
    await priceBook.record('XYZ', '2026-07-15', 5200, 'manual')
    await priceBook.record(CONTRACT, '2026-07-15', 100, 'manual')
    renderDetail(book, journal, priceBook, id)

    const perLeg = await screen.findByLabelText('per-leg profit and loss')
    expect(perLeg).toHaveTextContent(/xyz/i)
    expect(perLeg).toHaveTextContent(/200\.00/)
    expect(perLeg).toHaveTextContent(/50\.00/)
  })
})
