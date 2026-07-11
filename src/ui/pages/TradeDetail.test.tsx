import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { TradeDetail } from './TradeDetail'
import { TradeBookContext } from '../tradeBookContext'
import { JournalContext } from '../journalContext'
import { ValuationsContext } from '../valuationsContext'
import { Valuations } from '@/coordinators/valuations'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { Journal } from '@/books/journal/journal'
import type { Account, IdeaSource, Institution, PlanDraft } from '@/books/tradebook/types'
import { Workspace, PLAN_ENTRY_TYPE_ID } from '@/workspace/workspace'
import { inMemoryBooks } from '../../../tests/support/trade-book'

async function seededTrade(): Promise<{ book: TradeBook; journal: Journal; id: string }> {
  const { tradeBook: book, journal } = inMemoryBooks()
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  await new Workspace(book, journal).ensureSeeded()
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
  return { book, journal, id }
}

function renderDetail(book: TradeBook, journal: Journal, id: string) {
  return render(
    <TradeBookContext.Provider value={book}>
      <JournalContext.Provider value={journal}>
        <ValuationsContext.Provider value={new Valuations(book)}>
          <MemoryRouter initialEntries={[`/trades/${id}`]}>
            <Routes>
              <Route path="/trades/:id" element={<TradeDetail />} />
            </Routes>
          </MemoryRouter>
        </ValuationsContext.Provider>
      </JournalContext.Provider>
    </TradeBookContext.Provider>,
  )
}

describe('TradeDetail', () => {
  it('shows the plan facts, resolved names, and a planned status badge', async () => {
    const { book, journal, id } = await seededTrade()
    renderDetail(book, journal, id)

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
    const { book, journal, id } = await seededTrade()
    renderDetail(book, journal, id)
    await screen.findByText('AAPL breaks out')
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /edit/i })).toBeNull()
  })
})

describe('TradeDetail journal section', () => {
  it("shows the plan entry's prompts and answers", async () => {
    const { book, journal, id } = await seededTrade()
    await journal.write({
      anchor: { kind: 'plan', tradeId: id },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: Date.now(),
      placeholder: false,
      answers: [
        { promptId: 'why', value: 'Breakout confirmed' },
        { promptId: 'conviction', value: 4 },
        { promptId: 'emotion', value: 'calm' },
      ],
    })
    renderDetail(book, journal, id)

    expect(await screen.findByText('Why this trade, why now?')).toBeInTheDocument()
    expect(screen.getByText('Breakout confirmed')).toBeInTheDocument()
    expect(screen.getByText('calm')).toBeInTheDocument()
    expect(screen.getByLabelText('journal entries')).toHaveTextContent('1')
    expect(screen.queryByLabelText('journal owed')).toBeNull()
  })

  it('shows an owed marker for a placeholder', async () => {
    const { book, journal, id } = await seededTrade()
    await journal.write({
      anchor: { kind: 'plan', tradeId: id },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: Date.now(),
      placeholder: true,
      answers: [],
    })
    renderDetail(book, journal, id)

    expect(await screen.findByLabelText('journal owed')).toBeInTheDocument()
    expect(screen.getByLabelText('journal entries')).toHaveTextContent('1')
  })
})

describe('TradeDetail position & history', () => {
  it('shows holdings from Valuations.position', async () => {
    const { book, journal, id } = await seededTrade()
    await book.recordExecution(
      { tradeId: id, newLeg: 'AAPL' },
      { side: 'buy', qty: 100, price: 15000, fees: 100, timestamp: Date.now() },
    )
    renderDetail(book, journal, id)

    const position = await screen.findByLabelText('position')
    expect(position).toHaveTextContent(/100 AAPL long/i)
  })

  it('lists executions oldest-first with fees', async () => {
    const { book, journal, id } = await seededTrade()
    await book.recordExecution(
      { tradeId: id, newLeg: 'AAPL' },
      {
        side: 'buy',
        qty: 100,
        price: 15000,
        fees: 100,
        timestamp: new Date('2026-07-10T12:00:00').getTime(),
      },
    )
    renderDetail(book, journal, id)

    const history = await screen.findByLabelText('execution history')
    const rows = within(history).getAllByRole('listitem')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent('2026-07-10')
    expect(rows[0]).toHaveTextContent(/buy/i)
    expect(rows[0]).toHaveTextContent('100')
    expect(rows[0]).toHaveTextContent('150.00')
    expect(rows[0]).toHaveTextContent('1.00')
  })
})
