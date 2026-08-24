import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { PlanEntryForm } from './PlanEntryForm'
import { CloseForm } from './CloseForm'
import { JournalContext } from '../journalContext'
import { TradeBookContext } from '../tradeBookContext'
import { Workspace } from '@/workspace/workspace'
import type { Journal } from '@/books/journal/journal'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { Account, Institution, PlanDraft } from '@/books/tradebook/types'
import { inMemoryBooks } from '../../../tests/support/trade-book'

// S1.9.T2.1 — PlanEntryForm and CloseForm no longer hand-roll prompt widgets;
// both render through the shared PromptFields (already used by WalkCheckpoint,
// NewEntryPage, SettleForm, AddendumForm). No behaviour change: S1.2's and
// S1.4's own specs still pass untouched.

async function seededJournal(): Promise<Journal> {
  const { tradeBook, journal } = inMemoryBooks()
  await new Workspace(tradeBook, journal).ensureSeeded()
  return journal
}

async function flatTrade(): Promise<{ book: TradeBook; journal: Journal; id: string }> {
  const { tradeBook: book, journal } = inMemoryBooks()
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  await new Workspace(book, journal).ensureSeeded()
  const draft: PlanDraft = {
    accountId: account.id,
    thesis: 'AAPL breaks out',
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 }],
    exitLevels: [],
    plannedAt: '2026-07-10',
  }
  const id = await book.confirmPlan(draft)
  const first = await book.recordExecution(
    { tradeId: id, newLeg: 'AAPL' },
    { side: 'buy', qty: 100, price: 15000, fees: 100, timestamp: Date.now() },
  )
  await book.recordExecution(
    { tradeId: id, legId: first.record.legs[0].id },
    { side: 'sell', qty: 100, price: 16800, fees: 100, timestamp: Date.now() },
  )
  return { book, journal, id }
}

describe('PromptFields adoption', () => {
  it("renders the plan entry form's prompts through PromptFields", async () => {
    const journal = await seededJournal()
    render(
      <JournalContext.Provider value={journal}>
        <PlanEntryForm tradeId="t1" onDone={() => {}} />
      </JournalContext.Provider>,
    )

    // PromptFields' migration deltas: textarea rows 2 (was 3), and the scale
    // radio group's name carries the namespace prefix.
    const why = (await screen.findByLabelText('Why this trade, why now?')) as HTMLTextAreaElement
    expect(why.rows).toBe(2)
    const radio = screen.getByRole('radio', { name: '4' }) as HTMLInputElement
    expect(radio.name).toBe('plan-entry-conviction')
  })

  it("renders the close form's prompts through PromptFields", async () => {
    const { book, journal, id } = await flatTrade()
    render(
      <TradeBookContext.Provider value={book}>
        <JournalContext.Provider value={journal}>
          <CloseForm tradeId={id} onDone={() => {}} onDismiss={() => {}} />
        </JournalContext.Provider>
      </TradeBookContext.Provider>,
    )

    const worked = (await screen.findByLabelText(/what worked.*didn.?t/i)) as HTMLTextAreaElement
    expect(worked.rows).toBe(2)
  })

  it('renders a scale prompt on the close form (previously dropped)', async () => {
    const { book, journal, id } = await flatTrade()
    const closeType = (await journal.entryTypes.list()).find((t) => t.designatedFor === 'close')!
    await journal.entryTypes.save({
      ...closeType,
      prompts: [
        ...closeType.prompts,
        { id: 'satisfaction', text: 'Satisfaction', kind: 'scale', scale: { min: 1, max: 3 } },
      ],
    })

    render(
      <TradeBookContext.Provider value={book}>
        <JournalContext.Provider value={journal}>
          <CloseForm tradeId={id} onDone={() => {}} onDismiss={() => {}} />
        </JournalContext.Provider>
      </TradeBookContext.Provider>,
    )

    expect(await screen.findByText('Satisfaction')).toBeInTheDocument()
    const fieldset = screen.getByText('Satisfaction').closest('fieldset')!
    expect(within(fieldset).getAllByRole('radio')).toHaveLength(3)
  })

  it('keeps two forms on one page from sharing a radio group', async () => {
    const { book, journal, id } = await flatTrade()
    render(
      <TradeBookContext.Provider value={book}>
        <JournalContext.Provider value={journal}>
          <PlanEntryForm tradeId="t2" onDone={() => {}} />
          <CloseForm tradeId={id} onDone={() => {}} onDismiss={() => {}} />
        </JournalContext.Provider>
      </TradeBookContext.Provider>,
    )

    const convictionRadios = await screen.findAllByRole('radio', { name: '4' })
    expect(convictionRadios).toHaveLength(1) // only PlanEntryForm's Conviction scale
    const names = convictionRadios.map((r) => (r as HTMLInputElement).name)
    expect(new Set(names).size).toBe(names.length)
    expect(names[0]).toBe('plan-entry-conviction')
  })
})
