import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { TradeDashboard } from './TradeDashboard'
import { TradeBookContext } from '../tradeBookContext'
import { PriceBookContext } from '../priceBookContext'
import { ValuationsContext } from '../valuationsContext'
import { Valuations } from '@/coordinators/valuations'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { PriceBook } from '@/books/pricebook/price-book'
import type { Account, ExecutionDraft, Institution, PlanDraft } from '@/books/tradebook/types'
import { inMemoryBooks } from '../../../tests/support/trade-book'

// TradeDashboard (spread), S7.2.T2: the bull-put-spread worked example
// (docs/plan/slice-07-multi-leg.md) — sell 1 XYZ 2026-08-21 P 100 @ 2.60 fees
// $0.65, buy 1 XYZ 2026-08-21 P 90 @ 0.60 fees $0.65, marks 1.10/0.20.

const SHORT_PUT = 'XYZ 2026-08-21 P 100'
const LONG_PUT = 'XYZ 2026-08-21 P 90'

const sellShortPut: ExecutionDraft = {
  side: 'sell',
  qty: 1,
  price: 260,
  fees: 65,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
}
const buyLongPut: ExecutionDraft = {
  side: 'buy',
  qty: 1,
  price: 60,
  fees: 65,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
}

async function seedSpread(tradeBook: TradeBook): Promise<string> {
  const institution = { id: '', name: 'Schwab' } as Institution
  await tradeBook.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await tradeBook.registries.accounts.save(account)
  const draft: PlanDraft = {
    accountId: account.id,
    thesis: 'XYZ range-bound, bullish bias',
    strategyId: 'strategy-bull-put-spread',
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
      {
        side: 'buy',
        instrument: {
          kind: 'option',
          ticker: 'XYZ',
          expiration: '2026-08-21',
          type: 'put',
          strike: 9000,
        },
        qty: 1,
      },
    ],
    exitLevels: [
      { scope: { level: 'trade' }, side: 'stop', kind: 'underlyingPrice', price: 9700 },
      { scope: { level: 'trade' }, side: 'target', kind: 'pctOfMaxProfit', pct: 75 },
    ],
    plannedAt: '2026-07-10',
  }
  const id = await tradeBook.confirmPlan(draft)
  await tradeBook.recordExecution({ tradeId: id, newLeg: SHORT_PUT }, sellShortPut)
  await tradeBook.recordExecution({ tradeId: id, newLeg: LONG_PUT }, buyLongPut)
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

describe('TradeDashboard (spread)', () => {
  it('shows net structure value and all four R/R numbers per the worked example', async () => {
    const { tradeBook, priceBook } = inMemoryBooks()
    const id = await seedSpread(tradeBook)
    await priceBook.record(SHORT_PUT, '2026-07-15', 110, 'manual')
    await priceBook.record(LONG_PUT, '2026-07-15', 20, 'manual')
    renderDashboard(tradeBook, priceBook, id)

    const pnl = await screen.findByLabelText('profit and loss')
    expect(pnl).toHaveTextContent(/-90\.00/) // net structure value
    expect(pnl).toHaveTextContent(/110\.00/) // unrealized
    expect(pnl).toHaveTextContent(/1\.30/) // fees
    expect(pnl).toHaveTextContent(/108\.70/) // total

    const rr = screen.getByLabelText('ongoing risk and reward')
    expect(within(rr).getByLabelText('planned risk')).toHaveTextContent(/210\.00/)
    expect(within(rr).getByLabelText('worst-case risk')).toHaveTextContent(/910\.00/)
    expect(within(rr).getByLabelText('planned reward')).toHaveTextContent(/40\.00/)
    expect(within(rr).getByLabelText('max reward')).toHaveTextContent(/90\.00/)
  })
})
