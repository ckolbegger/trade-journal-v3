import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewEntryPage } from './NewEntryPage'
import { JournalContext } from '../journalContext'
import type { Journal } from '@/books/journal/journal'
import { Workspace } from '@/workspace/workspace'
import { inMemoryBooks } from '../../../tests/support/trade-book'

async function seededJournal(): Promise<Journal> {
  const { tradeBook, journal } = inMemoryBooks()
  await new Workspace(tradeBook, journal).ensureSeeded()
  return journal
}

function renderPage(journal: Journal, onSaved = vi.fn()) {
  return render(
    <JournalContext.Provider value={journal}>
      <NewEntryPage onSaved={onSaved} />
    </JournalContext.Provider>,
  )
}

describe('NewEntryPage', () => {
  it('lists all non-archived Entry Types in the picker', async () => {
    const journal = await seededJournal()
    await journal.entryTypes.archive('entry-type-close')
    renderPage(journal)

    const picker = await screen.findByRole('combobox', { name: 'Entry Type' })
    const optionNames = Array.from(picker.querySelectorAll('option')).map((o) => o.textContent)

    expect(optionNames).toContain('Trader Reflection')
    expect(optionNames).toContain('Review Note')
    expect(optionNames).toContain('Plan')
    // The archived Close type is excluded.
    expect(optionNames).not.toContain('Close')
  })

  it("renders the picked type's prompt widgets", async () => {
    const journal = await seededJournal()
    renderPage(journal)
    const user = userEvent.setup()

    const picker = await screen.findByRole('combobox', { name: 'Entry Type' })
    await user.selectOptions(picker, 'Trader Reflection')

    expect(screen.getByLabelText("What's on your mind?")).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Current emotional state' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(5)
  })

  it('writes a standalone entry on save', async () => {
    const journal = await seededJournal()
    const onSaved = vi.fn()
    renderPage(journal, onSaved)
    const user = userEvent.setup()

    const picker = await screen.findByRole('combobox', { name: 'Entry Type' })
    await user.selectOptions(picker, 'Trader Reflection')
    await user.type(screen.getByLabelText("What's on your mind?"), 'Feeling steady today')
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Current emotional state' }),
      'calm',
    )
    await user.click(screen.getByRole('radio', { name: '3' }))
    await user.click(screen.getByRole('button', { name: /save entry/i }))

    expect(onSaved).toHaveBeenCalledTimes(1)
    const entries = await journal.timeline()
    expect(entries).toHaveLength(1)
    expect(entries[0].anchor).toEqual({ kind: 'standalone' })
    expect(entries[0].placeholder).toBe(false)
    expect(entries[0].answered.find((a) => a.prompt.id === 'mind')?.answer).toEqual({
      promptId: 'mind',
      value: 'Feeling steady today',
    })
  })

  it('offers no skip/placeholder path', async () => {
    const journal = await seededJournal()
    renderPage(journal)

    await screen.findByRole('combobox', { name: 'Entry Type' })
    expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument()
  })
})
