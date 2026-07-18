import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecordFillForm } from './RecordFillForm'
import { TradeBookContext } from '../tradeBookContext'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { Account, Institution, PlanDraft, TradeRecord } from '@/books/tradebook/types'
import { inMemoryTradeBook } from '../../../tests/support/trade-book'

// RecordFillForm (multi-leg / legging in, S7.1.T2): a covered call's Plan
// names two Planned Legs up front (stock, then a TBD call). The trader picks
// which Planned Leg a fill is for; a TBD option leg asks for its
// strike/expiration at fill time — completing reality, never the Plan.

async function bookWithCoveredCallPlan(): Promise<{ book: TradeBook; trade: TradeRecord }> {
  const book = inMemoryTradeBook()
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  const draft: PlanDraft = {
    accountId: account.id,
    thesis: 'Sell premium against XYZ stock',
    strategyId: 'strategy-covered-call',
    ideaSourceId: '',
    plannedLegs: [
      { side: 'buy', instrument: { kind: 'stock', ticker: 'XYZ' }, qty: 100 },
      { side: 'sell', instrument: { kind: 'option', ticker: 'XYZ', type: 'call' }, qty: 1 },
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

describe('RecordFillForm (multi-leg)', () => {
  it('defaults to the unfilled call leg once the stock is already held', async () => {
    const { book, trade } = await bookWithCoveredCallPlan()
    const filledTrade: TradeRecord = {
      ...trade,
      legs: [
        {
          id: 'leg-stock',
          instrument: { kind: 'stock', ticker: 'XYZ' },
          executions: [{ side: 'buy', qty: 100, price: 5000, fees: 100, timestamp: Date.now() }],
        },
      ],
    }
    const position = {
      holdings: [
        { instrument: { kind: 'stock' as const, ticker: 'XYZ' }, qty: 100, side: 'long' as const },
      ],
    }
    renderForm(book, filledTrade, position)

    // The picker defaults to the call — the still-unfilled Planned Leg — and
    // asks for its strike/expiration since the Plan left them TBD.
    expect(screen.getByLabelText(/planned leg/i)).toHaveValue('1')
    expect(screen.getByLabelText(/expiration/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/strike/i)).toBeInTheDocument()
  })

  it('attaches the call fill as a new Leg once expiration and strike are supplied', async () => {
    const { book, trade } = await bookWithCoveredCallPlan()
    const filledTrade: TradeRecord = {
      ...trade,
      legs: [
        {
          id: 'leg-stock',
          instrument: { kind: 'stock', ticker: 'XYZ' },
          executions: [{ side: 'buy', qty: 100, price: 5000, fees: 100, timestamp: Date.now() }],
        },
      ],
    }
    const position = {
      holdings: [
        { instrument: { kind: 'stock' as const, ticker: 'XYZ' }, qty: 100, side: 'long' as const },
      ],
    }
    const spy = vi.spyOn(book, 'recordExecution')
    renderForm(book, filledTrade, position)
    const user = userEvent.setup()

    expect(screen.getByLabelText(/side/i)).toHaveValue('sell')
    await user.type(screen.getByLabelText(/expiration/i), '2026-09-18')
    await user.type(screen.getByLabelText(/strike/i), '55')
    await user.type(screen.getByLabelText(/quantity/i), '1')
    await user.type(screen.getByLabelText(/price/i), '1.50')
    await user.type(screen.getByLabelText(/fees/i), '0.65')
    await user.click(screen.getByRole('button', { name: /record fill/i }))

    expect(spy).toHaveBeenCalledTimes(1)
    const [target, execDraft] = spy.mock.calls[0]
    expect(target).toEqual({ tradeId: trade.id, newLeg: 'XYZ 2026-09-18 C 55' })
    expect(execDraft).toMatchObject({ side: 'sell', qty: 1, price: 150, fees: 65 })
  })

  it('defaults to the stock leg on the first fill (nothing held yet)', async () => {
    const { book, trade } = await bookWithCoveredCallPlan()
    renderForm(book, trade, undefined)
    expect(screen.getByLabelText(/planned leg/i)).toHaveValue('0')
    expect(screen.getByText('XYZ')).toBeInTheDocument()
    expect(screen.getByLabelText(/side/i)).toHaveValue('buy')
  })

  // Holding.legId guard rail: once the call Leg already exists (both Planned
  // Legs filled), picking it again targets that SAME Leg by id — never
  // `newLeg`, which would silently fork a second Leg for the same contract.
  it('targets the existing call Leg by id on a second fill, not newLeg', async () => {
    const { book, trade } = await bookWithCoveredCallPlan()
    const bothFilled: TradeRecord = {
      ...trade,
      legs: [
        {
          id: 'leg-stock',
          instrument: { kind: 'stock', ticker: 'XYZ' },
          executions: [{ side: 'buy', qty: 100, price: 5000, fees: 100, timestamp: Date.now() }],
        },
        {
          id: 'leg-call',
          instrument: {
            kind: 'option',
            ticker: 'XYZ',
            expiration: '2026-09-18',
            type: 'call',
            strike: 5500,
          },
          executions: [{ side: 'sell', qty: 1, price: 150, fees: 65, timestamp: Date.now() }],
        },
      ],
    }
    const spy = vi.spyOn(book, 'recordExecution')
    renderForm(book, bothFilled)
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText(/planned leg/i), '1')
    await user.type(screen.getByLabelText(/quantity/i), '1')
    await user.type(screen.getByLabelText(/price/i), '1.20')
    await user.click(screen.getByRole('button', { name: /record fill/i }))

    expect(spy).toHaveBeenCalledTimes(1)
    const [target] = spy.mock.calls[0]
    expect(target).toEqual({ tradeId: trade.id, legId: 'leg-call' })
  })
})
