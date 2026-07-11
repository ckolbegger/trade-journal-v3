import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PlanForm } from './PlanForm'
import { TradeBookContext } from '../tradeBookContext'
import { JournalContext } from '../journalContext'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { Journal } from '@/books/journal/journal'
import type { Account, Institution } from '@/books/tradebook/types'
import { Workspace } from '@/workspace/workspace'
import { inMemoryBooks } from '../../../tests/support/trade-book'

async function seededBook(): Promise<{ book: TradeBook; journal: Journal }> {
  const { tradeBook: book, journal } = inMemoryBooks()
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  await book.registries.accounts.save({
    id: '',
    name: 'Taxable',
    institutionId: institution.id,
  } as Account)
  await new Workspace(book, journal).ensureSeeded()
  return { book, journal }
}

function renderForm(book: TradeBook, journal: Journal) {
  return render(
    <TradeBookContext.Provider value={book}>
      <JournalContext.Provider value={journal}>
        <MemoryRouter initialEntries={['/trades/new']}>
          <Routes>
            <Route path="/trades/new" element={<PlanForm />} />
            <Route path="/trades/:id" element={<div>detail page</div>} />
          </Routes>
        </MemoryRouter>
      </JournalContext.Provider>
    </TradeBookContext.Provider>,
  )
}

async function fillWorkedExample(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/thesis/i), 'AAPL breaks out')
  await user.type(screen.getByLabelText(/ticker/i), 'AAPL')
  await user.type(screen.getByLabelText(/quantity/i), '100')
  await user.type(screen.getByLabelText(/stop/i), '140')
  await user.type(screen.getByLabelText(/target/i), '170')
}

describe('PlanForm', () => {
  it('pre-fills a buy-stock Planned Leg from the Long Stock strategy', async () => {
    const { book, journal } = await seededBook()
    renderForm(book, journal)
    expect(await screen.findByText(/buy stock/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/ticker/i)).toBeInTheDocument()
  })

  it('blocks confirm until account, thesis, ticker, qty, stop, and target are set', async () => {
    const { book, journal } = await seededBook()
    renderForm(book, journal)
    const user = userEvent.setup()
    const confirm = await screen.findByRole('button', { name: /confirm plan/i })
    expect(confirm).toBeDisabled()
    await fillWorkedExample(user)
    expect(confirm).toBeEnabled()
  })

  it('adds a new Idea Source inline and selects it', async () => {
    const { book, journal } = await seededBook()
    renderForm(book, journal)
    const user = userEvent.setup()
    await screen.findByLabelText(/thesis/i)

    await user.type(screen.getByLabelText(/new idea source/i), 'Newsletter X')
    await user.click(screen.getByRole('button', { name: /add idea source/i }))

    const option = (await screen.findByRole('option', {
      name: 'Newsletter X',
    })) as HTMLOptionElement
    expect(option.selected).toBe(true)
    expect((await book.registries.ideaSources.list()).map((s) => s.name)).toEqual(['Newsletter X'])
  })

  it('calls TradeBook.confirmPlan with a well-formed PlanDraft', async () => {
    const { book, journal } = await seededBook()
    const spy = vi.spyOn(book, 'confirmPlan')
    renderForm(book, journal)
    const user = userEvent.setup()
    await screen.findByLabelText(/thesis/i)

    await user.type(screen.getByLabelText(/new idea source/i), 'Newsletter X')
    await user.click(screen.getByRole('button', { name: /add idea source/i }))
    await fillWorkedExample(user)
    await user.click(screen.getByRole('button', { name: /confirm plan/i }))

    expect(spy).toHaveBeenCalledTimes(1)
    const draft = spy.mock.calls[0][0]
    expect(draft.thesis).toBe('AAPL breaks out')
    expect(draft.plannedLegs).toEqual([
      { side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 },
    ])
    expect(draft.exitLevels).toEqual([
      { scope: { level: 'trade' }, side: 'stop', kind: 'underlyingPrice', price: 14000 },
      { scope: { level: 'trade' }, side: 'target', kind: 'underlyingPrice', price: 17000 },
    ])
    expect(draft.strategyId).toBe('strategy-long-stock')
  })
})
