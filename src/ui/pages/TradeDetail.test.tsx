import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { TradeDetail } from './TradeDetail'
import { TradeBookContext } from '../tradeBookContext'
import { JournalContext } from '../journalContext'
import { PriceBookContext } from '../priceBookContext'
import { ValuationsContext } from '../valuationsContext'
import { Valuations } from '@/coordinators/valuations'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { Journal } from '@/books/journal/journal'
import type { PriceBook } from '@/books/pricebook/price-book'
import type { Account, IdeaSource, Institution, PlanDraft } from '@/books/tradebook/types'
import { Workspace, PLAN_ENTRY_TYPE_ID } from '@/workspace/workspace'
import { todayISO } from '../format'
import { inMemoryBooks } from '../../../tests/support/trade-book'

async function seededTrade(): Promise<{
  book: TradeBook
  journal: Journal
  priceBook: PriceBook
  id: string
}> {
  const { tradeBook: book, journal, priceBook } = inMemoryBooks()
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
  return { book, journal, priceBook, id }
}

function renderDetail(book: TradeBook, journal: Journal, priceBook: PriceBook, id: string) {
  return render(
    <TradeBookContext.Provider value={book}>
      <JournalContext.Provider value={journal}>
        <PriceBookContext.Provider value={priceBook}>
          <ValuationsContext.Provider value={new Valuations(book, priceBook)}>
            <MemoryRouter initialEntries={[`/trades/${id}`]}>
              <Routes>
                <Route path="/trades/:id" element={<TradeDetail />} />
              </Routes>
            </MemoryRouter>
          </ValuationsContext.Provider>
        </PriceBookContext.Provider>
      </JournalContext.Provider>
    </TradeBookContext.Provider>,
  )
}

describe('TradeDetail', () => {
  it('shows the plan facts, resolved names, and a planned status badge', async () => {
    const { book, journal, priceBook, id } = await seededTrade()
    renderDetail(book, journal, priceBook, id)

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
    const { book, journal, priceBook, id } = await seededTrade()
    renderDetail(book, journal, priceBook, id)
    await screen.findByText('AAPL breaks out')
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /edit/i })).toBeNull()
  })
})

describe('TradeDetail journal section', () => {
  it("shows the plan entry's prompts and answers", async () => {
    const { book, journal, priceBook, id } = await seededTrade()
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
    renderDetail(book, journal, priceBook, id)

    expect(await screen.findByText('Why this trade, why now?')).toBeInTheDocument()
    expect(screen.getByText('Breakout confirmed')).toBeInTheDocument()
    expect(screen.getByText('calm')).toBeInTheDocument()
    expect(screen.getByLabelText('journal entries')).toHaveTextContent('1')
    expect(screen.queryByLabelText('journal owed')).toBeNull()
  })

  it('shows an owed marker for a placeholder', async () => {
    const { book, journal, priceBook, id } = await seededTrade()
    await journal.write({
      anchor: { kind: 'plan', tradeId: id },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: Date.now(),
      placeholder: true,
      answers: [],
    })
    renderDetail(book, journal, priceBook, id)

    expect(await screen.findByLabelText('journal owed')).toBeInTheDocument()
    expect(screen.getByLabelText('journal entries')).toHaveTextContent('1')
  })

  it("shows a settled placeholder's answers instead of the owed marker", async () => {
    const { book, journal, priceBook, id } = await seededTrade()
    const entryId = await journal.write({
      anchor: { kind: 'plan', tradeId: id },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: Date.now(),
      placeholder: true,
      answers: [],
    })
    await journal.settle(entryId, [
      { promptId: 'why', value: 'Settled during the walk' },
      { promptId: 'emotion', value: 'eager' },
    ])
    renderDetail(book, journal, priceBook, id)

    expect(await screen.findByText('Settled during the walk')).toBeInTheDocument()
    expect(screen.getByText('eager')).toBeInTheDocument()
    expect(screen.queryByLabelText('journal owed')).toBeNull()
  })
})

describe('AddendumUI', () => {
  it('opens the addendum form from an entry', async () => {
    const { book, journal, priceBook, id } = await seededTrade()
    await journal.write({
      anchor: { kind: 'plan', tradeId: id },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: Date.now(),
      placeholder: false,
      answers: [{ promptId: 'why', value: 'Breakout confirmed' }],
    })
    renderDetail(book, journal, priceBook, id)
    const user = userEvent.setup()

    await screen.findByText('Breakout confirmed')
    await user.click(screen.getByRole('button', { name: /add addendum/i }))

    expect(await screen.findByRole('form', { name: /add addendum/i })).toBeInTheDocument()
  })

  it('renders the addendum nested under its parent with its own date', async () => {
    const { book, journal, priceBook, id } = await seededTrade()
    await journal.write({
      anchor: { kind: 'plan', tradeId: id },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: new Date('2026-07-10T12:00:00').getTime(),
      placeholder: false,
      answers: [{ promptId: 'why', value: 'Breakout confirmed' }],
    })
    renderDetail(book, journal, priceBook, id)
    const user = userEvent.setup()

    await screen.findByText('Breakout confirmed')
    await user.click(screen.getByRole('button', { name: /add addendum/i }))
    await user.type(screen.getByLabelText(/why this trade, why now/i), 'Hindsight: this held up')
    await user.click(screen.getByRole('button', { name: /save addendum/i }))

    expect(await screen.findByText('Hindsight: this held up')).toBeInTheDocument()
    const addenda = screen.getByLabelText('addenda')
    expect(within(addenda).getByText(todayISO(), { exact: false })).toBeInTheDocument()
  })

  it('nests an addendum-to-an-addendum under the same root', async () => {
    const { book, journal, priceBook, id } = await seededTrade()
    await journal.write({
      anchor: { kind: 'plan', tradeId: id },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: Date.now(),
      placeholder: false,
      answers: [{ promptId: 'why', value: 'Breakout confirmed' }],
    })
    renderDetail(book, journal, priceBook, id)
    const user = userEvent.setup()

    await screen.findByText('Breakout confirmed')
    await user.click(screen.getByRole('button', { name: /add addendum/i }))
    await user.type(screen.getByLabelText(/why this trade, why now/i), 'First addendum')
    await user.click(screen.getByRole('button', { name: /save addendum/i }))
    await screen.findByText('First addendum')

    const addenda = screen.getByLabelText('addenda')
    await user.click(within(addenda).getByRole('button', { name: /add addendum/i }))
    await user.type(
      within(addenda).getByLabelText(/why this trade, why now/i),
      'Second addendum, on the first',
    )
    await user.click(within(addenda).getByRole('button', { name: /save addendum/i }))

    await screen.findByText('Second addendum, on the first')
    // Still one thread — both addenda nested under the single root, not a
    // second top-level entry.
    expect(screen.getAllByLabelText('addenda')).toHaveLength(1)
    expect(within(screen.getByLabelText('addenda')).getByText('First addendum')).toBeInTheDocument()
    expect(
      within(screen.getByLabelText('addenda')).getByText('Second addendum, on the first'),
    ).toBeInTheDocument()
  })

  it('offers no edit affordance on any written entry', async () => {
    const { book, journal, priceBook, id } = await seededTrade()
    await journal.write({
      anchor: { kind: 'plan', tradeId: id },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: Date.now(),
      placeholder: false,
      answers: [{ promptId: 'why', value: 'Breakout confirmed' }],
    })
    renderDetail(book, journal, priceBook, id)
    const user = userEvent.setup()

    await screen.findByText('Breakout confirmed')
    await user.click(screen.getByRole('button', { name: /add addendum/i }))
    await user.type(screen.getByLabelText(/why this trade, why now/i), 'Grown, not edited')
    await user.click(screen.getByRole('button', { name: /save addendum/i }))
    await screen.findByText('Grown, not edited')

    expect(screen.queryByRole('button', { name: /^edit/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /^edit/i })).toBeNull()
  })
})

async function buy100(book: TradeBook, id: string): Promise<string> {
  const outcome = await book.recordExecution(
    { tradeId: id, newLeg: 'AAPL' },
    {
      side: 'buy',
      qty: 100,
      price: 15000,
      fees: 100,
      timestamp: new Date('2026-07-10T12:00:00').getTime(),
    },
  )
  return outcome.record.legs[0].id
}

async function flatten(book: TradeBook, id: string, legId: string): Promise<void> {
  await book.recordExecution(
    { tradeId: id, legId },
    {
      side: 'sell',
      qty: 100,
      price: 16800,
      fees: 100,
      timestamp: new Date('2026-07-11T12:00:00').getTime(),
    },
  )
}

describe('CloseFlow', () => {
  it('prompts for a Close Reason when a fill flattens the Trade', async () => {
    const { book, journal, priceBook, id } = await seededTrade()
    const legId = await buy100(book, id)
    await flatten(book, id, legId)
    renderDetail(book, journal, priceBook, id)

    expect(await screen.findByLabelText(/close reason/i)).toBeInTheDocument()
  })

  it('shows the reason and close entry once closed', async () => {
    const { book, journal, priceBook, id } = await seededTrade()
    const legId = await buy100(book, id)
    await flatten(book, id, legId)
    await book.setCloseReason(id, { id: 'close-reason-hit-target', name: 'Hit Target' })
    await journal.write({
      anchor: { kind: 'close', tradeId: id },
      entryTypeId: 'entry-type-close',
      at: Date.now(),
      placeholder: false,
      answers: [{ promptId: 'lesson', value: 'Let winners run' }],
    })
    renderDetail(book, journal, priceBook, id)

    expect(await screen.findByLabelText('status')).toHaveTextContent(/closed/i)
    expect(screen.getByLabelText('close reason')).toHaveTextContent('Hit Target')
    expect(screen.getByText('Let winners run')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /close reason/i })).toBeNull()
  })

  it('can be dismissed and completed later from the detail page', async () => {
    const { book, journal, priceBook, id } = await seededTrade()
    const legId = await buy100(book, id)
    await flatten(book, id, legId)
    renderDetail(book, journal, priceBook, id)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /dismiss/i }))
    expect(screen.queryByLabelText(/close reason/i)).toBeNull()

    await user.click(screen.getByRole('button', { name: /add close reason/i }))
    expect(await screen.findByLabelText(/close reason/i)).toBeInTheDocument()
  })
})

describe('AbandonFlow', () => {
  it('offers abandon on a planned Trade and requires a reason', async () => {
    const { book, journal, priceBook, id } = await seededTrade()
    renderDetail(book, journal, priceBook, id)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /abandon/i }))

    const select = await screen.findByLabelText(/close reason/i)
    expect(select).toBeInTheDocument()
    await user.selectOptions(select, 'Never Filled')
    await user.click(screen.getByRole('button', { name: /record close/i }))

    expect(await screen.findByLabelText('status')).toHaveTextContent(/closed/i)
    expect(screen.getByLabelText('close reason')).toHaveTextContent('Never Filled')
  })
})

describe('TradeDetail valuation refresh', () => {
  it('refreshes the valuation numbers after a fill lands', async () => {
    const { book, journal, priceBook, id } = await seededTrade()
    await buy100(book, id)
    await priceBook.record('AAPL', todayISO(), 16000, 'manual')
    renderDetail(book, journal, priceBook, id)
    const user = userEvent.setup()

    // Open: the worked example at mark 160 — unrealized 1000.00, nothing realized.
    const open = await screen.findByLabelText('profit and loss')
    expect(open).toHaveTextContent(/1000\.00/)

    // The flattening sell: 100 @ 168, fees 1 → realized 1798.00, unrealized 0.
    await user.click(screen.getByRole('button', { name: /record fill/i }))
    await user.selectOptions(screen.getByLabelText(/side/i), 'sell')
    await user.type(screen.getByLabelText(/quantity/i), '100')
    await user.type(screen.getByLabelText(/price/i), '168')
    await user.type(screen.getByLabelText(/fees/i), '1')
    await user.click(screen.getByRole('button', { name: /record fill/i }))

    // The panel reads the Trade the Position and the badge already read: flat.
    const pnl = await screen.findByLabelText('profit and loss')
    await waitFor(() => expect(pnl).toHaveTextContent(/1798\.00/))
    expect(await screen.findByLabelText('position')).toHaveTextContent(/no position/i)
    expect(pnl).not.toHaveTextContent(/1000\.00/)
  })
})

describe('TradeDetail position & history', () => {
  it('shows holdings from Valuations.position', async () => {
    const { book, journal, priceBook, id } = await seededTrade()
    await book.recordExecution(
      { tradeId: id, newLeg: 'AAPL' },
      { side: 'buy', qty: 100, price: 15000, fees: 100, timestamp: Date.now() },
    )
    renderDetail(book, journal, priceBook, id)

    const position = await screen.findByLabelText('position')
    expect(position).toHaveTextContent(/100 AAPL long/i)
  })

  it('lists executions oldest-first with fees', async () => {
    const { book, journal, priceBook, id } = await seededTrade()
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
    renderDetail(book, journal, priceBook, id)

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
