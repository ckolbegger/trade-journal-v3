import { describe, it, expect } from 'vitest'
import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { Workspace, TRADER_REFLECTION_ENTRY_TYPE_ID } from '@/workspace/workspace'
import type { Entry } from '@/books/journal/types'

// Standalone writing isn't anchored to any Trade, so — unlike the plan-journal
// round-trip — this reads the persisted record directly off the reopened
// binding rather than through entriesFor({trade}), which is Trade-scoped only
// (docs/design/journal.md).

describe('standalone journal entry over Dexie', () => {
  it('round-trips a written Trader Reflection with its snapshot intact after reopen', async () => {
    const dbName = 'standalone-journal-' + crypto.randomUUID()
    const binding = new DexieBinding(createDatabase(dbName))
    const tradeBook = new TradeBook(binding)
    const journal = new Journal(binding)
    await new Workspace(tradeBook, journal).ensureSeeded()

    await journal.write({
      anchor: { kind: 'standalone' },
      entryTypeId: TRADER_REFLECTION_ENTRY_TYPE_ID,
      at: 1_700_000_000_000,
      placeholder: false,
      answers: [
        { promptId: 'mind', value: 'Market feels frothy today' },
        { promptId: 'emotion', value: 'anxious' },
        { promptId: 'energy', value: 3 },
      ],
    })

    const reopened = new DexieBinding(createDatabase(dbName))
    const entries = await reopened.list<Entry>('entries')

    expect(entries).toHaveLength(1)
    const entry = entries[0]
    expect(entry.anchor).toEqual({ kind: 'standalone' })
    expect(entry.placeholder).toBe(false)
    expect(entry.at).toBe(1_700_000_000_000)
    expect(entry.answered.map((a) => a.prompt.id)).toEqual(['mind', 'emotion', 'energy'])
    expect(entry.answered.find((a) => a.prompt.id === 'mind')?.answer?.value).toBe(
      'Market feels frothy today',
    )
    expect(entry.answered.find((a) => a.prompt.id === 'emotion')?.answer?.value).toBe('anxious')
    expect(entry.answered.find((a) => a.prompt.id === 'energy')?.answer?.value).toBe(3)
  })
})
