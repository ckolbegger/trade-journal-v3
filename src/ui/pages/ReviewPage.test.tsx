import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ReviewPage } from './ReviewPage'
import { TradeBookContext } from '../tradeBookContext'
import { JournalContext } from '../journalContext'
import { PriceBookContext } from '../priceBookContext'
import { ValuationsContext } from '../valuationsContext'
import { ReviewContext } from '../reviewContext'
import { WorkspaceContext } from '../workspaceContext'
import { Valuations } from '@/coordinators/valuations'
import { Review } from '@/coordinators/review'
import { Workspace } from '@/workspace/workspace'
import { todayISO } from '../format'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { Journal } from '@/books/journal/journal'
import type { PriceBook } from '@/books/pricebook/price-book'
import type { Account, ExecutionDraft, Institution, PlanDraft } from '@/books/tradebook/types'
import type { EntryType } from '@/books/journal/types'
import type { DateRange, PricingSource, SourceObservation } from '@/books/pricebook/types'
import { inMemoryBooks } from '../../../tests/support/trade-book'

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

async function workspace(sources: PricingSource[] = []): Promise<{
  tradeBook: TradeBook
  journal: Journal
  priceBook: PriceBook
  accountId: string
}> {
  const { tradeBook, journal, priceBook } = inMemoryBooks(sources)
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

function renderPage(
  tradeBook: TradeBook,
  journal: Journal,
  priceBook: PriceBook,
  workspaceInstance: Workspace = new Workspace(tradeBook, journal),
) {
  const valuations = new Valuations(tradeBook, priceBook)
  const review = new Review(valuations, journal, tradeBook)
  return render(
    <TradeBookContext.Provider value={tradeBook}>
      <JournalContext.Provider value={journal}>
        <PriceBookContext.Provider value={priceBook}>
          <WorkspaceContext.Provider value={workspaceInstance}>
            <ValuationsContext.Provider value={valuations}>
              <ReviewContext.Provider value={review}>
                <MemoryRouter>
                  <ReviewPage />
                </MemoryRouter>
              </ReviewContext.Provider>
            </ValuationsContext.Provider>
          </WorkspaceContext.Provider>
        </PriceBookContext.Provider>
      </JournalContext.Provider>
    </TradeBookContext.Provider>,
  )
}

async function startReview() {
  await userEvent.click(screen.getByRole('button', { name: /start review/i }))
}

// A minimal PricingSource stub — the collection screen's own seam (rendering the
// FetchReport), not the adapter's HTTP concerns.
function stubSource(opts: {
  id: string
  supports: (instrument: string) => boolean
  observations?: SourceObservation[]
  error?: Error
}): PricingSource {
  return {
    id: opts.id,
    supports: opts.supports,
    fetch: async (_instruments: string[], _range: DateRange) => {
      if (opts.error) throw opts.error
      return opts.observations ?? []
    },
  }
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

// The backup nudge (S6.3): `lastExportAt` is a fact Workspace records
// (storageHealth); staleness against Settings.backupNudgeDays is display
// policy the Review UI computes — never a Workspace operation
// (workspace.md's facts-vs-behavior split). Checked as soon as Review opens,
// before "Start review" is even clicked.
describe('Review start (backup nudge)', () => {
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL
  const ONE_DAY_MS = 24 * 60 * 60 * 1000

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // Backs up a Workspace's export clock N days ago, without ever touching
  // storage internals directly — freezes "now", exports (stamping
  // lastExportAt at the frozen instant), then restores the real clock so the
  // component's own staleness check runs against the true present.
  async function exportDaysAgo(ws: Workspace, days: number) {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() - days * ONE_DAY_MS)
    await ws.exportAll()
    vi.useRealTimers()
  }

  it('nudges when lastExportAt is older than backupNudgeDays', async () => {
    const { tradeBook, journal, priceBook } = await workspace()
    const ws = new Workspace(tradeBook, journal)
    await ws.settings.set('backupNudgeDays', 7)
    await exportDaysAgo(ws, 8)

    renderPage(tradeBook, journal, priceBook, ws)

    expect(await screen.findByLabelText('backup nudge')).toBeInTheDocument()
  })

  it('nudges when no export has ever happened', async () => {
    const { tradeBook, journal, priceBook } = await workspace()
    const ws = new Workspace(tradeBook, journal)

    renderPage(tradeBook, journal, priceBook, ws)

    expect(await screen.findByLabelText('backup nudge')).toBeInTheDocument()
  })

  it('stays silent within the window', async () => {
    const { tradeBook, journal, priceBook } = await workspace()
    const ws = new Workspace(tradeBook, journal)
    await ws.settings.set('backupNudgeDays', 7)
    await exportDaysAgo(ws, 3)

    renderPage(tradeBook, journal, priceBook, ws)

    await screen.findByRole('button', { name: /start review/i })
    expect(screen.queryByLabelText('backup nudge')).not.toBeInTheDocument()
  })

  it('links to the export action and clears after exporting', async () => {
    const { tradeBook, journal, priceBook } = await workspace()
    const ws = new Workspace(tradeBook, journal)

    renderPage(tradeBook, journal, priceBook, ws)
    const nudge = await screen.findByLabelText('backup nudge')

    await userEvent.click(within(nudge).getByRole('button', { name: /export backup/i }))

    await waitFor(() => expect(screen.queryByLabelText('backup nudge')).not.toBeInTheDocument())
    expect((await ws.storageHealth()).lastExportAt).toBeDefined()
  })

  it('never blocks the session (dismissable, same posture as Journal Debt)', async () => {
    const { tradeBook, journal, priceBook, accountId } = await workspace()
    await openTrade(tradeBook, accountId, 'AAPL')
    const ws = new Workspace(tradeBook, journal)

    renderPage(tradeBook, journal, priceBook, ws)
    const nudge = await screen.findByLabelText('backup nudge')

    await userEvent.click(within(nudge).getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByLabelText('backup nudge')).not.toBeInTheDocument()

    // Dismissing never blocked the session — the review still starts and runs.
    await startReview()
    expect(await screen.findByRole('listitem', { name: 'AAPL' })).toBeInTheDocument()
  })
})

// The trader's local date is the trading date, and the agenda's asOf is
// "today" (real clock) — so the seeded contract expires yesterday, already
// past expiration by construction.
describe('ReviewAgenda (expired)', () => {
  const EXPIRATION = daysAgo(1)
  const CONTRACT = `XYZ ${EXPIRATION} P 100`

  async function seedExpiredCsp(
    tradeBook: TradeBook,
    accountId: string,
  ): Promise<{ tradeId: string }> {
    const draft: PlanDraft = {
      accountId,
      thesis: 'XYZ range-bound',
      strategyId: 'strategy-cash-secured-put',
      ideaSourceId: '',
      plannedLegs: [
        {
          side: 'sell',
          instrument: {
            kind: 'option',
            ticker: 'XYZ',
            expiration: EXPIRATION,
            type: 'put',
            strike: 10000,
          },
          qty: 1,
        },
      ],
      exitLevels: [],
      plannedAt: daysAgo(3),
    }
    const tradeId = await tradeBook.confirmPlan(draft)
    await tradeBook.recordExecution(
      { tradeId, newLeg: CONTRACT },
      {
        side: 'sell',
        qty: 1,
        price: 250,
        fees: 65,
        timestamp: new Date(`${daysAgo(3)}T12:00:00`).getTime(),
      },
    )
    return { tradeId }
  }

  it('lists expired holdings with expiry date', async () => {
    const { tradeBook, journal, priceBook, accountId } = await workspace()
    await seedExpiredCsp(tradeBook, accountId)

    renderPage(tradeBook, journal, priceBook)
    await startReview()

    const row = await screen.findByRole('listitem', { name: /1 XYZ/ })
    expect(row).toHaveTextContent(`expired ${EXPIRATION}`)
    expect(within(row).getByRole('button', { name: /expired worthless/i })).toBeInTheDocument()
  })

  it('records expired-worthless via the ordinary Execution path', async () => {
    const { tradeBook, journal, priceBook, accountId } = await workspace()
    const { tradeId } = await seedExpiredCsp(tradeBook, accountId)

    renderPage(tradeBook, journal, priceBook)
    await startReview()

    const row = await screen.findByRole('listitem', { name: /1 XYZ/ })
    await userEvent.click(within(row).getByRole('button', { name: /expired worthless/i }))

    // Gone from the agenda — the leg is flat, no outcome left to record.
    await waitFor(() =>
      expect(screen.queryByRole('listitem', { name: /1 XYZ/ })).not.toBeInTheDocument(),
    )
    const record = await tradeBook.get(tradeId)
    const execs = record.legs[0].executions
    expect(execs[execs.length - 1]).toMatchObject({ side: 'buy', qty: 1, price: 0, kind: 'expire' })
  })

  it('flows into Close Reason when the Trade goes flat', async () => {
    const { tradeBook, journal, priceBook, accountId } = await workspace()
    await seedExpiredCsp(tradeBook, accountId)

    renderPage(tradeBook, journal, priceBook)
    await startReview()

    const row = await screen.findByRole('listitem', { name: /1 XYZ/ })
    await userEvent.click(within(row).getByRole('button', { name: /expired worthless/i }))

    await expect(screen.findByLabelText(/close reason/i)).resolves.toBeInTheDocument()
  })

  // The in-the-money choices (S3.4): assigned for a short leg, exercised for a
  // long leg, alongside "expired worthless" — the trader knows which happened;
  // the agenda can't (expiredHoldings consults no Marks).
  describe('AssignmentFlow', () => {
    it('offers assigned/exercised for an ITM expired leg', async () => {
      const { tradeBook, journal, priceBook, accountId } = await workspace()
      await seedExpiredCsp(tradeBook, accountId) // a short put

      renderPage(tradeBook, journal, priceBook)
      await startReview()

      const row = await screen.findByRole('listitem', { name: /1 XYZ/ })
      expect(within(row).getByRole('button', { name: /expired worthless/i })).toBeInTheDocument()
      expect(within(row).getByRole('button', { name: /^assigned$/i })).toBeInTheDocument()
      expect(within(row).queryByRole('button', { name: /^exercised$/i })).not.toBeInTheDocument()
    })

    it('shows the stock Leg on the Trade after recording', async () => {
      const { tradeBook, journal, priceBook, accountId } = await workspace()
      const { tradeId } = await seedExpiredCsp(tradeBook, accountId)

      renderPage(tradeBook, journal, priceBook)
      await startReview()

      const row = await screen.findByRole('listitem', { name: /1 XYZ/ })
      await userEvent.click(within(row).getByRole('button', { name: /^assigned$/i }))

      await waitFor(async () => {
        const record = await tradeBook.get(tradeId)
        expect(record.legs).toHaveLength(2)
      })
      const record = await tradeBook.get(tradeId)
      expect(record.legs[1].instrument).toEqual({ kind: 'stock', ticker: 'XYZ' })
    })

    it('keeps the Trade in the open-Trades walk (still holding)', async () => {
      const { tradeBook, journal, priceBook, accountId } = await workspace()
      const { tradeId } = await seedExpiredCsp(tradeBook, accountId)

      renderPage(tradeBook, journal, priceBook)
      await startReview()

      const row = await screen.findByRole('listitem', { name: /1 XYZ/ })
      await userEvent.click(within(row).getByRole('button', { name: /^assigned$/i }))

      // Assignment leaves the Trade holding the stock — never flat, so no Close
      // Reason prompt, and the Trade stays in the open query.
      expect(screen.queryByLabelText(/close reason/i)).not.toBeInTheDocument()
      await waitFor(async () => {
        const open = await tradeBook.query({ status: 'open' })
        expect(open.map((t) => t.id)).toContain(tradeId)
      })
    })
  })
})

// S4.4.T2: the review collection screen tells the trader plainly when no
// pricing source is enabled, rather than silently routing everything to
// manual entry (docs/plan/slice-04-automated-pricing.md).
describe('ReviewCollection (no source)', () => {
  it('shows a set-up-a-source notice when no pricing source is enabled', async () => {
    const { tradeBook, journal, priceBook } = await workspace()
    const ws = new Workspace(tradeBook, journal)

    renderPage(tradeBook, journal, priceBook, ws)

    expect(await screen.findByLabelText('no source notice')).toBeInTheDocument()
  })

  it('shows no notice when a source is enabled', async () => {
    const { tradeBook, journal, priceBook } = await workspace()
    const ws = new Workspace(tradeBook, journal)
    await ws.settings.set('pricingSources', [{ id: 'test-source', enabled: true }])

    renderPage(tradeBook, journal, priceBook, ws)

    await screen.findByRole('button', { name: /start review/i })
    expect(screen.queryByLabelText('no source notice')).not.toBeInTheDocument()
  })
})

// The agenda's post-fetch state renders the FetchReport (docs/design/pricebook.md):
// stored Marks as pre-filled rows for an eyeball check, errors with their reason
// attached to the instrument, and unsupported instruments flow to the ordinary
// missing-Marks rows the walk prompts for — the same one collection path, just
// with real fetch results this time.
describe('ReviewCollection (fetched)', () => {
  // An earlier describe leaves real timers behind; these expectations count
  // calendar days back from today and need the pinned Thursday.
  beforeEach(pinToday)

  it('shows fetched closes as pre-filled rows per Trade', async () => {
    const source = stubSource({
      id: 'test-source',
      supports: () => true,
      observations: [3, 2, 1, 0].map((d) => ({
        instrument: 'AAPL',
        date: daysAgo(d),
        close: 16000,
      })),
    })
    const { tradeBook, journal, priceBook, accountId } = await workspace([source])
    await openTrade(tradeBook, accountId, 'AAPL')

    renderPage(tradeBook, journal, priceBook)
    await startReview()

    const aapl = await screen.findByRole('listitem', { name: 'AAPL' })
    const fetched = within(aapl).getByRole('list', { name: 'fetched' })
    expect(within(fetched).getAllByRole('listitem')).toHaveLength(4)
    expect(within(fetched).getByRole('listitem', { name: `AAPL ${todayISO()}` })).toHaveTextContent(
      '160.00',
    )
    // The fetch satisfied every date — nothing is left to type manually.
    expect(within(aapl).getByRole('list', { name: 'missing' }).children).toHaveLength(0)
  })

  it('shows a manual Mark the fetch skipped as already done', async () => {
    const source = stubSource({
      id: 'test-source',
      supports: () => true,
      observations: [3, 2, 1, 0].map((d) => ({
        instrument: 'AAPL',
        date: daysAgo(d),
        close: 16000,
      })),
    })
    const { tradeBook, journal, priceBook, accountId } = await workspace([source])
    await openTrade(tradeBook, accountId, 'AAPL')
    // The trader already typed yesterday's close by hand, before the fetch ran —
    // the sticky manual Mark the fetch must never silently overwrite.
    await priceBook.record('AAPL', daysAgo(1), 15800, 'manual')

    renderPage(tradeBook, journal, priceBook)
    await startReview()

    const aapl = await screen.findByRole('listitem', { name: 'AAPL' })
    const alreadyDone = within(aapl).getByRole('list', { name: 'already done' })
    expect(
      within(alreadyDone).getByRole('listitem', { name: 'AAPL kept manual' }),
    ).toBeInTheDocument()
    // The other three dates still arrive as fetched, pre-filled rows.
    const fetched = within(aapl).getByRole('list', { name: 'fetched' })
    expect(within(fetched).getAllByRole('listitem')).toHaveLength(3)
    expect(within(fetched).queryByRole('listitem', { name: `AAPL ${daysAgo(1)}` })).toBeNull()
    // Nothing left to type manually.
    expect(within(aapl).getByRole('list', { name: 'missing' }).children).toHaveLength(0)
    // The manual Mark itself is untouched.
    const marks = await priceBook.markSet(['AAPL'], daysAgo(1))
    expect(marks.get('AAPL')).toEqual({
      instrument: 'AAPL',
      date: daysAgo(1),
      price: 15800,
      origin: 'manual',
    })
  })

  it('shows error reasons attached to their instruments', async () => {
    const source = stubSource({
      id: 'test-source',
      supports: () => true,
      error: new Error('API key expired'),
    })
    const { tradeBook, journal, priceBook, accountId } = await workspace([source])
    await openTrade(tradeBook, accountId, 'AAPL')

    renderPage(tradeBook, journal, priceBook)
    await startReview()

    const aapl = await screen.findByRole('listitem', { name: 'AAPL' })
    const errors = within(aapl).getByRole('list', { name: 'errors' })
    expect(within(errors).getByRole('listitem', { name: 'AAPL error' })).toHaveTextContent(
      'API key expired',
    )
  })

  it('sends unsupported instruments to the manual walk prompts', async () => {
    const source = stubSource({ id: 'test-source', supports: () => false })
    const { tradeBook, journal, priceBook, accountId } = await workspace([source])
    await openTrade(tradeBook, accountId, 'AAPL')

    renderPage(tradeBook, journal, priceBook)
    await startReview()

    const aapl = await screen.findByRole('listitem', { name: 'AAPL' })
    expect(within(aapl).queryByRole('list', { name: 'fetched' })).not.toBeInTheDocument()
    expect(
      within(within(aapl).getByRole('list', { name: 'missing' })).getAllByRole('listitem'),
    ).toHaveLength(4)
  })

  it('recovers a two-day gap silently when the source covers it', async () => {
    const source = stubSource({
      id: 'test-source',
      supports: () => true,
      observations: [1, 0].map((d) => ({ instrument: 'AAPL', date: daysAgo(d), close: 16000 })),
    })
    const { tradeBook, journal, priceBook, accountId } = await workspace([source])
    await openTrade(tradeBook, accountId, 'AAPL')
    // Marked two days ago, then the trader skipped a day: yesterday AND today owed Marks.
    await priceBook.record('AAPL', daysAgo(2), 16000, 'manual')

    renderPage(tradeBook, journal, priceBook)
    await startReview()

    const aapl = await screen.findByRole('listitem', { name: 'AAPL' })
    const fetched = within(aapl).getByRole('list', { name: 'fetched' })
    expect(within(fetched).getAllByRole('listitem')).toHaveLength(2)
    expect(within(aapl).getByRole('list', { name: 'missing' }).children).toHaveLength(0)
  })
})
