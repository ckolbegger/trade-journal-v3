import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { TradeDetail } from './TradeDetail'
import { TradeBookContext } from '../tradeBookContext'
import { JournalContext } from '../journalContext'
import { PriceBookContext } from '../priceBookContext'
import { ValuationsContext } from '../valuationsContext'
import { Valuations } from '@/coordinators/valuations'
import { Workspace } from '@/workspace/workspace'
import { todayISO } from '../format'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { Journal } from '@/books/journal/journal'
import type { PriceBook } from '@/books/pricebook/price-book'
import type { Account, ExecutionDraft, Institution, PlanDraft } from '@/books/tradebook/types'
import { inMemoryBooks } from '../../../tests/support/trade-book'

// S5.1 scaling in: the worked example (docs/plan/slice-05-scaling.md) — buy
// 100 AAPL @ 150.00 fees 1.00, then buy 100 @ 160.00 fees 1.00 on the same Leg
// -> position 200, average cost 155.00.

const buyLotA: ExecutionDraft = {
  side: 'buy',
  qty: 100,
  price: 15000,
  fees: 100,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
}
const buyLotB: ExecutionDraft = {
  side: 'buy',
  qty: 100,
  price: 16000,
  fees: 100,
  timestamp: new Date('2026-07-12T12:00:00').getTime(),
}

async function seededTrade(): Promise<{
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
    thesis: 'AAPL breaks out',
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 }],
    exitLevels: [],
    plannedAt: '2026-07-10',
  }
  const id = await book.confirmPlan(draft)
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

describe('TradeDetail (scaling in)', () => {
  it('shows total quantity and average cost across fills', async () => {
    const { book, journal, priceBook, id } = await seededTrade()
    await book.recordExecution({ tradeId: id, newLeg: 'AAPL' }, buyLotA)
    const record = await book.get(id)
    await book.recordExecution({ tradeId: id, legId: record.legs[0].id }, buyLotB)
    await priceBook.record('AAPL', todayISO(), 16500, 'manual')

    renderDetail(book, journal, priceBook, id)

    const position = await screen.findByLabelText('position')
    expect(position).toHaveTextContent('200')
    // Average cost rides TradeDashboard's own valuation snapshot (S5.1) — it
    // lands once that fetch resolves, not on the position line's first paint.
    await waitFor(() => expect(position).toHaveTextContent(/155\.00/))
  })

  it('lists each fill separately in history', async () => {
    const { book, journal, priceBook, id } = await seededTrade()
    await book.recordExecution({ tradeId: id, newLeg: 'AAPL' }, buyLotA)
    const record = await book.get(id)
    await book.recordExecution({ tradeId: id, legId: record.legs[0].id }, buyLotB)

    renderDetail(book, journal, priceBook, id)

    const history = await screen.findByLabelText('execution history')
    const rows = within(history).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('150.00')
    expect(rows[1]).toHaveTextContent('160.00')
  })

  it('offers no record-fill on a closed Trade', async () => {
    const { book, journal, priceBook, id } = await seededTrade()
    const opened = await book.recordExecution({ tradeId: id, newLeg: 'AAPL' }, buyLotA)
    await book.recordExecution(
      { tradeId: id, legId: opened.record.legs[0].id },
      { side: 'sell', qty: 100, price: 16800, fees: 100, timestamp: Date.now() },
    )
    await book.setCloseReason(id, { id: 'close-reason-hit-target', name: 'Hit Target' })

    renderDetail(book, journal, priceBook, id)

    await screen.findByLabelText('status')
    expect(screen.queryByRole('button', { name: /record fill/i })).toBeNull()
  })
})
