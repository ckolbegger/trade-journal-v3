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
  CLOSE_ENTRY_TYPE_ID,
  REVIEW_ENTRY_TYPE_ID,
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

// Top-level timeline rows only — excludes addenda `listitem`s nested inside a
// row's own "addenda" sublist, which `getAllByRole` would otherwise pick up.
function topLevelRows(timeline: HTMLElement): HTMLElement[] {
  return Array.from(timeline.children).filter((el): el is HTMLElement => el.tagName === 'LI')
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

  it('nests an addendum chain under its root entry, not as its own row', async () => {
    const { tradeBook, journal, tradeId } = await seededTrade('AAPL')
    const rootId = await journal.write({
      anchor: { kind: 'plan', tradeId },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: new Date('2026-07-01T12:00:00').getTime(),
      placeholder: false,
      answers: [{ promptId: 'why', value: 'Breakout confirmed' }],
    })
    const addendumId = await journal.write({
      anchor: { kind: 'entry', entryId: rootId },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: new Date('2026-07-02T09:00:00').getTime(),
      placeholder: false,
      answers: [{ promptId: 'why', value: 'Held up as planned' }],
    })
    await journal.write({
      anchor: { kind: 'entry', entryId: addendumId },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: new Date('2026-07-03T09:00:00').getTime(),
      placeholder: false,
      answers: [{ promptId: 'why', value: 'Still holding' }],
    })

    renderPage(tradeBook, journal)

    // One top-level row for the whole thread, not three. Date-group headers
    // are also children of the timeline list but carry no listitem role, so
    // this stays robust to their insertion.
    const timeline = await screen.findByLabelText('timeline')
    const topLevelItems = topLevelRows(timeline)
    expect(topLevelItems).toHaveLength(1)
    const addenda = within(topLevelItems[0] as HTMLElement).getByLabelText('addenda')
    expect(within(addenda).getByText('Held up as planned')).toBeInTheDocument()
    expect(within(addenda).getByText('Still holding')).toBeInTheDocument()
  })
})

// A lifecycle covering all four anchor kinds a timeline row can carry, on
// distinct days so date-group headers separate them cleanly.
async function seededLifecycle(ticker: string) {
  const { tradeBook, journal, tradeId } = await seededTrade(ticker)
  await journal.write({
    anchor: { kind: 'plan', tradeId },
    entryTypeId: PLAN_ENTRY_TYPE_ID,
    at: new Date('2026-07-01T12:00:00').getTime(),
    placeholder: false,
    answers: [{ promptId: 'why', value: 'Breakout confirmed' }],
  })
  await journal.write({
    anchor: { kind: 'close', tradeId },
    entryTypeId: CLOSE_ENTRY_TYPE_ID,
    at: new Date('2026-07-02T14:00:00').getTime(),
    placeholder: false,
    answers: [{ promptId: 'lesson', value: 'Let winners run to target' }],
  })
  await journal.write({
    anchor: { kind: 'review', date: '2026-07-03', tradeId },
    entryTypeId: REVIEW_ENTRY_TYPE_ID,
    at: new Date('2026-07-03T20:00:00').getTime(),
    placeholder: false,
    answers: [{ promptId: 'action', value: 'Hold' }],
  })
  await journal.write({
    anchor: { kind: 'standalone' },
    entryTypeId: TRADER_REFLECTION_ENTRY_TYPE_ID,
    at: new Date('2026-07-04T09:00:00').getTime(),
    placeholder: false,
    answers: [{ promptId: 'mind', value: 'Feeling disciplined this week' }],
  })
  return { tradeBook, journal, tradeId }
}

describe('TimelinePage filter chips', () => {
  it('renders All, Plans, Reviews, Market and Closes chips', async () => {
    const { tradeBook, journal } = await seededLifecycle('AAPL')
    renderPage(tradeBook, journal)

    await screen.findByLabelText('timeline')
    for (const name of ['All', 'Plans', 'Reviews', 'Market', 'Closes']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('shows every entry when All is selected, which is the default', async () => {
    const { tradeBook, journal } = await seededLifecycle('AAPL')
    renderPage(tradeBook, journal)

    const timeline = await screen.findByLabelText('timeline')
    expect(topLevelRows(timeline)).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows only plan-anchored entries when Plans is selected', async () => {
    const { tradeBook, journal } = await seededLifecycle('AAPL')
    renderPage(tradeBook, journal)
    const user = userEvent.setup()

    await screen.findByLabelText('timeline')
    await user.click(screen.getByRole('button', { name: 'Plans' }))

    const timeline = screen.getByLabelText('timeline')
    const items = topLevelRows(timeline)
    expect(items).toHaveLength(1)
    expect(within(items[0]).getByText('Breakout confirmed')).toBeInTheDocument()
  })

  it('shows only close-anchored entries when Closes is selected', async () => {
    const { tradeBook, journal } = await seededLifecycle('AAPL')
    renderPage(tradeBook, journal)
    const user = userEvent.setup()

    await screen.findByLabelText('timeline')
    await user.click(screen.getByRole('button', { name: 'Closes' }))

    const timeline = screen.getByLabelText('timeline')
    const items = topLevelRows(timeline)
    expect(items).toHaveLength(1)
    expect(within(items[0]).getByText('Let winners run to target')).toBeInTheDocument()
  })

  it('shows only review-anchored entries when Reviews is selected', async () => {
    const { tradeBook, journal } = await seededLifecycle('AAPL')
    renderPage(tradeBook, journal)
    const user = userEvent.setup()

    await screen.findByLabelText('timeline')
    await user.click(screen.getByRole('button', { name: 'Reviews' }))

    const timeline = screen.getByLabelText('timeline')
    const items = topLevelRows(timeline)
    expect(items).toHaveLength(1)
    expect(within(items[0]).getByText('Hold')).toBeInTheDocument()
  })

  it('shows only standalone entries when Market is selected', async () => {
    const { tradeBook, journal } = await seededLifecycle('AAPL')
    renderPage(tradeBook, journal)
    const user = userEvent.setup()

    await screen.findByLabelText('timeline')
    await user.click(screen.getByRole('button', { name: 'Market' }))

    const timeline = screen.getByLabelText('timeline')
    const items = topLevelRows(timeline)
    expect(items).toHaveLength(1)
    expect(within(items[0]).getByText('Feeling disciplined this week')).toBeInTheDocument()
  })

  it('marks the selected chip as pressed and the others as not pressed', async () => {
    const { tradeBook, journal } = await seededLifecycle('AAPL')
    renderPage(tradeBook, journal)
    const user = userEvent.setup()

    await screen.findByLabelText('timeline')
    await user.click(screen.getByRole('button', { name: 'Closes' }))

    expect(screen.getByRole('button', { name: 'Closes' })).toHaveAttribute('aria-pressed', 'true')
    for (const name of ['All', 'Plans', 'Reviews', 'Market']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('keeps an owed placeholder settleable inline while a filter is active', async () => {
    const { tradeBook, journal, tradeId } = await seededLifecycle('AAPL')
    await journal.write({
      anchor: { kind: 'plan', tradeId },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: new Date('2026-07-05T12:00:00').getTime(),
      placeholder: true,
      answers: [],
    })
    renderPage(tradeBook, journal)
    const user = userEvent.setup()

    await screen.findByLabelText('timeline')
    await user.click(screen.getByRole('button', { name: 'Plans' }))

    expect(await screen.findByLabelText('journal owed')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/why this trade, why now/i), 'Settled inline')
    await user.click(screen.getByRole('button', { name: /settle entry/i }))

    await waitFor(() => expect(screen.getByText('Settled inline')).toBeInTheDocument())
    expect(screen.queryByLabelText('journal owed')).not.toBeInTheDocument()
  })

  it('keeps addenda nested under their root when a filter is active', async () => {
    const { tradeBook, journal, tradeId } = await seededTrade('AAPL')
    const rootId = await journal.write({
      anchor: { kind: 'plan', tradeId },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: new Date('2026-07-01T12:00:00').getTime(),
      placeholder: false,
      answers: [{ promptId: 'why', value: 'Breakout confirmed' }],
    })
    await journal.write({
      anchor: { kind: 'entry', entryId: rootId },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: new Date('2026-07-02T09:00:00').getTime(),
      placeholder: false,
      answers: [{ promptId: 'why', value: 'Held up as planned' }],
    })
    renderPage(tradeBook, journal)
    const user = userEvent.setup()

    await screen.findByLabelText('timeline')
    await user.click(screen.getByRole('button', { name: 'Plans' }))

    const timeline = screen.getByLabelText('timeline')
    const items = topLevelRows(timeline)
    expect(items).toHaveLength(1)
    const addenda = within(items[0]).getByLabelText('addenda')
    expect(within(addenda).getByText('Held up as planned')).toBeInTheDocument()
  })

  it('shows an empty timeline, not an error, when a filter matches nothing', async () => {
    const { tradeBook, journal } = await seededTrade('AAPL')
    await journal.write({
      anchor: { kind: 'standalone' },
      entryTypeId: TRADER_REFLECTION_ENTRY_TYPE_ID,
      at: new Date('2026-07-01T09:00:00').getTime(),
      placeholder: false,
      answers: [{ promptId: 'mind', value: 'Feeling steady' }],
    })
    renderPage(tradeBook, journal)
    const user = userEvent.setup()

    await screen.findByLabelText('timeline')
    await user.click(screen.getByRole('button', { name: 'Closes' }))

    const timeline = screen.getByLabelText('timeline')
    expect(within(timeline).queryAllByRole('listitem')).toHaveLength(0)
  })

  it('re-applies the active filter after an entry is added', async () => {
    const { tradeBook, journal } = await seededLifecycle('AAPL')
    renderPage(tradeBook, journal)
    const user = userEvent.setup()

    await screen.findByLabelText('timeline')
    await user.click(screen.getByRole('button', { name: 'Market' }))
    expect(topLevelRows(screen.getByLabelText('timeline'))).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /new entry/i }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Entry Type' }),
      'Trader Reflection',
    )
    await user.type(screen.getByLabelText("What's on your mind?"), 'Second reflection')
    await user.click(screen.getByRole('radio', { name: 'calm' }))
    await user.click(screen.getByRole('radio', { name: '4' }))
    await user.click(screen.getByRole('button', { name: /save entry/i }))

    const timeline = await screen.findByLabelText('timeline')
    await waitFor(() => expect(topLevelRows(timeline)).toHaveLength(2))
    expect(screen.getByRole('button', { name: 'Market' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('TimelinePage type badges', () => {
  it('labels a plan-anchored entry PLAN', async () => {
    const { tradeBook, journal } = await seededLifecycle('AAPL')
    renderPage(tradeBook, journal)

    const timeline = await screen.findByLabelText('timeline')
    const row = topLevelRows(timeline).find((r) => within(r).queryByText('Breakout confirmed'))!
    expect(within(row).getByText('PLAN')).toBeInTheDocument()
  })

  it('labels a close-anchored entry CLOSE', async () => {
    const { tradeBook, journal } = await seededLifecycle('AAPL')
    renderPage(tradeBook, journal)

    const timeline = await screen.findByLabelText('timeline')
    const row = topLevelRows(timeline).find((r) =>
      within(r).queryByText('Let winners run to target'),
    )!
    expect(within(row).getByText('CLOSE')).toBeInTheDocument()
  })

  it('labels a review-anchored entry REVIEW', async () => {
    const { tradeBook, journal } = await seededLifecycle('AAPL')
    renderPage(tradeBook, journal)

    const timeline = await screen.findByLabelText('timeline')
    const row = topLevelRows(timeline).find((r) => within(r).queryByText('Hold'))!
    expect(within(row).getByText('REVIEW')).toBeInTheDocument()
  })

  it('labels a standalone entry MARKET', async () => {
    const { tradeBook, journal } = await seededLifecycle('AAPL')
    renderPage(tradeBook, journal)

    const timeline = await screen.findByLabelText('timeline')
    const row = topLevelRows(timeline).find((r) =>
      within(r).queryByText('Feeling disciplined this week'),
    )!
    expect(within(row).getByText('MARKET')).toBeInTheDocument()
  })

  it('never labels an entry POSITION', async () => {
    const { tradeBook, journal } = await seededLifecycle('AAPL')
    renderPage(tradeBook, journal)

    await screen.findByLabelText('timeline')
    expect(screen.queryByText('POSITION', { exact: false })).not.toBeInTheDocument()
  })
})

describe('TimelinePage date-group headers', () => {
  it('shows Today as the header label for an entry written today', async () => {
    const { tradeBook, journal } = await seededTrade('AAPL')
    await journal.write({
      anchor: { kind: 'standalone' },
      entryTypeId: TRADER_REFLECTION_ENTRY_TYPE_ID,
      at: Date.now(),
      placeholder: false,
      answers: [{ promptId: 'mind', value: 'Feeling steady' }],
    })

    renderPage(tradeBook, journal)

    const timeline = await screen.findByLabelText('timeline')
    expect(within(timeline).getByRole('heading', { level: 3, name: 'Today' })).toBeInTheDocument()
  })

  it('groups entries written on the same day under one date header', async () => {
    const { tradeBook, journal } = await seededTrade('AAPL')
    await journal.write({
      anchor: { kind: 'standalone' },
      entryTypeId: TRADER_REFLECTION_ENTRY_TYPE_ID,
      at: new Date('2026-07-01T09:00:00').getTime(),
      placeholder: false,
      answers: [{ promptId: 'mind', value: 'Morning check-in' }],
    })
    await journal.write({
      anchor: { kind: 'standalone' },
      entryTypeId: TRADER_REFLECTION_ENTRY_TYPE_ID,
      at: new Date('2026-07-01T20:00:00').getTime(),
      placeholder: false,
      answers: [{ promptId: 'mind', value: 'Evening wrap-up' }],
    })

    renderPage(tradeBook, journal)

    const timeline = await screen.findByLabelText('timeline')
    expect(topLevelRows(timeline)).toHaveLength(2)
    expect(within(timeline).getAllByRole('heading', { level: 3, name: 'Jul 1' })).toHaveLength(1)
  })

  it('shows a distinct header per date when entries span multiple days', async () => {
    const { tradeBook, journal } = await seededTrade('AAPL')
    await journal.write({
      anchor: { kind: 'standalone' },
      entryTypeId: TRADER_REFLECTION_ENTRY_TYPE_ID,
      at: new Date('2026-07-01T09:00:00').getTime(),
      placeholder: false,
      answers: [{ promptId: 'mind', value: 'Day one' }],
    })
    await journal.write({
      anchor: { kind: 'standalone' },
      entryTypeId: TRADER_REFLECTION_ENTRY_TYPE_ID,
      at: new Date('2026-07-02T09:00:00').getTime(),
      placeholder: false,
      answers: [{ promptId: 'mind', value: 'Day two' }],
    })

    renderPage(tradeBook, journal)

    const timeline = await screen.findByLabelText('timeline')
    expect(within(timeline).getByRole('heading', { level: 3, name: 'Jul 1' })).toBeInTheDocument()
    expect(within(timeline).getByRole('heading', { level: 3, name: 'Jul 2' })).toBeInTheDocument()
  })
})
