import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { TradeDashboard } from './TradeDashboard'
import { TradeBookContext } from '../tradeBookContext'
import { PriceBookContext } from '../priceBookContext'
import { ValuationsContext } from '../valuationsContext'
import { Valuations } from '@/coordinators/valuations'
import { todayISO } from '../format'
import type { TradeBook } from '@/books/tradebook/trade-book'
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
})
