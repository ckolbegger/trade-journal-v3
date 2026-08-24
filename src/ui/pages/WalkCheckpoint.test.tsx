import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
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
import type { InstrumentMarksNeeded } from '@/coordinators/valuations'
import { inMemoryBooks } from '../../../tests/support/trade-book'

// The Daily Review checkpoint — one open Trade, four steps in order: fill this
// Trade's missing Marks, look at the refreshed numbers, record the Action (that
// IS reviewing it), then settle whatever journal this Trade owes.

// The gap arithmetic below counts calendar days back from "today", while
// missingMarks skips market-closed dates (domain/dates.isMarketClosed, the
// S4.4 weekend-quiet ruling). Left on the wall clock these expectations ask
// for weekend rows the app correctly refuses, so they fail whenever the run
// lands near a weekend. Pin today to a Thursday: daysAgo(0..3) are then all
// trading days and the suite is date-independent.
const PINNED_TODAY = '2026-08-20T12:00:00' // a Thursday

function pinToday() {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(PINNED_TODAY))
}

beforeAll(pinToday)
afterAll(() => {
  vi.useRealTimers()
})

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
              needs={[{ instrument: ticker, range: { from: daysAgo(2), to: todayISO() } }]}
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

  const CONTRACT = 'AAPL 2027-06-18 C 200'

  async function openCallTrade(f: Fixture): Promise<string> {
    const planDraft: PlanDraft = {
      accountId: f.accountId,
      thesis: 'AAPL breaks out',
      strategyId: 'strategy-long-call',
      ideaSourceId: '',
      plannedLegs: [
        {
          side: 'buy',
          instrument: {
            kind: 'option',
            ticker: 'AAPL',
            expiration: '2027-06-18',
            type: 'call',
            strike: 20000,
          },
          qty: 1,
        },
      ],
      exitLevels: [],
      plannedAt: daysAgo(2),
    }
    const id = await f.tradeBook.confirmPlan(planDraft)
    await f.tradeBook.recordExecution(
      { tradeId: id, newLeg: CONTRACT },
      {
        side: 'buy',
        qty: 1,
        price: 1200,
        fees: 65,
        timestamp: new Date(`${daysAgo(2)}T12:00:00`).getTime(),
      },
    )
    return id
  }

  function renderOptionCheckpoint(f: Fixture, tradeId: string, needs: InstrumentMarksNeeded[]) {
    return render(
      <TradeBookContext.Provider value={f.tradeBook}>
        <JournalContext.Provider value={f.journal}>
          <PriceBookContext.Provider value={f.priceBook}>
            <ValuationsContext.Provider value={new Valuations(f.tradeBook, f.priceBook)}>
              <WalkCheckpoint
                tradeId={tradeId}
                ticker="AAPL"
                needs={needs}
                asOf={todayISO()}
                reviewedToday={false}
                onReviewed={() => {}}
              />
            </ValuationsContext.Provider>
          </PriceBookContext.Provider>
        </JournalContext.Provider>
      </TradeBookContext.Provider>,
    )
  }

  it('prompts for contract and underlying Marks', async () => {
    const f = await fixture()
    const tradeId = await openCallTrade(f)

    renderOptionCheckpoint(f, tradeId, [
      { instrument: CONTRACT, range: { from: daysAgo(2), to: todayISO() } },
      { instrument: 'AAPL', range: { from: daysAgo(2), to: todayISO() } },
    ])

    const rows = await screen.findByRole('list', { name: 'marks needed' })
    const labels = within(rows)
      .getAllByRole('listitem')
      .map((li) => li.getAttribute('aria-label'))
    expect(labels).toContain(`${CONTRACT} ${todayISO()}`)
    expect(labels).toContain(`AAPL ${todayISO()}`)
  })

  it("prompts only the later-gapped instrument's dates (no re-prompt of the other instrument's interior history)", async () => {
    const f = await fixture()
    const tradeId = await openCallTrade(f)

    // The contract was marked yesterday (only today's gap remains); the
    // underlying has never been marked (its gap runs back to the fill).
    await f.priceBook.record(CONTRACT, daysAgo(1), 1400, 'manual')

    renderOptionCheckpoint(f, tradeId, [
      { instrument: CONTRACT, range: { from: todayISO(), to: todayISO() } },
      { instrument: 'AAPL', range: { from: daysAgo(2), to: todayISO() } },
    ])

    const rows = await screen.findByRole('list', { name: 'marks needed' })
    const labels = within(rows)
      .getAllByRole('listitem')
      .map((li) => li.getAttribute('aria-label'))
    // The contract owes only today — its marked yesterday never reappears.
    expect(labels.filter((l) => l?.startsWith(CONTRACT))).toEqual([`${CONTRACT} ${todayISO()}`])
    // The never-marked underlying owes every day since the fill.
    expect(
      [daysAgo(2), daysAgo(1), daysAgo(0)].map((date) => labels.includes(`AAPL ${date}`)),
    ).toEqual([true, true, true])
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

describe('WalkCheckpoint — Considered prompt', () => {
  it('renders the Considered prompt at the checkpoint', async () => {
    const f = await fixture()
    const aapl = await openTrade(f, 'AAPL')

    renderCheckpoint(f, aapl, 'AAPL')

    expect(
      await screen.findByLabelText(/anything you considered doing and decided against/i),
    ).toBeInTheDocument()
  })

  it('records a written considered-action on the review entry', async () => {
    const f = await fixture()
    const aapl = await openTrade(f, 'AAPL')

    renderCheckpoint(f, aapl, 'AAPL')
    await userEvent.type(
      await screen.findByLabelText(/anything you considered doing and decided against/i),
      'Almost added to the position, held off',
    )
    await recordAction('Hold')

    const entries = await f.journal.entriesFor({ trade: aapl })
    const review = entries.find((e) => e.anchor.kind === 'review')!
    expect(review.answered.find((a) => a.prompt.id === 'considered')?.answer?.value).toBe(
      'Almost added to the position, held off',
    )
  })
})

describe('WalkCheckpoint — nothing to note', () => {
  it('declines the whole entry from one action', async () => {
    const f = await fixture()
    const aapl = await openTrade(f, 'AAPL')

    renderCheckpoint(f, aapl, 'AAPL')
    await userEvent.click(await screen.findByRole('button', { name: /nothing to note today/i }))

    const entries = await f.journal.entriesFor({ trade: aapl })
    const review = entries.find((e) => e.anchor.kind === 'review')!
    expect(review.declined).toBe(true)
    expect(review.placeholder).toBe(false)
  })

  it('offers no per-prompt decline control', async () => {
    const f = await fixture()
    const aapl = await openTrade(f, 'AAPL')

    renderCheckpoint(f, aapl, 'AAPL')
    await screen.findByLabelText(/anything you considered doing and decided against/i)

    expect(screen.getAllByRole('button', { name: /nothing to note today/i })).toHaveLength(1)
  })

  it('marks the Trade reviewed, same as a written entry', async () => {
    const f = await fixture()
    const aapl = await openTrade(f, 'AAPL')
    const onReviewed = vi.fn()

    renderCheckpoint(f, aapl, 'AAPL', onReviewed)
    await userEvent.click(await screen.findByRole('button', { name: /nothing to note today/i }))

    expect(onReviewed).toHaveBeenCalledWith(aapl)
  })

  it('creates no Journal Debt', async () => {
    const f = await fixture()
    const aapl = await openTrade(f, 'AAPL')

    renderCheckpoint(f, aapl, 'AAPL')
    await userEvent.click(await screen.findByRole('button', { name: /nothing to note today/i }))

    expect(await f.journal.outstandingDebt()).toEqual([])
  })

  it('leaves every field editable before and after the action', async () => {
    const f = await fixture()
    const aapl = await openTrade(f, 'AAPL')

    renderCheckpoint(f, aapl, 'AAPL')

    const considered = (await screen.findByLabelText(
      /anything you considered doing and decided against/i,
    )) as HTMLTextAreaElement
    expect(considered).not.toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: /nothing to note today/i }))

    const considereAfter = (await screen.findByLabelText(
      /anything you considered doing and decided against/i,
    )) as HTMLTextAreaElement
    expect(considereAfter).not.toBeDisabled()
    await userEvent.type(considereAfter, 'still editable')
    expect(considereAfter).toHaveValue('still editable')
    expect(
      screen.getByRole('combobox', { name: /what will you do with this trade/i }),
    ).not.toBeDisabled()
  })
})

describe('walk (fetched marks)', () => {
  it('prompts only for instruments the fetch did not satisfy', async () => {
    const f = await fixture()
    const aapl = await openTrade(f, 'AAPL')
    // A prior fetch already stored today's Mark — 'fetched' origin, same as
    // PriceBook.fetch would leave it after the review's one bulk fetch.
    await f.priceBook.record('AAPL', todayISO(), 16000, 'fetched')

    renderCheckpoint(f, aapl, 'AAPL')

    const rows = await screen.findByRole('list', { name: 'marks needed' })
    const labels = within(rows)
      .getAllByRole('listitem')
      .map((li) => li.getAttribute('aria-label'))
    // Two of the three gap dates remain; today's fetched Mark never reappears.
    expect(labels).toEqual([`AAPL ${daysAgo(2)}`, `AAPL ${daysAgo(1)}`])
    expect(labels).not.toContain(`AAPL ${todayISO()}`)
  })
})
