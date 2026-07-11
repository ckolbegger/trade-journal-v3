import { describe, it, expect } from 'vitest'
import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { Workspace, CLOSE_ENTRY_TYPE_ID } from '@/workspace/workspace'
import type { Account, ExecutionDraft, Institution, PlanDraft } from '@/books/tradebook/types'

const HIT_TARGET = { id: 'close-reason-hit-target', name: 'Hit Target' }
const NEVER_FILLED = { id: 'close-reason-never-filled', name: 'Never Filled' }

async function seededBook(
  dbName: string,
): Promise<{ book: TradeBook; journal: Journal; accountId: string }> {
  const binding = new DexieBinding(createDatabase(dbName))
  const book = new TradeBook(binding)
  const journal = new Journal(binding)
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  await new Workspace(book, journal).ensureSeeded()
  return { book, journal, accountId: account.id }
}

function draft(accountId: string): PlanDraft {
  return {
    accountId,
    thesis: 'AAPL breaks out',
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 }],
    exitLevels: [],
    plannedAt: '2026-07-10',
  }
}

const buy100: ExecutionDraft = {
  side: 'buy',
  qty: 100,
  price: 15000,
  fees: 100,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
}
const sell100: ExecutionDraft = {
  side: 'sell',
  qty: 100,
  price: 16800,
  fees: 100,
  timestamp: new Date('2026-07-11T12:00:00').getTime(),
}

describe('close over Dexie', () => {
  it('round-trips a flattened Trade as closed with reason and close entry', async () => {
    const dbName = 'close-' + crypto.randomUUID()
    const { book, journal, accountId } = await seededBook(dbName)
    const tradeId = await book.confirmPlan(draft(accountId))
    const first = await book.recordExecution({ tradeId, newLeg: 'AAPL' }, buy100)
    await book.recordExecution({ tradeId, legId: first.record.legs[0].id }, sell100)
    await book.setCloseReason(tradeId, HIT_TARGET)
    await journal.write({
      anchor: { kind: 'close', tradeId },
      entryTypeId: CLOSE_ENTRY_TYPE_ID,
      at: Date.now(),
      placeholder: false,
      answers: [{ promptId: 'lesson', value: 'Let winners run' }],
    })

    const reopened = new DexieBinding(createDatabase(dbName))
    const book2 = new TradeBook(reopened)
    const journal2 = new Journal(reopened)

    expect((await book2.query({ status: 'closed' })).map((t) => t.id)).toEqual([tradeId])
    const restored = await book2.get(tradeId)
    expect(restored.closeReason).toEqual(HIT_TARGET)

    const entries = await journal2.entriesFor({ trade: tradeId })
    const closeEntry = entries.find((e) => e.anchor.kind === 'close')
    expect(closeEntry?.answered.find((a) => a.prompt.id === 'lesson')?.answer?.value).toBe(
      'Let winners run',
    )
  })

  it('round-trips an abandoned planned Trade as closed with Never Filled', async () => {
    const dbName = 'abandon-' + crypto.randomUUID()
    const { book, accountId } = await seededBook(dbName)
    const tradeId = await book.confirmPlan(draft(accountId))
    await book.setCloseReason(tradeId, NEVER_FILLED)

    const book2 = new TradeBook(new DexieBinding(createDatabase(dbName)))

    expect((await book2.query({ status: 'closed' })).map((t) => t.id)).toEqual([tradeId])
    const restored = await book2.get(tradeId)
    expect(restored.closeReason).toEqual(NEVER_FILLED)
    expect(restored.legs).toEqual([])
  })
})
