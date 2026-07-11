import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlanEntryForm } from './PlanEntryForm'
import { JournalContext } from '../journalContext'
import type { Journal } from '@/books/journal/journal'
import { Workspace } from '@/workspace/workspace'
import { inMemoryBooks } from '../../../tests/support/trade-book'

async function seededJournal(): Promise<Journal> {
  const { tradeBook, journal } = inMemoryBooks()
  await new Workspace(tradeBook, journal).ensureSeeded()
  return journal
}

function renderForm(journal: Journal, onDone = () => {}) {
  return render(
    <JournalContext.Provider value={journal}>
      <PlanEntryForm tradeId="t1" onDone={onDone} />
    </JournalContext.Provider>,
  )
}

describe('PlanEntryForm', () => {
  it('renders all four seeded prompts with the right widget kinds', async () => {
    const journal = await seededJournal()
    renderForm(journal)

    expect(await screen.findByLabelText('Why this trade, why now?')).toBeInTheDocument()
    expect(screen.getByLabelText('What invalidates the thesis?')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Emotional state' })).toBeInTheDocument()
    // Conviction 1..5 as a radio group.
    expect(screen.getAllByRole('radio')).toHaveLength(5)
    expect(screen.getByRole('radio', { name: '4' })).toBeInTheDocument()
  })

  it('writes a full entry anchored {kind:plan, tradeId}', async () => {
    const journal = await seededJournal()
    const onDone = vi.fn()
    renderForm(journal, onDone)
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('Why this trade, why now?'), 'Breakout confirmed')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Emotional state' }), 'calm')
    await user.click(screen.getByRole('radio', { name: '4' }))
    await user.click(screen.getByRole('button', { name: /write journal entry/i }))

    const entries = await journal.entriesFor({ trade: 't1' })
    expect(entries).toHaveLength(1)
    expect(entries[0].anchor).toEqual({ kind: 'plan', tradeId: 't1' })
    expect(entries[0].placeholder).toBe(false)
    expect(entries[0].answered.find((a) => a.prompt.id === 'conviction')?.answer?.value).toBe(4)
    expect(entries[0].answered.find((a) => a.prompt.id === 'emotion')?.answer?.value).toBe('calm')
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('writes a placeholder when skipped', async () => {
    const journal = await seededJournal()
    renderForm(journal)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /skip/i }))

    const entries = await journal.entriesFor({ trade: 't1' })
    expect(entries).toHaveLength(1)
    expect(entries[0].placeholder).toBe(true)
  })

  it('never blocks navigation away — skip is one click', async () => {
    const journal = await seededJournal()
    const onDone = vi.fn()
    renderForm(journal, onDone)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /skip/i }))

    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
