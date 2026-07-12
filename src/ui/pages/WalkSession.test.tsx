import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WalkSession } from './WalkSession'
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
import type { TradeMarksNeeded } from '@/coordinators/valuations'
import type { Account, ExecutionDraft, Institution, PlanDraft } from '@/books/tradebook/types'
import { inMemoryBooks } from '../../../tests/support/trade-book'

// The walk as a session: the open Trades in the order Review.walk handed over,
// one checkpoint at a time, with progress and a completion state. The order is
// snapshotted at session start — Marks landing mid-walk never reshuffle it — and
// a Trade the trader steps past stays visibly unreviewed, never nagged.

function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function fill(): ExecutionDraft {
  return {
    side: 'buy',
    qty: 100,
    price: 15000,
    fees: 100,
    timestamp: new Date(`${daysAgo(1)}T12:00:00`).getTime(),
  }
}

interface Fixture {
  tradeBook: TradeBook
  journal: Journal
  priceBook: PriceBook
  review: Review
  accountId: string
}

async function fixture(): Promise<Fixture> {
  const { tradeBook, journal, priceBook } = inMemoryBooks()
  const institution = { id: '', name: 'Schwab' } as Institution
  await tradeBook.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await tradeBook.registries.accounts.save(account)
  await new Workspace(tradeBook, journal).ensureSeeded()
  const review = new Review(new Valuations(tradeBook, priceBook), journal, tradeBook)
  return { tradeBook, journal, priceBook, review, accountId: account.id }
}

function draft(accountId: string, ticker: string): PlanDraft {
  return {
    accountId,
    thesis: `${ticker} breaks out`,
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker }, qty: 100 }],
    exitLevels: [],
    plannedAt: daysAgo(1),
  }
}

async function openTrade(f: Fixture, ticker: string): Promise<string> {
  const id = await f.tradeBook.confirmPlan(draft(f.accountId, ticker))
  await f.tradeBook.recordExecution({ tradeId: id, newLeg: ticker }, fill())
  return id
}

function marksNeeded(tradeId: string, ticker: string): TradeMarksNeeded {
  return { tradeId, instruments: [ticker], range: { from: daysAgo(1), to: todayISO() } }
}

function renderSession(f: Fixture, needed: TradeMarksNeeded[]) {
  return render(
    <TradeBookContext.Provider value={f.tradeBook}>
      <JournalContext.Provider value={f.journal}>
        <PriceBookContext.Provider value={f.priceBook}>
          <ValuationsContext.Provider value={new Valuations(f.tradeBook, f.priceBook)}>
            <ReviewContext.Provider value={f.review}>
              <WalkSession asOf={todayISO()} marksNeeded={needed} />
            </ReviewContext.Provider>
          </ValuationsContext.Provider>
        </PriceBookContext.Provider>
      </JournalContext.Provider>
    </TradeBookContext.Provider>,
  )
}

async function recordAction(action = 'Hold') {
  await userEvent.selectOptions(
    await screen.findByLabelText(/what will you do with this trade/i),
    action,
  )
  await userEvent.click(screen.getByRole('button', { name: /record action/i }))
}

async function nextTrade() {
  await userEvent.click(screen.getByRole('button', { name: /next trade/i }))
}

describe('WalkSession', () => {
  it('shows progress (reviewed / total) and a completion state', async () => {
    const f = await fixture()
    const aapl = await openTrade(f, 'AAPL')
    const msft = await openTrade(f, 'MSFT')

    renderSession(f, [marksNeeded(aapl, 'AAPL'), marksNeeded(msft, 'MSFT')])

    expect(await screen.findByLabelText('progress')).toHaveTextContent('0 of 2')

    await recordAction('Hold')
    expect(screen.getByLabelText('progress')).toHaveTextContent('1 of 2')
    await nextTrade()

    await recordAction('Watch Closely')
    expect(screen.getByLabelText('progress')).toHaveTextContent('2 of 2')
    await nextTrade()

    expect(await screen.findByText(/review complete/i)).toBeInTheDocument()
  })

  it('does not reshuffle order as marks land mid-session', async () => {
    const f = await fixture()
    const aapl = await openTrade(f, 'AAPL')
    const msft = await openTrade(f, 'MSFT')
    const walkSpy = vi.spyOn(f.review, 'walk')

    renderSession(f, [marksNeeded(aapl, 'AAPL'), marksNeeded(msft, 'MSFT')])

    expect(await screen.findByRole('heading', { name: 'AAPL' })).toBeInTheDocument()

    // A Mark lands mid-walk — the session order was snapshotted at start, so the
    // second checkpoint is still MSFT and the order is never recomputed.
    const row = await screen.findByRole('listitem', { name: `AAPL ${todayISO()}` })
    await userEvent.type(within(row).getByLabelText(/price/i), '160')
    await userEvent.click(within(row).getByRole('button', { name: /save/i }))
    await nextTrade()

    expect(await screen.findByRole('heading', { name: 'MSFT' })).toBeInTheDocument()
    expect(walkSpy).toHaveBeenCalledTimes(1)
  })

  it('leaves a skipped Trade visibly unreviewed', async () => {
    const f = await fixture()
    const aapl = await openTrade(f, 'AAPL')
    const msft = await openTrade(f, 'MSFT')

    renderSession(f, [marksNeeded(aapl, 'AAPL'), marksNeeded(msft, 'MSFT')])

    // Step past AAPL without an Action — allowed, and never nagged.
    expect(await screen.findByRole('heading', { name: 'AAPL' })).toBeInTheDocument()
    await nextTrade()
    await recordAction('Hold')
    await nextTrade()

    const summary = await screen.findByRole('list', { name: 'walk summary' })
    expect(within(summary).getByRole('listitem', { name: 'AAPL' })).toHaveTextContent(
      /not reviewed/i,
    )
    expect(within(summary).getByRole('listitem', { name: 'MSFT' })).toHaveTextContent(/reviewed/i)
    expect(await f.journal.entriesFor({ trade: aapl })).toEqual([])
    expect(await f.journal.entriesFor({ trade: msft })).toHaveLength(1)
  })
})
