import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecordFillForm } from './RecordFillForm'
import { TradeBookContext } from '../tradeBookContext'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { Account, Institution, PlanDraft, TradeRecord } from '@/books/tradebook/types'
import { inMemoryTradeBook } from '../../../tests/support/trade-book'

// RecordFillForm (PMCC, S7.3): both Planned Legs are calls on the SAME
// ticker — the far leg concrete, the near leg TBD. Once the far leg is
// filled, the near Planned Leg's loose (ticker + type) match must NOT claim
// the far Leg it does not own (both are "AAPL call") — a genuine ambiguity
// the covered call's stock+call shape never exercised.

async function bookWithPmccPlan(): Promise<{ book: TradeBook; trade: TradeRecord }> {
  const book = inMemoryTradeBook()
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  const draft: PlanDraft = {
    accountId: account.id,
    thesis: 'PMCC on AAPL',
    strategyId: 'strategy-pmcc',
    ideaSourceId: '',
    plannedLegs: [
      {
        side: 'buy',
        instrument: {
          kind: 'option',
          ticker: 'AAPL',
          type: 'call',
          strike: 15000,
          expiration: '2028-01-21',
        },
        qty: 1,
      },
      { side: 'sell', instrument: { kind: 'option', ticker: 'AAPL', type: 'call' }, qty: 1 },
    ],
    exitLevels: [],
    plannedAt: '2026-07-10',
  }
  const id = await book.confirmPlan(draft)
  const trade = await book.get(id)
  return { book, trade }
}

function renderForm(
  book: TradeBook,
  trade: TradeRecord,
  position?: Parameters<typeof RecordFillForm>[0]['position'],
) {
  return render(
    <TradeBookContext.Provider value={book}>
      <RecordFillForm trade={trade} position={position} onRecorded={() => {}} />
    </TradeBookContext.Provider>,
  )
}

describe('RecordFillForm (PMCC)', () => {
  it('asks for the near leg TBD inputs once the far LEAP is already held, not the LEAP Leg', async () => {
    const { book, trade } = await bookWithPmccPlan()
    const filledTrade: TradeRecord = {
      ...trade,
      legs: [
        {
          id: 'leg-leap',
          instrument: {
            kind: 'option',
            ticker: 'AAPL',
            expiration: '2028-01-21',
            type: 'call',
            strike: 15000,
          },
          executions: [{ side: 'buy', qty: 1, price: 6200, fees: 65, timestamp: Date.now() }],
        },
      ],
    }
    const position = {
      holdings: [
        {
          instrument: {
            kind: 'option' as const,
            ticker: 'AAPL',
            expiration: '2028-01-21',
            type: 'call' as const,
            strike: 15000,
          },
          qty: 1,
          side: 'long' as const,
        },
      ],
    }
    renderForm(book, filledTrade, position)

    // Defaults to the near call — the still-unfilled Planned Leg — and asks
    // for its strike/expiration (TBD), never silently reusing the LEAP Leg.
    expect(screen.getByLabelText(/planned leg/i)).toHaveValue('1')
    expect(screen.getByLabelText(/expiration/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/strike/i)).toBeInTheDocument()
  })

  it('opens a NEW Leg for the near call fill, never targeting the LEAP Leg by id', async () => {
    const { book, trade } = await bookWithPmccPlan()
    const filledTrade: TradeRecord = {
      ...trade,
      legs: [
        {
          id: 'leg-leap',
          instrument: {
            kind: 'option',
            ticker: 'AAPL',
            expiration: '2028-01-21',
            type: 'call',
            strike: 15000,
          },
          executions: [{ side: 'buy', qty: 1, price: 6200, fees: 65, timestamp: Date.now() }],
        },
      ],
    }
    const position = {
      holdings: [
        {
          instrument: {
            kind: 'option' as const,
            ticker: 'AAPL',
            expiration: '2028-01-21',
            type: 'call' as const,
            strike: 15000,
          },
          qty: 1,
          side: 'long' as const,
        },
      ],
    }
    const spy = vi.spyOn(book, 'recordExecution')
    renderForm(book, filledTrade, position)
    const user = userEvent.setup()

    expect(screen.getByLabelText(/side/i)).toHaveValue('sell')
    await user.type(screen.getByLabelText(/expiration/i), '2026-09-18')
    await user.type(screen.getByLabelText(/strike/i), '220')
    await user.type(screen.getByLabelText(/quantity/i), '1')
    await user.type(screen.getByLabelText(/price/i), '3.00')
    await user.type(screen.getByLabelText(/fees/i), '0.65')
    await user.click(screen.getByRole('button', { name: /record fill/i }))

    expect(spy).toHaveBeenCalledTimes(1)
    const [target] = spy.mock.calls[0]
    expect(target).toEqual({ tradeId: trade.id, newLeg: 'AAPL 2026-09-18 C 220' })
  })
})
