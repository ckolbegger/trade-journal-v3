import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

// S5.2 partial close with FIFO: the worked example (docs/plan/slice-05-scaling.md)
// continues S5.1's two buys (100 @ 150.00, 100 @ 160.00, both fees 1.00) with a
// partial sell of 120 @ 165.00 fees 1.00 -> realized 1597.00, remaining 80
// shares, unrealized 400.00 at mark 165.00.

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
const sell120: ExecutionDraft = {
  side: 'sell',
  qty: 120,
  price: 16500,
  fees: 100,
  timestamp: new Date('2026-07-15T12:00:00').getTime(),
}
const sell80Final: ExecutionDraft = {
  side: 'sell',
  qty: 80,
  price: 17000,
  fees: 100,
  timestamp: new Date('2026-07-20T12:00:00').getTime(),
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

describe('TradeDetail (scaling out)', () => {
  it('shows realized 1597.00 and unrealized 400.00 after the partial', async () => {
    const { book, journal, priceBook, id } = await seededTrade()
    const opened = await book.recordExecution({ tradeId: id, newLeg: 'AAPL' }, buyLotA)
    await book.recordExecution({ tradeId: id, legId: opened.record.legs[0].id }, buyLotB)
    await book.recordExecution({ tradeId: id, legId: opened.record.legs[0].id }, sell120)
    await priceBook.record('AAPL', todayISO(), 16500, 'manual')

    renderDetail(book, journal, priceBook, id)

    const pnl = await screen.findByLabelText('profit and loss')
    await waitFor(() => expect(pnl).toHaveTextContent('1597.00'))
    expect(pnl).toHaveTextContent('400.00')
  })

  it('does not prompt Close Reason on a partial close', async () => {
    const { book, journal, priceBook, id } = await seededTrade()
    const opened = await book.recordExecution({ tradeId: id, newLeg: 'AAPL' }, buyLotA)
    await book.recordExecution({ tradeId: id, legId: opened.record.legs[0].id }, buyLotB)
    await book.recordExecution({ tradeId: id, legId: opened.record.legs[0].id }, sell120)

    renderDetail(book, journal, priceBook, id)

    await screen.findByLabelText('status')
    expect(screen.queryByRole('heading', { name: /close this trade/i })).toBeNull()
  })

  it('prompts Close Reason at the flattening fill as usual', async () => {
    const { book, journal, priceBook, id } = await seededTrade()
    const opened = await book.recordExecution({ tradeId: id, newLeg: 'AAPL' }, buyLotA)
    await book.recordExecution({ tradeId: id, legId: opened.record.legs[0].id }, buyLotB)
    await book.recordExecution({ tradeId: id, legId: opened.record.legs[0].id }, sell120)
    await book.recordExecution({ tradeId: id, legId: opened.record.legs[0].id }, sell80Final)

    renderDetail(book, journal, priceBook, id)

    await screen.findByRole('heading', { name: /close this trade/i })
  })

  it('rejects an oversized close with a message naming held quantity', async () => {
    const { book, journal, priceBook, id } = await seededTrade()
    const opened = await book.recordExecution({ tradeId: id, newLeg: 'AAPL' }, buyLotA)
    await book.recordExecution({ tradeId: id, legId: opened.record.legs[0].id }, buyLotB)

    renderDetail(book, journal, priceBook, id)

    await screen.findByRole('button', { name: /record fill/i })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /record fill/i }))

    await user.selectOptions(screen.getByLabelText(/side/i), 'sell')
    await user.type(screen.getByLabelText(/quantity/i), '250')
    await user.type(screen.getByLabelText(/price/i), '165')
    await user.click(screen.getByRole('button', { name: /record fill/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('200')
  })
})
