import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { TradeDetail } from './TradeDetail'
import { TradeBookContext } from '../tradeBookContext'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { Account, IdeaSource, Institution, PlanDraft } from '@/books/tradebook/types'
import { Workspace } from '@/workspace/workspace'
import { inMemoryTradeBook } from '../../../tests/support/trade-book'

async function seededTrade(): Promise<{ book: TradeBook; id: string }> {
  const book = inMemoryTradeBook()
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  await new Workspace(book).ensureSeeded()
  const source: IdeaSource = { id: '', name: 'Newsletter X' }
  await book.registries.ideaSources.save(source)

  const draft: PlanDraft = {
    accountId: account.id,
    thesis: 'AAPL breaks out',
    strategyId: 'strategy-long-stock',
    ideaSourceId: source.id,
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 }],
    exitLevels: [
      { scope: { level: 'trade' }, side: 'stop', kind: 'underlyingPrice', price: 14000 },
      { scope: { level: 'trade' }, side: 'target', kind: 'underlyingPrice', price: 17000 },
    ],
    plannedAt: '2026-07-10',
    chartLink: 'https://charts.example/aapl',
  }
  const id = await book.confirmPlan(draft)
  return { book, id }
}

function renderDetail(book: TradeBook, id: string) {
  return render(
    <TradeBookContext.Provider value={book}>
      <MemoryRouter initialEntries={[`/trades/${id}`]}>
        <Routes>
          <Route path="/trades/:id" element={<TradeDetail />} />
        </Routes>
      </MemoryRouter>
    </TradeBookContext.Provider>,
  )
}

describe('TradeDetail', () => {
  it('shows the plan facts, resolved names, and a planned status badge', async () => {
    const { book, id } = await seededTrade()
    renderDetail(book, id)

    expect(await screen.findByText('AAPL breaks out')).toBeInTheDocument()
    expect(screen.getByText('Long Stock')).toBeInTheDocument()
    expect(screen.getByText('Newsletter X')).toBeInTheDocument()
    expect(screen.getByText(/buy 100 AAPL/i)).toBeInTheDocument()
    expect(screen.getByText(/140\.00/)).toBeInTheDocument()
    expect(screen.getByText(/170\.00/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /chart/i })).toHaveAttribute(
      'href',
      'https://charts.example/aapl',
    )
    expect(screen.getByLabelText('status')).toHaveTextContent(/planned/i)
  })

  it('offers no way to edit the confirmed Plan', async () => {
    const { book, id } = await seededTrade()
    renderDetail(book, id)
    await screen.findByText('AAPL breaks out')
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /edit/i })).toBeNull()
  })
})
