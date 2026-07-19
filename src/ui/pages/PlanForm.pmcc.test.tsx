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

// PlanForm (PMCC), S7.3.T3: the far call leg is concrete (its own expiration
// required up front); the near call leg's strike/expiration stay TBD — a
// generalization of the spread's LINKED expiration input, since PMCC's two
// option legs do NOT share one expiration (per-leg, per `tbdAllowed`).

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

describe('PlanForm (PMCC)', () => {
  it('asks for the far leg expiration and leaves the near leg TBD', async () => {
    const { book, journal } = await seededBook()
    renderForm(book, journal)
    const user = userEvent.setup()
    await user.selectOptions(await screen.findByLabelText(/strategy/i), 'PMCC')

    // TWO expiration inputs: one required (the far leg), one optional (near).
    const expirationInputs = screen.getAllByLabelText(/expiration/i)
    expect(expirationInputs).toHaveLength(2)
    expect(screen.getByText(/strike tbd/i)).toBeInTheDocument()
    expect(screen.getByText(/expiration tbd/i)).toBeInTheDocument()
  })

  it('confirms with the far leg concrete and the near leg fully TBD', async () => {
    const { book, journal } = await seededBook()
    const spy = vi.spyOn(book, 'confirmPlan')
    renderForm(book, journal)
    const user = userEvent.setup()
    await user.selectOptions(await screen.findByLabelText(/strategy/i), 'PMCC')

    await user.type(screen.getByLabelText(/thesis/i), 'PMCC on AAPL')
    await user.type(screen.getByLabelText(/ticker/i), 'AAPL')

    const expirationInputs = screen.getAllByLabelText(/expiration/i)
    await user.type(expirationInputs[0], '2028-01-21')
    const strikeInputs = screen.getAllByLabelText(/strike/i)
    await user.type(strikeInputs[0], '150')

    await user.type(screen.getByLabelText(/quantity.*buy/i), '1')
    await user.type(screen.getByLabelText(/quantity.*sell/i), '1')
    await user.type(screen.getByLabelText(/stop/i), '55.00')
    await user.type(screen.getByLabelText(/target/i), '68.00')
    await user.click(screen.getByRole('button', { name: /confirm plan/i }))

    expect(spy).toHaveBeenCalledTimes(1)
    const draft = spy.mock.calls[0][0]
    expect(draft.plannedLegs).toEqual([
      {
        side: 'buy',
        instrument: {
          kind: 'option',
          ticker: 'AAPL',
          type: 'call',
          expiration: '2028-01-21',
          strike: 15000,
        },
        qty: 1,
      },
      { side: 'sell', instrument: { kind: 'option', ticker: 'AAPL', type: 'call' }, qty: 1 },
    ])
    expect(draft.exitLevels).toEqual([
      { scope: { level: 'trade' }, side: 'stop', kind: 'structureValue', value: 5500 },
      { scope: { level: 'trade' }, side: 'target', kind: 'structureValue', value: 6800 },
    ])
  })
})
