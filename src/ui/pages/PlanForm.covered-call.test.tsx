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

// PlanForm (covered call), S7.1.T2: the template pre-fills BOTH Planned Legs —
// buy 100 stock, sell 1 call — with the call's strike/expiration optional
// (TBD at plan time, completed by the fill, Slice 7).

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

describe('PlanForm (covered call)', () => {
  it('pre-fills both legs from the template', async () => {
    const { book, journal } = await seededBook()
    renderForm(book, journal)
    const user = userEvent.setup()
    await user.selectOptions(await screen.findByLabelText(/strategy/i), 'Covered Call')

    expect(screen.getAllByText(/buy stock/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/sell option/i).length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/quantity.*buy/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/quantity.*sell/i)).toBeInTheDocument()
  })

  it('renders a TBD leg as "strike TBD"', async () => {
    const { book, journal } = await seededBook()
    renderForm(book, journal)
    const user = userEvent.setup()
    await user.selectOptions(await screen.findByLabelText(/strategy/i), 'Covered Call')

    // The call leg's strike/expiration are left blank — TBD, displayed as such.
    expect(screen.getByText(/strike tbd/i)).toBeInTheDocument()
  })

  it('confirms with the call leg TBD, completed only by a later fill', async () => {
    const { book, journal } = await seededBook()
    const spy = vi.spyOn(book, 'confirmPlan')
    renderForm(book, journal)
    const user = userEvent.setup()
    await user.selectOptions(await screen.findByLabelText(/strategy/i), 'Covered Call')

    await user.type(screen.getByLabelText(/thesis/i), 'Sell premium against XYZ stock')
    await user.type(screen.getByLabelText(/ticker/i), 'XYZ')
    await user.type(screen.getByLabelText(/quantity.*buy/i), '100')
    await user.type(screen.getByLabelText(/quantity.*sell/i), '1')
    await user.type(screen.getByLabelText(/stop/i), '46')
    await user.type(screen.getByLabelText(/target/i), '55')
    await user.click(screen.getByRole('button', { name: /confirm plan/i }))

    expect(spy).toHaveBeenCalledTimes(1)
    const draft = spy.mock.calls[0][0]
    expect(draft.plannedLegs).toEqual([
      { side: 'buy', instrument: { kind: 'stock', ticker: 'XYZ' }, qty: 100 },
      { side: 'sell', instrument: { kind: 'option', ticker: 'XYZ', type: 'call' }, qty: 1 },
    ])
  })
})
