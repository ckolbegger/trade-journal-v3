import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppRoot } from './AppRoot'
import { Valuations } from '@/coordinators/valuations'
import { Review } from '@/coordinators/review'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { Journal } from '@/books/journal/journal'
import type { PriceBook } from '@/books/pricebook/price-book'
import type { Account, Institution } from '@/books/tradebook/types'
import { inMemoryBooks } from '../../tests/support/trade-book'

function renderApp(tradeBook: TradeBook, journal: Journal, priceBook: PriceBook) {
  const valuations = new Valuations(tradeBook, priceBook)
  return render(
    <MemoryRouter>
      <AppRoot
        tradeBook={tradeBook}
        journal={journal}
        priceBook={priceBook}
        valuations={valuations}
        review={new Review(valuations, journal)}
      />
    </MemoryRouter>,
  )
}

describe('Onboarding', () => {
  it('shows onboarding when no accounts exist', async () => {
    const { tradeBook, journal, priceBook } = inMemoryBooks()
    renderApp(tradeBook, journal, priceBook)
    expect(
      await screen.findByRole('heading', { name: /set up your first account/i }),
    ).toBeInTheDocument()
  })

  it('requires an institution name and an account name to proceed', async () => {
    const { tradeBook, journal, priceBook } = inMemoryBooks()
    renderApp(tradeBook, journal, priceBook)
    const user = userEvent.setup()
    await screen.findByRole('heading', { name: /set up your first account/i })

    await user.click(screen.getByRole('button', { name: /get started/i }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(await tradeBook.registries.institutions.list()).toHaveLength(0)
    expect(await tradeBook.registries.accounts.list()).toHaveLength(0)
  })

  it('saves the institution and account via TradeBook.registries', async () => {
    const { tradeBook, journal, priceBook } = inMemoryBooks()
    renderApp(tradeBook, journal, priceBook)
    const user = userEvent.setup()
    await screen.findByRole('heading', { name: /set up your first account/i })

    await user.type(screen.getByLabelText(/institution name/i), 'Schwab')
    await user.type(screen.getByLabelText(/account name/i), 'Taxable')
    await user.click(screen.getByRole('button', { name: /get started/i }))

    await waitFor(async () => {
      expect(await tradeBook.registries.accounts.list()).toHaveLength(1)
    })
    const institutions = await tradeBook.registries.institutions.list()
    const accounts = await tradeBook.registries.accounts.list()
    expect(institutions.map((i) => i.name)).toEqual(['Schwab'])
    expect(accounts.map((a) => a.name)).toEqual(['Taxable'])
    expect(accounts[0].institutionId).toBe(institutions[0].id)
  })

  it('skips onboarding when an account already exists', async () => {
    const { tradeBook, journal, priceBook } = inMemoryBooks()
    const institution = { id: '', name: 'Schwab' } as Institution
    await tradeBook.registries.institutions.save(institution)
    await tradeBook.registries.accounts.save({
      id: '',
      name: 'Taxable',
      institutionId: institution.id,
    } as Account)

    renderApp(tradeBook, journal, priceBook)

    expect(await screen.findByRole('heading', { name: 'Trades' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: /set up your first account/i }),
    ).not.toBeInTheDocument()
  })
})
