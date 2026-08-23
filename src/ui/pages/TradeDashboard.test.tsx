import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TradeDashboard } from './TradeDashboard'
import { TradeBookContext } from '../tradeBookContext'
import { PriceBookContext } from '../priceBookContext'
import { ValuationsContext } from '../valuationsContext'
import { WorkspaceContext } from '../workspaceContext'
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
const buy100: ExecutionDraft = {
  side: 'buy',
  qty: 100,
  price: 15000,
  fees: 100,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
}

async function seed(book: TradeBook, exitLevels: ExitLevel[]): Promise<string> {
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  const draft: PlanDraft = {
    accountId: account.id,
    thesis: 'AAPL breaks out',
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 }],
    exitLevels,
    plannedAt: '2026-07-10',
  }
  const id = await book.confirmPlan(draft)
  await book.recordExecution({ tradeId: id, newLeg: 'AAPL' }, buy100)
  return id
}

// An assigned CSP: the option Leg closes flat and a stock Leg opens in the
// same Trade (S3.4) — the sibling fixture to RecordFillForm's post-assignment
// test. `exitLevels` lets a caller exercise the "at intrinsic" label.
async function seedAssignedCsp(
  tradeBook: TradeBook,
  exitLevels: ExitLevel[] = [],
): Promise<string> {
  const institution = { id: '', name: 'Schwab' } as Institution
  await tradeBook.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await tradeBook.registries.accounts.save(account)
  const id = await tradeBook.confirmPlan({
    accountId: account.id,
    thesis: 'XYZ range-bound',
    strategyId: 'strategy-cash-secured-put',
    ideaSourceId: '',
    plannedLegs: [
      {
        side: 'sell',
        instrument: {
          kind: 'option',
          ticker: 'XYZ',
          expiration: '2026-08-21',
          type: 'put',
          strike: 10000,
        },
        qty: 1,
      },
    ],
    exitLevels,
    plannedAt: '2026-07-10',
  })
  const opened = await tradeBook.recordExecution(
    { tradeId: id, newLeg: 'XYZ 2026-08-21 P 100' },
    {
      side: 'sell',
      qty: 1,
      price: 250,
      fees: 65,
      timestamp: new Date('2026-07-10T12:00:00').getTime(),
    },
  )
  await tradeBook.recordExecution(
    { tradeId: id, legId: opened.record.legs[0].id },
    {
      side: 'buy',
      qty: 1,
      price: 0,
      fees: 0,
      kind: 'assign',
      timestamp: new Date('2026-08-21T16:00:00').getTime(),
    },
  )
  return id
}

function renderDashboard(tradeBook: TradeBook, priceBook: PriceBook, id: string) {
  return render(
    <TradeBookContext.Provider value={tradeBook}>
      <PriceBookContext.Provider value={priceBook}>
        <ValuationsContext.Provider value={new Valuations(tradeBook, priceBook)}>
          <TradeDashboard tradeId={id} />
        </ValuationsContext.Provider>
      </PriceBookContext.Provider>
    </TradeBookContext.Provider>,
  )
}

function renderDashboardWithWorkspace(
  tradeBook: TradeBook,
  journal: Journal,
  priceBook: PriceBook,
  id: string,
) {
  return render(
    <TradeBookContext.Provider value={tradeBook}>
      <PriceBookContext.Provider value={priceBook}>
        <ValuationsContext.Provider value={new Valuations(tradeBook, priceBook)}>
          <WorkspaceContext.Provider value={new Workspace(tradeBook, journal)}>
            <TradeDashboard tradeId={id} />
          </WorkspaceContext.Provider>
        </ValuationsContext.Provider>
      </PriceBookContext.Provider>
    </TradeBookContext.Provider>,
  )
}

// A single-Leg long call — the independently-computed Black-Scholes worked
// case (domain/trademath/implied-vol.test.ts): AAPL 2027-01-01 C 200, contract
// Mark 23.67, underlying 200.00, r=0.04 → IV ~0.25 (25%).
async function seedLongCall(tradeBook: TradeBook): Promise<string> {
  const institution = { id: '', name: 'Schwab' } as Institution
  await tradeBook.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await tradeBook.registries.accounts.save(account)
  const id = await tradeBook.confirmPlan({
    accountId: account.id,
    thesis: 'AAPL breaks out',
    strategyId: 'strategy-long-call',
    ideaSourceId: '',
    plannedLegs: [
      {
        side: 'buy',
        instrument: {
          kind: 'option',
          ticker: 'AAPL',
          expiration: '2027-01-01',
          type: 'call',
          strike: 20000,
        },
        qty: 1,
      },
    ],
    exitLevels: [],
    plannedAt: '2026-01-01',
  })
  await tradeBook.recordExecution(
    { tradeId: id, newLeg: 'AAPL 2027-01-01 C 200' },
    {
      side: 'buy',
      qty: 1,
      price: 2367,
      fees: 0,
      timestamp: new Date('2026-01-01T12:00:00').getTime(),
    },
  )
  return id
}

describe('TradeDashboard', () => {
  it('renders P&L and all four R/R numbers from Valuations.detail', async () => {
    const { tradeBook, priceBook } = inMemoryBooks()
    const id = await seed(tradeBook, [stop, target])
    await priceBook.record('AAPL', todayISO(), 16000, 'manual')
    renderDashboard(tradeBook, priceBook, id)

    const pnl = await screen.findByLabelText('profit and loss')
    expect(pnl).toHaveTextContent(/16000\.00/) // current value
    expect(pnl).toHaveTextContent(/1000\.00/) // unrealized
    expect(pnl).toHaveTextContent(/999\.00/) // total
    expect(pnl).toHaveTextContent(/1\.00/) // fees

    const rr = screen.getByLabelText('ongoing risk and reward')
    expect(within(rr).getByLabelText('planned risk')).toHaveTextContent(/2000\.00/)
    expect(within(rr).getByLabelText('worst-case risk')).toHaveTextContent(/16000\.00/)
    expect(within(rr).getByLabelText('planned reward')).toHaveTextContent(/1000\.00/)
    expect(within(rr).getByLabelText('max reward')).toHaveTextContent(/unlimited/i)
  })

  it("renders 'unlimited' and 'undefined' anchors as words, not numbers", async () => {
    const { tradeBook, priceBook } = inMemoryBooks()
    const id = await seed(tradeBook, [target]) // target only — no stop
    await priceBook.record('AAPL', todayISO(), 16000, 'manual')
    renderDashboard(tradeBook, priceBook, id)

    const rr = await screen.findByLabelText('ongoing risk and reward')
    expect(within(rr).getByLabelText('planned risk')).toHaveTextContent(/undefined/i)
    expect(within(rr).getByLabelText('max reward')).toHaveTextContent(/unlimited/i)
  })

  it('shows the original plan risk/reward alongside ongoing', async () => {
    const { tradeBook, priceBook } = inMemoryBooks()
    const id = await seed(tradeBook, [stop, target])
    await priceBook.record('AAPL', todayISO(), 16000, 'manual')
    renderDashboard(tradeBook, priceBook, id)

    const original = await screen.findByLabelText('original plan risk and reward')
    expect(within(original).getByLabelText('original risk')).toHaveTextContent(/1000\.00/)
    expect(within(original).getByLabelText('original reward')).toHaveTextContent(/2000\.00/)
  })

  it('prompts for a Mark when none exists instead of showing numbers', async () => {
    const { tradeBook, priceBook } = inMemoryBooks()
    const id = await seed(tradeBook, [stop, target]) // no Mark recorded
    renderDashboard(tradeBook, priceBook, id)

    expect(await screen.findByLabelText(/mark/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('profit and loss')).toBeNull()
    expect(screen.queryByLabelText('ongoing risk and reward')).toBeNull()
  })

  // S3.4: after assignment/exercise the Trade holds two Legs (option + paired
  // stock) — the dashboard shows both, per-Leg, alongside the Trade totals.
  it('shows per-Leg P&L once the Trade holds more than one Leg (assignment)', async () => {
    const { tradeBook, priceBook } = inMemoryBooks()
    const institution = { id: '', name: 'Schwab' } as Institution
    await tradeBook.registries.institutions.save(institution)
    const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
    await tradeBook.registries.accounts.save(account)
    const id = await tradeBook.confirmPlan({
      accountId: account.id,
      thesis: 'XYZ range-bound',
      strategyId: 'strategy-cash-secured-put',
      ideaSourceId: '',
      plannedLegs: [
        {
          side: 'sell',
          instrument: {
            kind: 'option',
            ticker: 'XYZ',
            expiration: '2026-08-21',
            type: 'put',
            strike: 10000,
          },
          qty: 1,
        },
      ],
      exitLevels: [],
      plannedAt: '2026-07-10',
    })
    const opened = await tradeBook.recordExecution(
      { tradeId: id, newLeg: 'XYZ 2026-08-21 P 100' },
      {
        side: 'sell',
        qty: 1,
        price: 250,
        fees: 65,
        timestamp: new Date('2026-07-10T12:00:00').getTime(),
      },
    )
    await tradeBook.recordExecution(
      { tradeId: id, legId: opened.record.legs[0].id },
      {
        side: 'buy',
        qty: 1,
        price: 0,
        fees: 0,
        kind: 'assign',
        timestamp: new Date('2026-08-21T16:00:00').getTime(),
      },
    )
    await priceBook.record('XYZ', todayISO(), 9700, 'manual')

    renderDashboard(tradeBook, priceBook, id)

    const perLeg = await screen.findByLabelText('per-leg profit and loss')
    expect(perLeg).toHaveTextContent(/XYZ Aug'26 100P/)
    expect(perLeg).toHaveTextContent('XYZ')
    expect(perLeg).toHaveTextContent(/-300\.00/) // stock unrealized
  })

  // Sibling bug to the one RecordFillForm had (T5 browser verification found
  // it): the option Leg is now flat, so the Mark prompt — and every later
  // "record another Mark" form — must target the HELD stock Leg, or the
  // valuation can never be satisfied from the detail page.
  it('targets the held stock Leg for the Mark prompt once the option Leg is flat (assigned)', async () => {
    const { tradeBook, priceBook } = inMemoryBooks()
    const id = await seedAssignedCsp(tradeBook)
    renderDashboard(tradeBook, priceBook, id)

    await expect(screen.findByText(/enter today's price/i)).resolves.toBeInTheDocument()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/mark/i), '97')
    await user.click(screen.getByRole('button', { name: /save mark/i }))

    // Recording against the right instrument clears the missing-marks state.
    await expect(screen.findByLabelText('profit and loss')).resolves.toBeInTheDocument()
    const recorded = await priceBook.markSet(['XYZ'], todayISO())
    expect(recorded.get('XYZ')?.price).toBe(9700)
    // Never recorded against the dead option contract.
    const contractMark = await priceBook.markSet(['XYZ 2026-08-21 P 100'], todayISO())
    expect(contractMark.has('XYZ 2026-08-21 P 100')).toBe(false)
  })

  // The "at intrinsic" label must follow what risk-reward.ts actually computes
  // from (the currently HELD Leg), not the original Plan's instrument — once
  // assignment replaces the held option with stock, the same underlyingPrice
  // Exit Level resolves to a plain price (priceAtLevel, risk-reward.ts), so the
  // label must drop "(at intrinsic)".
  it('drops the "at intrinsic" label once the held Leg is stock, not option (assigned)', async () => {
    const { tradeBook, priceBook } = inMemoryBooks()
    const id = await seedAssignedCsp(tradeBook, [
      { scope: { level: 'trade' }, side: 'stop', kind: 'underlyingPrice', price: 9500 },
    ])
    await priceBook.record('XYZ', todayISO(), 9700, 'manual')
    renderDashboard(tradeBook, priceBook, id)

    const rr = await screen.findByLabelText('ongoing risk and reward')
    expect(within(rr).getByText('Planned risk')).toBeInTheDocument()
    expect(within(rr).queryByText(/at intrinsic/i)).not.toBeInTheDocument()
  })

  // S1.8: MarkEntry's currentPrice prop pre-fills "Today's mark" from the
  // Valuation snapshot's own MarkSet — no separate PriceBook round trip, no
  // re-typing a value already on file.
  it("pre-fills the field with the existing Mark's price when one exists", async () => {
    const { tradeBook, priceBook } = inMemoryBooks()
    const id = await seed(tradeBook, [stop, target])
    await priceBook.record('AAPL', todayISO(), 16000, 'manual')
    renderDashboard(tradeBook, priceBook, id)

    const field = await screen.findByLabelText(/today's mark/i)
    expect(field).toHaveValue('160.00')
  })

  it('still opens blank when no Mark exists yet for the instrument', async () => {
    const { tradeBook, priceBook } = inMemoryBooks()
    const id = await seed(tradeBook, [stop, target]) // no Mark recorded

    renderDashboard(tradeBook, priceBook, id)

    const field = await screen.findByLabelText(/today's mark/i)
    expect(field).toHaveValue('')
  })
})

describe('IV display', () => {
  it('shows IV for a marked option Leg with a marked underlying', async () => {
    const { tradeBook, journal, priceBook } = inMemoryBooks()
    const id = await seedLongCall(tradeBook)
    await priceBook.record('AAPL 2027-01-01 C 200', '2026-01-01', 2367, 'manual')
    await priceBook.record('AAPL', '2026-01-01', 20000, 'manual')

    renderDashboardWithWorkspace(tradeBook, journal, priceBook, id)

    const marks = await screen.findByLabelText('option marks')
    expect(marks).toHaveTextContent('23.67')
    expect(marks).toHaveTextContent(/IV 25%/)
  })

  it('shows the contract Mark with no IV when the underlying is unmarked', async () => {
    const { tradeBook, journal, priceBook } = inMemoryBooks()
    const id = await seedLongCall(tradeBook)
    await priceBook.record('AAPL 2027-01-01 C 200', '2026-01-01', 2367, 'manual')

    renderDashboardWithWorkspace(tradeBook, journal, priceBook, id)

    const marks = await screen.findByLabelText('option marks')
    expect(marks).toHaveTextContent('23.67')
    expect(marks).not.toHaveTextContent(/IV/)
  })

  it('updates when the risk-free-rate setting changes', async () => {
    const { tradeBook, journal, priceBook } = inMemoryBooks()
    const id = await seedLongCall(tradeBook)
    await priceBook.record('AAPL 2027-01-01 C 200', '2026-01-01', 2367, 'manual')
    await priceBook.record('AAPL', '2026-01-01', 20000, 'manual')
    const workspace = new Workspace(tradeBook, journal)
    await workspace.settings.set('riskFreeRate', 0.1)

    render(
      <TradeBookContext.Provider value={tradeBook}>
        <PriceBookContext.Provider value={priceBook}>
          <ValuationsContext.Provider value={new Valuations(tradeBook, priceBook)}>
            <WorkspaceContext.Provider value={workspace}>
              <TradeDashboard tradeId={id} />
            </WorkspaceContext.Provider>
          </ValuationsContext.Provider>
        </PriceBookContext.Provider>
      </TradeBookContext.Provider>,
    )

    const marks = await screen.findByLabelText('option marks')
    // A higher risk-free rate raises the discounted-forward value the same
    // Mark implies, so a lower vol reproduces it — the recovered IV drops
    // below the 0.04-rate case's 25%.
    expect(marks).not.toHaveTextContent(/IV 25%/)
  })
})
