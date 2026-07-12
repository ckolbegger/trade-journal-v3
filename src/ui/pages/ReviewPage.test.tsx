import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ReviewPage } from './ReviewPage'
import { TradeBookContext } from '../tradeBookContext'
import { JournalContext } from '../journalContext'
import { PriceBookContext } from '../priceBookContext'
import { ValuationsContext } from '../valuationsContext'
import { ReviewContext } from '../reviewContext'
import { Valuations } from '@/coordinators/valuations'
import { Review } from '@/coordinators/review'
import { Workspace } from '@/workspace/workspace'
import { todayISO } from '../format'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { Journal } from '@/books/journal/journal'
import type { PriceBook } from '@/books/pricebook/price-book'
import type { Account, ExecutionDraft, Institution, PlanDraft } from '@/books/tradebook/types'
import type { EntryType } from '@/books/journal/types'
import { inMemoryBooks } from '../../../tests/support/trade-book'

// The trader's local date is the trading date, and the page reviews "today" — so
// the fixture dates are relative to it: a Mark two days ago leaves yesterday and
// today unpriced (the skipped-day gap).
function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

const PLAN_TYPE: EntryType = {
  id: 'plan-type',
  name: 'Plan',
  designatedFor: 'plan',
  prompts: [{ id: 'why', text: 'Why this trade, why now?', kind: 'text' }],
}

function fill(): ExecutionDraft {
  return {
    side: 'buy',
    qty: 100,
    price: 15000,
    fees: 100,
    timestamp: new Date(`${daysAgo(3)}T12:00:00`).getTime(),
  }
}

async function workspace(): Promise<{
  tradeBook: TradeBook
  journal: Journal
  priceBook: PriceBook
  accountId: string
}> {
  const { tradeBook, journal, priceBook } = inMemoryBooks()
  const institution = { id: '', name: 'Schwab' } as Institution
  await tradeBook.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await tradeBook.registries.accounts.save(account)
  await journal.entryTypes.save({ ...PLAN_TYPE })
  // The walk's checkpoint asks the seeded Trade Review type's Action prompt.
  await new Workspace(tradeBook, journal).ensureSeeded()
  return { tradeBook, journal, priceBook, accountId: account.id }
}

function draft(accountId: string, ticker: string): PlanDraft {
  return {
    accountId,
    thesis: `${ticker} breaks out`,
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker }, qty: 100 }],
    exitLevels: [],
    plannedAt: daysAgo(3),
  }
}

async function openTrade(tradeBook: TradeBook, accountId: string, ticker: string): Promise<string> {
  const id = await tradeBook.confirmPlan(draft(accountId, ticker))
  await tradeBook.recordExecution({ tradeId: id, newLeg: ticker }, fill())
  return id
}

function renderPage(tradeBook: TradeBook, journal: Journal, priceBook: PriceBook) {
  const valuations = new Valuations(tradeBook, priceBook)
  const review = new Review(valuations, journal, tradeBook)
  return render(
    <TradeBookContext.Provider value={tradeBook}>
      <JournalContext.Provider value={journal}>
        <PriceBookContext.Provider value={priceBook}>
          <ValuationsContext.Provider value={valuations}>
            <ReviewContext.Provider value={review}>
              <MemoryRouter>
                <ReviewPage />
              </MemoryRouter>
            </ReviewContext.Provider>
          </ValuationsContext.Provider>
        </PriceBookContext.Provider>
      </JournalContext.Provider>
    </TradeBookContext.Provider>,
  )
}

async function startReview() {
  await userEvent.click(screen.getByRole('button', { name: /start review/i }))
}

describe('ReviewAgendaPage', () => {
  it('lists each open Trade with its missing (instrument, date) rows', async () => {
    const { tradeBook, journal, priceBook, accountId } = await workspace()
    await openTrade(tradeBook, accountId, 'AAPL')
    await openTrade(tradeBook, accountId, 'MSFT')
    // AAPL was marked yesterday; MSFT has never been marked.
    await priceBook.record('AAPL', daysAgo(1), 16000, 'manual')

    renderPage(tradeBook, journal, priceBook)
    await startReview()

    const aapl = await screen.findByRole('listitem', { name: 'AAPL' })
    expect(within(aapl).getByRole('listitem', { name: `AAPL ${todayISO()}` })).toBeInTheDocument()

    const msft = screen.getByRole('listitem', { name: 'MSFT' })
    // Never marked → rows back to the Trade's first Execution date (3 days ago).
    expect(within(msft).getAllByRole('listitem')).toHaveLength(4)
    expect(within(msft).getByRole('listitem', { name: `MSFT ${daysAgo(3)}` })).toBeInTheDocument()
  })

  it("shows Tuesday's row after a skipped day (gap recovery visible)", async () => {
    const { tradeBook, journal, priceBook, accountId } = await workspace()
    await openTrade(tradeBook, accountId, 'AAPL')
    // Marked two days ago, then the trader skipped a day: yesterday AND today owe Marks.
    await priceBook.record('AAPL', daysAgo(2), 16000, 'manual')

    renderPage(tradeBook, journal, priceBook)
    await startReview()

    const aapl = await screen.findByRole('listitem', { name: 'AAPL' })
    const rows = within(aapl)
      .getAllByRole('listitem')
      .map((li) => li.getAttribute('aria-label'))
    expect(rows).toEqual([`AAPL ${daysAgo(1)}`, `AAPL ${daysAgo(0)}`])
  })

  it('shows the outstanding journal debt count', async () => {
    const { tradeBook, journal, priceBook, accountId } = await workspace()
    const tradeId = await openTrade(tradeBook, accountId, 'AAPL')
    await journal.write({
      anchor: { kind: 'plan', tradeId },
      entryTypeId: PLAN_TYPE.id,
      at: Date.now(),
      answers: [],
      placeholder: true,
    })

    renderPage(tradeBook, journal, priceBook)
    await startReview()

    expect(await screen.findByLabelText('journal debt')).toHaveTextContent('1')
  })

  it('always calls PriceBook.fetch before presenting the remainder', async () => {
    const { tradeBook, journal, priceBook, accountId } = await workspace()
    await openTrade(tradeBook, accountId, 'AAPL')
    const fetchSpy = vi.spyOn(priceBook, 'fetch')
    const missingSpy = vi.spyOn(priceBook, 'missingMarks')

    renderPage(tradeBook, journal, priceBook)
    await startReview()

    await screen.findByRole('listitem', { name: 'AAPL' })
    expect(fetchSpy).toHaveBeenCalledWith(['AAPL'], { from: daysAgo(3), to: todayISO() })
    // The UI never knows whether sources exist — it fetches, then prompts for what
    // is still missing.
    expect(fetchSpy.mock.invocationCallOrder[0]).toBeLessThan(
      missingSpy.mock.invocationCallOrder[0],
    )
  })

  it('begins the walk from the agenda', async () => {
    const { tradeBook, journal, priceBook, accountId } = await workspace()
    await openTrade(tradeBook, accountId, 'AAPL')

    renderPage(tradeBook, journal, priceBook)
    await startReview()

    await userEvent.click(await screen.findByRole('button', { name: /begin walk/i }))

    // The first checkpoint: the Trade, and a session that has reviewed nothing yet.
    expect(await screen.findByRole('heading', { name: 'AAPL' })).toBeInTheDocument()
    expect(screen.getByLabelText('progress')).toHaveTextContent('0 of 1')
  })

  it('shows an all-caught-up state when the agenda is empty', async () => {
    const { tradeBook, journal, priceBook, accountId } = await workspace()
    await openTrade(tradeBook, accountId, 'AAPL')
    // Marked every day the Trade has existed, and no journal skipped.
    for (const days of [3, 2, 1, 0]) {
      await priceBook.record('AAPL', daysAgo(days), 16000, 'manual')
    }

    renderPage(tradeBook, journal, priceBook)
    await startReview()

    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument()
    expect(screen.queryByRole('listitem', { name: 'AAPL' })).not.toBeInTheDocument()
  })

  it('still offers the walk when nothing is left to collect', async () => {
    const { tradeBook, journal, priceBook, accountId } = await workspace()
    await openTrade(tradeBook, accountId, 'AAPL')
    for (const days of [3, 2, 1, 0]) {
      await priceBook.record('AAPL', daysAgo(days), 16000, 'manual')
    }

    renderPage(tradeBook, journal, priceBook)
    await startReview()

    // Marks are the fuel; the walk is the point — an open Trade still owes an
    // Action even when every price is already in.
    await userEvent.click(await screen.findByRole('button', { name: /begin walk/i }))
    expect(await screen.findByRole('heading', { name: 'AAPL' })).toBeInTheDocument()
  })
})
