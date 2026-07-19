import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

// Detail UI (S7.3.T3): the PMCC's Position block renders both Legs signed
// with their OWN (mixed) expirations — "1 × AAPL Jan'28 150C" and
// "-1 × AAPL Sep'26 220C" — and the dashboard shows the worked-example
// numbers once both contracts are marked.

const FAR = 'AAPL 2028-01-21 C 150'
const NEAR = 'AAPL 2026-09-18 C 220'

async function pmccOpen(): Promise<{
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
    thesis: 'PMCC on AAPL',
    strategyId: 'strategy-pmcc',
    ideaSourceId: '',
    plannedLegs: [
      {
        side: 'buy',
        instrument: {
          kind: 'option',
          ticker: 'AAPL',
          type: 'call',
          strike: 15000,
          expiration: '2028-01-21',
        },
        qty: 1,
      },
      { side: 'sell', instrument: { kind: 'option', ticker: 'AAPL', type: 'call' }, qty: 1 },
    ],
    exitLevels: [
      { scope: { level: 'trade' }, side: 'stop', kind: 'structureValue', value: 550000 },
      { scope: { level: 'trade' }, side: 'target', kind: 'structureValue', value: 680000 },
    ],
    plannedAt: '2026-07-10',
  }
  const id = await book.confirmPlan(draft)
  await book.recordExecution(
    { tradeId: id, newLeg: FAR },
    { side: 'buy', qty: 1, price: 6200, fees: 65, timestamp: Date.now() },
  )
  await book.recordExecution(
    { tradeId: id, newLeg: NEAR },
    { side: 'sell', qty: 1, price: 300, fees: 65, timestamp: Date.now() },
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

describe('TradeDetail (PMCC)', () => {
  it('lists both Legs signed with their mixed expirations in the Position block', async () => {
    const { book, journal, priceBook, id } = await pmccOpen()
    renderDetail(book, journal, priceBook, id)

    const position = await screen.findByLabelText('position')
    expect(position).toHaveTextContent("1 × AAPL Jan'28 150C")
    expect(position).toHaveTextContent("-1 × AAPL Sep'26 220C")
  })

  it('shows the worked-example numbers once both contracts are marked', async () => {
    const { book, journal, priceBook, id } = await pmccOpen()
    await priceBook.record(FAR, '2026-07-15', 6500, 'manual')
    await priceBook.record(NEAR, '2026-07-15', 200, 'manual')
    renderDetail(book, journal, priceBook, id)

    const pnl = await screen.findByLabelText('profit and loss', { exact: true })
    expect(pnl).toHaveTextContent('6300.00')
    expect(pnl).toHaveTextContent('400.00')
    expect(pnl).toHaveTextContent('1.30')
    expect(pnl).toHaveTextContent('398.70')

    const rr = screen.getByLabelText('ongoing risk and reward')
    expect(within(rr).getByLabelText('worst-case risk')).toHaveTextContent('6300.00')
    expect(within(rr).getByLabelText('max reward')).toHaveTextContent('700.00')
    expect(within(rr).getByLabelText('planned risk')).toHaveTextContent('800.00')
    expect(within(rr).getByLabelText('planned reward')).toHaveTextContent('500.00')
  })
})
