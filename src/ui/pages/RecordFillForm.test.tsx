import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecordFillForm } from './RecordFillForm'
import { TradeBookContext } from '../tradeBookContext'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { Account, Institution, PlanDraft } from '@/books/tradebook/types'
import type { TradeRecord } from '@/books/tradebook/types'
import { inMemoryTradeBook } from '../../../tests/support/trade-book'

async function bookWithPlannedTrade(): Promise<{ book: TradeBook; trade: TradeRecord }> {
  const book = inMemoryTradeBook()
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
    exitLevels: [],
    plannedAt: '2026-07-10',
  }
  const id = await book.confirmPlan(draft)
  const trade = await book.get(id)
  return { book, trade }
}

function renderForm(book: TradeBook, trade: TradeRecord, onRecorded = () => {}) {
  return render(
    <TradeBookContext.Provider value={book}>
      <RecordFillForm trade={trade} onRecorded={onRecorded} />
    </TradeBookContext.Provider>,
  )
}

describe('RecordFillForm', () => {
  it('pre-fills instrument and side from the Planned Leg', async () => {
    const { book, trade } = await bookWithPlannedTrade()
    renderForm(book, trade)
    expect(await screen.findByText('AAPL')).toBeInTheDocument()
    expect(screen.getByLabelText(/side/i)).toHaveValue('buy')
  })

  it('submits a well-formed ExecutionDraft to TradeBook', async () => {
    const { book, trade } = await bookWithPlannedTrade()
    const spy = vi.spyOn(book, 'recordExecution')
    renderForm(book, trade)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/quantity/i), '100')
    await user.type(screen.getByLabelText(/price/i), '150')
    await user.type(screen.getByLabelText(/fees/i), '1')
    await user.click(screen.getByRole('button', { name: /record fill/i }))

    expect(spy).toHaveBeenCalledTimes(1)
    const [target, draft] = spy.mock.calls[0]
    expect(target).toEqual({ tradeId: trade.id, newLeg: 'AAPL' })
    expect(draft).toMatchObject({ side: 'buy', qty: 100, price: 15000, fees: 100 })
    expect(typeof draft.timestamp).toBe('number')
  })

  it('targets the currently held Leg when it differs from the Planned Leg (post-assignment)', async () => {
    const { book, trade } = await bookWithPlannedTrade()
    // Simulate the S3.4 assignment outcome: the Trade now holds a stock Leg the
    // original Plan never named, with the Planned Leg still reading its (now
    // flat) option.
    const assignedTrade: TradeRecord = {
      ...trade,
      legs: [{ id: 'leg-stock', instrument: { kind: 'stock', ticker: 'XYZ' }, executions: [] }],
    }
    const position = {
      holdings: [
        { instrument: { kind: 'stock' as const, ticker: 'XYZ' }, qty: 100, side: 'long' as const },
      ],
    }
    const spy = vi.spyOn(book, 'recordExecution').mockResolvedValue({
      record: assignedTrade,
      newDeviations: [],
      nowFlat: false,
    })
    render(
      <TradeBookContext.Provider value={book}>
        <RecordFillForm trade={assignedTrade} position={position} onRecorded={() => {}} />
      </TradeBookContext.Provider>,
    )
    const user = userEvent.setup()

    expect(await screen.findByText('XYZ')).toBeInTheDocument()

    await user.click(screen.getByLabelText(/side/i))
    await user.selectOptions(screen.getByLabelText(/side/i), 'sell')
    await user.type(screen.getByLabelText(/quantity/i), '100')
    await user.type(screen.getByLabelText(/price/i), '99')
    await user.click(screen.getByRole('button', { name: /record fill/i }))

    expect(spy).toHaveBeenCalledTimes(1)
    const [target] = spy.mock.calls[0]
    expect(target).toEqual({ tradeId: trade.id, legId: 'leg-stock' })
  })

  it('shows validation errors inline (qty, price)', async () => {
    const { book, trade } = await bookWithPlannedTrade()
    const spy = vi.spyOn(book, 'recordExecution')
    renderForm(book, trade)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/quantity/i), '0')
    await user.click(screen.getByRole('button', { name: /record fill/i }))

    expect(screen.getByText(/quantity must be a positive whole number/i)).toBeInTheDocument()
    expect(screen.getByText(/price is required/i)).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
  })
})
