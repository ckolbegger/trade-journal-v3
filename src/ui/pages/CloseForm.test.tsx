import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CloseForm } from './CloseForm'
import { TradeBookContext } from '../tradeBookContext'
import { JournalContext } from '../journalContext'
import { Workspace } from '@/workspace/workspace'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { Journal } from '@/books/journal/journal'
import type { Account, Institution, PlanDraft } from '@/books/tradebook/types'
import { inMemoryBooks } from '../../../tests/support/trade-book'

async function flatTrade(): Promise<{ book: TradeBook; journal: Journal; id: string }> {
  const { tradeBook: book, journal } = inMemoryBooks()
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  await new Workspace(book, journal).ensureSeeded()
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
  const first = await book.recordExecution(
    { tradeId: id, newLeg: 'AAPL' },
    { side: 'buy', qty: 100, price: 15000, fees: 100, timestamp: Date.now() },
  )
  await book.recordExecution(
    { tradeId: id, legId: first.record.legs[0].id },
    { side: 'sell', qty: 100, price: 16800, fees: 100, timestamp: Date.now() },
  )
  return { book, journal, id }
}

function renderForm(
  book: TradeBook,
  journal: Journal,
  id: string,
  { onDone = () => {}, onDismiss = () => {} } = {},
) {
  return render(
    <TradeBookContext.Provider value={book}>
      <JournalContext.Provider value={journal}>
        <CloseForm tradeId={id} onDone={onDone} onDismiss={onDismiss} />
      </JournalContext.Provider>
    </TradeBookContext.Provider>,
  )
}

describe('CloseForm', () => {
  it('records the reason via setCloseReason', async () => {
    const { book, journal, id } = await flatTrade()
    const spy = vi.spyOn(book, 'setCloseReason')
    renderForm(book, journal, id)
    const user = userEvent.setup()

    await user.selectOptions(await screen.findByLabelText(/close reason/i), 'Hit Target')
    await user.click(screen.getByRole('button', { name: /record close/i }))

    expect(spy).toHaveBeenCalledTimes(1)
    const [tradeId, reason] = spy.mock.calls[0]
    expect(tradeId).toBe(id)
    expect(reason).toMatchObject({ name: 'Hit Target' })
  })

  it('writes a full close entry when recorded', async () => {
    const { book, journal, id } = await flatTrade()
    const spy = vi.spyOn(journal, 'write')
    renderForm(book, journal, id)
    const user = userEvent.setup()

    await user.selectOptions(await screen.findByLabelText(/close reason/i), 'Hit Target')
    await user.click(screen.getByRole('button', { name: /record close/i }))

    expect(spy).toHaveBeenCalledTimes(1)
    const [draft] = spy.mock.calls[0]
    expect(draft.anchor).toEqual({ kind: 'close', tradeId: id })
    expect(draft.placeholder).toBe(false)
  })

  it('writes a placeholder when the journal is skipped', async () => {
    const { book, journal, id } = await flatTrade()
    const setReason = vi.spyOn(book, 'setCloseReason')
    const write = vi.spyOn(journal, 'write')
    renderForm(book, journal, id)
    const user = userEvent.setup()

    await user.selectOptions(await screen.findByLabelText(/close reason/i), 'Hit Target')
    await user.click(screen.getByRole('button', { name: /skip journal/i }))

    expect(setReason).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledTimes(1)
    expect(write.mock.calls[0][0].placeholder).toBe(true)
  })

  it('requires a reason before it can record', async () => {
    const { book, journal, id } = await flatTrade()
    renderForm(book, journal, id)

    expect(await screen.findByRole('button', { name: /record close/i })).toBeDisabled()
  })
})
