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

// PlanForm (spread), S7.2.T2: the Bull Put Spread template plans TWO option
// legs — sell 1 put, buy 1 put (lower strike) — sharing ticker and a LINKED
// expiration (one input drives both legs), with strike per-leg since the
// legs' strikes differ.

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

describe('PlanForm (spread)', () => {
  it('plans two option legs sharing ticker and expiration', async () => {
    const { book, journal } = await seededBook()
    const spy = vi.spyOn(book, 'confirmPlan')
    renderForm(book, journal)
    const user = userEvent.setup()
    await user.selectOptions(await screen.findByLabelText(/strategy/i), 'Bull Put Spread')

    await user.type(screen.getByLabelText(/thesis/i), 'XYZ range-bound, bullish bias')
    await user.type(screen.getByLabelText(/ticker/i), 'XYZ')

    // ONE Expiration input, driving both legs.
    const expirationInputs = screen.getAllByLabelText(/expiration/i)
    expect(expirationInputs).toHaveLength(1)
    await user.type(expirationInputs[0], '2026-08-21')

    // Two Strike inputs, one per leg — sell 100, buy 90.
    const strikeInputs = screen.getAllByLabelText(/strike/i)
    expect(strikeInputs).toHaveLength(2)
    await user.type(strikeInputs[0], '100')
    await user.type(strikeInputs[1], '90')

    await user.type(screen.getByLabelText(/quantity.*sell/i), '1')
    await user.type(screen.getByLabelText(/quantity.*buy/i), '1')
    await user.type(screen.getByLabelText(/stop/i), '97')
    await user.type(screen.getByLabelText(/target/i), '0.50')
    await user.click(screen.getByRole('button', { name: /confirm plan/i }))

    expect(spy).toHaveBeenCalledTimes(1)
    const draft = spy.mock.calls[0][0]
    expect(draft.plannedLegs).toEqual([
      {
        side: 'sell',
        instrument: {
          kind: 'option',
          ticker: 'XYZ',
          type: 'put',
          expiration: '2026-08-21',
          strike: 10000,
        },
        qty: 1,
      },
      {
        side: 'buy',
        instrument: {
          kind: 'option',
          ticker: 'XYZ',
          type: 'put',
          expiration: '2026-08-21',
          strike: 9000,
        },
        qty: 1,
      },
    ])
    expect(draft.exitLevels).toEqual([
      { scope: { level: 'trade' }, side: 'stop', kind: 'underlyingPrice', price: 9700 },
      { scope: { level: 'trade' }, side: 'target', kind: 'structureValue', value: 50 },
    ])
  })

  it('cannot confirm with a blank strike — the spread is not a legging plan', async () => {
    // Unlike the Covered Call's TBD call leg, both of the Bull Put Spread's
    // legs are concrete at plan time (template-driven `tbdAllowed`, S7.2
    // MUST-FIX) — no "optional — TBD" affordance, and the button stays
    // disabled with one strike left blank.
    const { book, journal } = await seededBook()
    const spy = vi.spyOn(book, 'confirmPlan')
    renderForm(book, journal)
    const user = userEvent.setup()
    await user.selectOptions(await screen.findByLabelText(/strategy/i), 'Bull Put Spread')

    expect(screen.queryByText(/strike tbd/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/expiration tbd/i)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/thesis/i), 'XYZ range-bound, bullish bias')
    await user.type(screen.getByLabelText(/ticker/i), 'XYZ')
    await user.type(screen.getAllByLabelText(/expiration/i)[0], '2026-08-21')
    // Only the FIRST leg's strike is filled — the second is left blank.
    await user.type(screen.getAllByLabelText(/strike/i)[0], '100')
    await user.type(screen.getByLabelText(/quantity.*sell/i), '1')
    await user.type(screen.getByLabelText(/quantity.*buy/i), '1')
    await user.type(screen.getByLabelText(/stop/i), '97')
    await user.type(screen.getByLabelText(/target/i), '75')

    expect(screen.getByRole('button', { name: /confirm plan/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /confirm plan/i }))
    expect(spy).not.toHaveBeenCalled()
  })
})
