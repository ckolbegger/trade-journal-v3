import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MarkEntry } from './MarkEntry'
import { TradeBookContext } from '../tradeBookContext'
import { PriceBookContext } from '../priceBookContext'
import { todayISO } from '../format'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { PriceBook } from '@/books/pricebook/price-book'
import type { Account, ExecutionDraft, Institution, PlanDraft } from '@/books/tradebook/types'
import { inMemoryBooks } from '../../../tests/support/trade-book'

const buy100: ExecutionDraft = {
  side: 'buy',
  qty: 100,
  price: 15000,
  fees: 100,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
}

async function planHoldingAAPL(book: TradeBook): Promise<string> {
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
  await book.recordExecution({ tradeId: id, newLeg: 'AAPL' }, buy100)
  return id
}

function renderMarkEntry(tradeBook: TradeBook, priceBook: PriceBook, onRecorded = () => {}) {
  return render(
    <TradeBookContext.Provider value={tradeBook}>
      <PriceBookContext.Provider value={priceBook}>
        <MarkEntry instrument="AAPL" onRecorded={onRecorded} />
      </PriceBookContext.Provider>
    </TradeBookContext.Provider>,
  )
}

describe('MarkEntry', () => {
  it("records a manual Mark for the Trade's instrument today", async () => {
    const { tradeBook, priceBook } = inMemoryBooks()
    await planHoldingAAPL(tradeBook)
    renderMarkEntry(tradeBook, priceBook)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/mark/i), '160')
    await user.click(screen.getByRole('button', { name: /save mark|record mark/i }))

    const marks = await priceBook.markSet(['AAPL'], todayISO())
    expect(marks.get('AAPL')?.price).toBe(16000)
  })

  it('warns before overwriting a Mark other Trades consumed, naming the count', async () => {
    const { tradeBook, priceBook } = inMemoryBooks()
    await planHoldingAAPL(tradeBook)
    await planHoldingAAPL(tradeBook) // a second Trade also holds AAPL
    await priceBook.record('AAPL', todayISO(), 16000, 'manual')
    renderMarkEntry(tradeBook, priceBook)
    const user = userEvent.setup()

    await user.clear(screen.getByLabelText(/mark/i))
    await user.type(screen.getByLabelText(/mark/i), '161')
    await user.click(screen.getByRole('button', { name: /save mark|record mark/i }))

    const warning = await screen.findByRole('alert')
    expect(warning).toHaveTextContent(/2 Trades/i)
    // not yet overwritten — awaiting confirmation
    const marks = await priceBook.markSet(['AAPL'], todayISO())
    expect(marks.get('AAPL')?.price).toBe(16000)
  })

  it('skips the warning when only this Trade holds the instrument', async () => {
    const { tradeBook, priceBook } = inMemoryBooks()
    await planHoldingAAPL(tradeBook)
    await priceBook.record('AAPL', todayISO(), 16000, 'manual')
    let recorded = false
    renderMarkEntry(tradeBook, priceBook, () => {
      recorded = true
    })
    const user = userEvent.setup()

    await user.clear(screen.getByLabelText(/mark/i))
    await user.type(screen.getByLabelText(/mark/i), '161')
    await user.click(screen.getByRole('button', { name: /save mark|record mark/i }))

    await waitFor(() => expect(recorded).toBe(true))
    expect(screen.queryByRole('alert')).toBeNull()
    const marks = await priceBook.markSet(['AAPL'], todayISO())
    expect(marks.get('AAPL')?.price).toBe(16100)
  })
})
