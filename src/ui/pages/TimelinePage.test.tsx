import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { TimelinePage } from './TimelinePage'
import { TradeBookContext } from '../tradeBookContext'
import { JournalContext } from '../journalContext'
import {
  Workspace,
  PLAN_ENTRY_TYPE_ID,
  TRADER_REFLECTION_ENTRY_TYPE_ID,
} from '@/workspace/workspace'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { Journal } from '@/books/journal/journal'
import type { Account, Institution, PlanDraft } from '@/books/tradebook/types'
import { todayISO, timestampToISODate } from '../format'
import { inMemoryBooks } from '../../../tests/support/trade-book'

async function seededTrade(ticker: string): Promise<{
  tradeBook: TradeBook
  journal: Journal
  tradeId: string
}> {
  const { tradeBook, journal } = inMemoryBooks()
  await new Workspace(tradeBook, journal).ensureSeeded()
  const institution = { id: '', name: 'Schwab' } as Institution
  await tradeBook.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await tradeBook.registries.accounts.save(account)

  const draft: PlanDraft = {
    accountId: account.id,
    thesis: `${ticker} thesis`,
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker }, qty: 100 }],
    exitLevels: [],
    plannedAt: '2026-07-01',
  }
  const tradeId = await tradeBook.confirmPlan(draft)
  return { tradeBook, journal, tradeId }
}

function renderPage(tradeBook: TradeBook, journal: Journal) {
  return render(
    <TradeBookContext.Provider value={tradeBook}>
      <JournalContext.Provider value={journal}>
        <MemoryRouter>
          <TimelinePage />
        </MemoryRouter>
      </JournalContext.Provider>
    </TradeBookContext.Provider>,
  )
}

describe('TimelinePage', () => {
  it('renders entries newest-first with anchor labels', async () => {
    const { tradeBook, journal, tradeId } = await seededTrade('AAPL')
    await journal.write({
      anchor: { kind: 'plan', tradeId },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: new Date('2026-07-01T12:00:00').getTime(),
      placeholder: false,
      answers: [{ promptId: 'why', value: 'Breakout confirmed' }],
    })
    await journal.write({
      anchor: { kind: 'standalone' },
      entryTypeId: TRADER_REFLECTION_ENTRY_TYPE_ID,
      at: new Date('2026-07-02T09:00:00').getTime(),
      placeholder: false,
      answers: [{ promptId: 'mind', value: 'Feeling steady' }],
    })

    renderPage(tradeBook, journal)

    const items = await screen.findAllByRole('listitem')
    // Newest (standalone, Jul 2) first, then the plan entry.
    expect(within(items[0]).getByText('Standalone')).toBeInTheDocument()
    expect(within(items[0]).getByText('Feeling steady')).toBeInTheDocument()
    expect(items[1].textContent).toContain('Plan —')
    expect(within(items[1]).getByRole('link', { name: 'AAPL' })).toBeInTheDocument()
    expect(within(items[1]).getByText('Breakout confirmed')).toBeInTheDocument()
  })

  it('links a trade-anchored entry to its Trade detail page', async () => {
    const { tradeBook, journal, tradeId } = await seededTrade('AAPL')
    await journal.write({
      anchor: { kind: 'plan', tradeId },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: Date.now(),
      placeholder: false,
      answers: [{ promptId: 'why', value: 'Breakout confirmed' }],
    })

    renderPage(tradeBook, journal)

    const tradeLink = await screen.findByRole('link', { name: 'AAPL' })
    expect(tradeLink).toHaveAttribute('href', `/trades/${tradeId}`)
  })

  it('renders two entries of one type with different snapshots correctly', async () => {
    const { tradeBook, journal } = await seededTrade('AAPL')
    await journal.write({
      anchor: { kind: 'standalone' },
      entryTypeId: TRADER_REFLECTION_ENTRY_TYPE_ID,
      at: new Date('2026-07-01T09:00:00').getTime(),
      placeholder: false,
      answers: [{ promptId: 'mind', value: 'First shape' }],
    })

    const types = await journal.entryTypes.list()
    const reflectionType = types.find((t) => t.id === TRADER_REFLECTION_ENTRY_TYPE_ID)!
    await journal.entryTypes.save({
      ...reflectionType,
      prompts: [
        ...reflectionType.prompts,
        { id: 'gratitude', text: 'Grateful for?', kind: 'text' },
      ],
    })

    await journal.write({
      anchor: { kind: 'standalone' },
      entryTypeId: TRADER_REFLECTION_ENTRY_TYPE_ID,
      at: new Date('2026-07-02T09:00:00').getTime(),
      placeholder: false,
      answers: [{ promptId: 'gratitude', value: 'A green day' }],
    })

    renderPage(tradeBook, journal)

    const items = await screen.findAllByRole('listitem')
    expect(within(items[0]).getByText('Grateful for?')).toBeInTheDocument()
    expect(within(items[0]).getByText('A green day')).toBeInTheDocument()
    expect(within(items[1]).queryByText('Grateful for?')).not.toBeInTheDocument()
    expect(within(items[1]).getByText('First shape')).toBeInTheDocument()
  })

  it('shows placeholders as owed and lets the trader settle inline', async () => {
    const { tradeBook, journal, tradeId } = await seededTrade('AAPL')
    const writtenAt = new Date('2026-07-01T12:00:00').getTime()
    await journal.write({
      anchor: { kind: 'plan', tradeId },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: writtenAt,
      placeholder: true,
      answers: [],
    })

    renderPage(tradeBook, journal)
    const user = userEvent.setup()

    expect(await screen.findByLabelText('journal owed')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/why this trade, why now/i), 'Settled inline')
    await user.click(screen.getByRole('button', { name: /settle entry/i }))

    await waitFor(() => expect(screen.getByText('Settled inline')).toBeInTheDocument())
    expect(screen.queryByLabelText('journal owed')).not.toBeInTheDocument()
    // Late journaling stays visible: both the written and the settled date show.
    expect(
      screen.getByText(`written ${timestampToISODate(writtenAt)} · settled ${todayISO()}`, {
        exact: false,
      }),
    ).toBeInTheDocument()
  })

  it('narrows to the selected date range', async () => {
    const { tradeBook, journal, tradeId } = await seededTrade('AAPL')
    await journal.write({
      anchor: { kind: 'plan', tradeId },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: new Date('2026-07-01T12:00:00').getTime(),
      placeholder: false,
      answers: [{ promptId: 'why', value: 'Early answer' }],
    })
    await journal.write({
      anchor: { kind: 'standalone' },
      entryTypeId: TRADER_REFLECTION_ENTRY_TYPE_ID,
      at: new Date('2026-07-10T09:00:00').getTime(),
      placeholder: false,
      answers: [{ promptId: 'mind', value: 'Late answer' }],
    })

    renderPage(tradeBook, journal)

    expect(await screen.findByText('Early answer')).toBeInTheDocument()
    expect(screen.getByText('Late answer')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-07-05' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-07-15' } })

    await waitFor(() => expect(screen.queryByText('Early answer')).not.toBeInTheDocument())
    expect(screen.getByText('Late answer')).toBeInTheDocument()
  })
})
