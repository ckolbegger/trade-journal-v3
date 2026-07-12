import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WalkCheckpoint } from './WalkCheckpoint'
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
import type {
  Account,
  ExecutionDraft,
  ExitLevel,
  Institution,
  PlanDraft,
} from '@/books/tradebook/types'
import { inMemoryBooks } from '../../../tests/support/trade-book'

// The Daily Review checkpoint — one open Trade, four steps in order: fill this
// Trade's missing Marks, look at the refreshed numbers, record the Action (that
// IS reviewing it), then settle whatever journal this Trade owes.

// The trader's local date is the trading date; the fill landed two days ago, so
// nothing is marked and the gap runs from then through today.
function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

const stop: ExitLevel = {
  scope: { level: 'trade' },
  side: 'stop',
  kind: 'underlyingPrice',
  price: 14000,
}
const target: ExitLevel = {
  scope: { level: 'trade' },
  side: 'target',
  kind: 'underlyingPrice',
  price: 17000,
}

function fill(): ExecutionDraft {
  return {
    side: 'buy',
    qty: 100,
    price: 15000,
    fees: 100,
    timestamp: new Date(`${daysAgo(2)}T12:00:00`).getTime(),
  }
}

interface Fixture {
  tradeBook: TradeBook
  journal: Journal
  priceBook: PriceBook
  accountId: string
}

async function fixture(): Promise<Fixture> {
  const { tradeBook, journal, priceBook } = inMemoryBooks()
  const institution = { id: '', name: 'Schwab' } as Institution
  await tradeBook.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await tradeBook.registries.accounts.save(account)
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
    exitLevels: [stop, target],
    plannedAt: daysAgo(2),
  }
}

async function openTrade(f: Fixture, ticker: string): Promise<string> {
  const id = await f.tradeBook.confirmPlan(draft(f.accountId, ticker))
  await f.tradeBook.recordExecution({ tradeId: id, newLeg: ticker }, fill())
  return id
}

async function owePlanJournal(f: Fixture, tradeId: string): Promise<string> {
  const planType = (await f.journal.entryTypes.list()).find((t) => t.designatedFor === 'plan')!
  return f.journal.write({
    anchor: { kind: 'plan', tradeId },
    entryTypeId: planType.id,
    at: new Date(`${daysAgo(2)}T11:00:00`).getTime(),
    answers: [],
    placeholder: true,
  })
}

function renderCheckpoint(
  f: Fixture,
  tradeId: string,
  ticker: string,
  onReviewed = () => {},
  reviewedToday = false,
) {
  return render(
    <TradeBookContext.Provider value={f.tradeBook}>
      <JournalContext.Provider value={f.journal}>
        <PriceBookContext.Provider value={f.priceBook}>
          <ValuationsContext.Provider value={new Valuations(f.tradeBook, f.priceBook)}>
            <WalkCheckpoint
              tradeId={tradeId}
              ticker={ticker}
              instruments={[ticker]}
              range={{ from: daysAgo(2), to: todayISO() }}
              asOf={todayISO()}
              reviewedToday={reviewedToday}
              onReviewed={onReviewed}
            />
          </ValuationsContext.Provider>
        </PriceBookContext.Provider>
      </JournalContext.Provider>
    </TradeBookContext.Provider>,
  )
}

// The Action this Trade already recorded today — what a re-entered checkpoint
// must show instead of a blank form.
async function alreadyReviewed(f: Fixture, tradeId: string, action: string): Promise<void> {
  const reviewType = (await f.journal.entryTypes.list()).find((t) => t.designatedFor === 'review')!
  await f.journal.write({
    anchor: { kind: 'review', date: todayISO(), tradeId },
    entryTypeId: reviewType.id,
    at: Date.now(),
    answers: [{ promptId: 'action', value: action }],
    placeholder: false,
  })
}

async function recordAction(action = 'Hold') {
  await userEvent.selectOptions(
    await screen.findByLabelText(/what will you do with this trade/i),
    action,
  )
  await userEvent.click(screen.getByRole('button', { name: /record action/i }))
}

describe('WalkCheckpoint', () => {
  it("prompts only this Trade's missing (instrument, date) rows", async () => {
    const f = await fixture()
    const aapl = await openTrade(f, 'AAPL')
    await openTrade(f, 'MSFT')

    renderCheckpoint(f, aapl, 'AAPL')

    const rows = await screen.findByRole('list', { name: 'marks needed' })
    expect(
      within(rows)
        .getAllByRole('listitem')
        .map((li) => li.getAttribute('aria-label')),
    ).toEqual([`AAPL ${daysAgo(2)}`, `AAPL ${daysAgo(1)}`, `AAPL ${daysAgo(0)}`])
    // The other open Trade's instrument belongs to its own checkpoint.
    expect(within(rows).queryByLabelText(/MSFT/)).toBeNull()
  })

  it('records typed prices via PriceBook.record as manual Marks', async () => {
    const f = await fixture()
    const aapl = await openTrade(f, 'AAPL')
    const recordSpy = vi.spyOn(f.priceBook, 'record')

    renderCheckpoint(f, aapl, 'AAPL')

    const row = await screen.findByRole('listitem', { name: `AAPL ${todayISO()}` })
    await userEvent.type(within(row).getByLabelText(/price/i), '160')
    await userEvent.click(within(row).getByRole('button', { name: /save/i }))

    expect(recordSpy).toHaveBeenCalledWith('AAPL', todayISO(), 16000, 'manual')
    // The filled row is gone — a Mark that exists is never asked for again.
    expect(screen.queryByRole('listitem', { name: `AAPL ${todayISO()}` })).toBeNull()
  })

  it('allows skipping a gap row and proceeds', async () => {
    const f = await fixture()
    const aapl = await openTrade(f, 'AAPL')

    renderCheckpoint(f, aapl, 'AAPL')

    const row = await screen.findByRole('listitem', { name: `AAPL ${daysAgo(2)}` })
    await userEvent.click(within(row).getByRole('button', { name: /skip/i }))

    // The blind spot is accepted: the row is gone and nothing was stored for it.
    expect(screen.queryByRole('listitem', { name: `AAPL ${daysAgo(2)}` })).toBeNull()
    expect(await f.priceBook.markSet(['AAPL'], daysAgo(2))).toEqual(new Map())
    expect(screen.getByRole('listitem', { name: `AAPL ${daysAgo(1)}` })).toBeInTheDocument()
  })

  it('shows the refreshed dashboard after marks land', async () => {
    const f = await fixture()
    const aapl = await openTrade(f, 'AAPL')

    renderCheckpoint(f, aapl, 'AAPL')

    const row = await screen.findByRole('listitem', { name: `AAPL ${todayISO()}` })
    await userEvent.type(within(row).getByLabelText(/price/i), '160')
    await userEvent.click(within(row).getByRole('button', { name: /save/i }))

    // The worked example at mark 160: unrealized 1000.00, total 999.00, planned
    // risk 2000.00 (giveback counts).
    const pnl = await screen.findByLabelText('profit and loss')
    expect(pnl).toHaveTextContent(/1000\.00/)
    expect(pnl).toHaveTextContent(/999\.00/)
    const rr = screen.getByLabelText('ongoing risk and reward')
    expect(within(rr).getByLabelText('planned risk')).toHaveTextContent(/2000\.00/)
  })

  it('writes the Action as a review-anchored entry (that IS reviewing)', async () => {
    const f = await fixture()
    const aapl = await openTrade(f, 'AAPL')

    renderCheckpoint(f, aapl, 'AAPL')
    await recordAction('Hold')

    const entries = await f.journal.entriesFor({ trade: aapl })
    const review = entries.find((e) => e.anchor.kind === 'review')!
    expect(review.anchor).toEqual({ kind: 'review', date: todayISO(), tradeId: aapl })
    expect(review.placeholder).toBe(false)
    expect(review.answered.find((a) => a.prompt.id === 'action')?.answer).toEqual({
      promptId: 'action',
      value: 'Hold',
    })
  })

  it('marks the checkpoint done only after the Action is recorded', async () => {
    const f = await fixture()
    const aapl = await openTrade(f, 'AAPL')
    const onReviewed = vi.fn()

    renderCheckpoint(f, aapl, 'AAPL', onReviewed)

    // Filling a Mark is not reviewing — only the Action is.
    const row = await screen.findByRole('listitem', { name: `AAPL ${todayISO()}` })
    await userEvent.type(within(row).getByLabelText(/price/i), '160')
    await userEvent.click(within(row).getByRole('button', { name: /save/i }))
    expect(onReviewed).not.toHaveBeenCalled()

    await recordAction('Exit Soon')

    expect(onReviewed).toHaveBeenCalledWith(aapl)
    expect(await screen.findByLabelText('action recorded')).toHaveTextContent(/exit soon/i)
  })

  it('does not record an Action until one is chosen', async () => {
    const f = await fixture()
    const aapl = await openTrade(f, 'AAPL')
    const onReviewed = vi.fn()

    renderCheckpoint(f, aapl, 'AAPL', onReviewed)

    // An Action is the whole point of the checkpoint — an empty one would put a
    // blank row in the behavioral dataset, so it cannot be recorded.
    await userEvent.click(await screen.findByRole('button', { name: /record action/i }))

    expect(onReviewed).not.toHaveBeenCalled()
    expect(await f.journal.entriesFor({ trade: aapl })).toEqual([])
    expect(screen.getByLabelText(/what will you do with this trade/i)).toBeInTheDocument()
  })

  it('shows the Action already recorded today instead of asking again', async () => {
    const f = await fixture()
    const aapl = await openTrade(f, 'AAPL')
    const owed = await owePlanJournal(f, aapl)
    await alreadyReviewed(f, aapl, 'Adjust')

    renderCheckpoint(f, aapl, 'AAPL', () => {}, true)

    // Re-entering a reviewed Trade shows its Action and reaches its debt — it
    // never offers a second Action for the same day (one Action per Trade per day).
    expect(await screen.findByLabelText('action recorded')).toHaveTextContent(/adjust/i)
    expect(screen.queryByLabelText(/what will you do with this trade/i)).toBeNull()
    expect(await screen.findByRole('list', { name: 'journal owed' })).toBeInTheDocument()

    // Settling still works from the re-entered checkpoint.
    await userEvent.type(
      screen.getByLabelText(/why this trade, why now/i),
      'Breakout confirmed on volume',
    )
    await userEvent.click(screen.getByRole('button', { name: /settle/i }))

    const entries = await f.journal.entriesFor({ trade: aapl })
    expect(entries.filter((e) => e.anchor.kind === 'review')).toHaveLength(1) // no duplicate
    expect(entries.find((e) => e.id === owed)?.settledAt).toBeDefined()
  })

  it("offers this Trade's placeholders for settlement", async () => {
    const f = await fixture()
    const aapl = await openTrade(f, 'AAPL')
    const owed = await owePlanJournal(f, aapl)
    const other = await openTrade(f, 'MSFT')
    await owePlanJournal(f, other)

    renderCheckpoint(f, aapl, 'AAPL')
    await recordAction()

    // Only THIS Trade's debt, answered against the prompts as they were asked.
    const debt = await screen.findByRole('list', { name: 'journal owed' })
    expect(within(debt).getAllByRole('listitem')).toHaveLength(1)
    await userEvent.type(
      within(debt).getByLabelText(/why this trade, why now/i),
      'Breakout confirmed on volume',
    )
    await userEvent.click(within(debt).getByRole('button', { name: /settle/i }))

    const settled = (await f.journal.entriesFor({ trade: aapl })).find((e) => e.id === owed)!
    expect(settled.settledAt).toBeDefined()
    expect(settled.answered.find((a) => a.prompt.id === 'why')?.answer?.value).toBe(
      'Breakout confirmed on volume',
    )
    expect(await f.journal.outstandingDebt()).toHaveLength(1) // the other Trade still owes
  })

  it('allows deferring settlement without blocking the walk', async () => {
    const f = await fixture()
    const aapl = await openTrade(f, 'AAPL')
    const owed = await owePlanJournal(f, aapl)
    const onReviewed = vi.fn()

    renderCheckpoint(f, aapl, 'AAPL', onReviewed)
    await recordAction()

    // The checkpoint is done on the Action alone — the debt is offered, never
    // demanded (ADR 0006: no nag).
    expect(onReviewed).toHaveBeenCalledWith(aapl)
    expect(await screen.findByRole('list', { name: 'journal owed' })).toBeInTheDocument()
    const debt = await f.journal.outstandingDebt()
    expect(debt.map((e) => e.id)).toEqual([owed])
  })
})
