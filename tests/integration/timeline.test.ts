import { describe, it, expect } from 'vitest'
import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import {
  Workspace,
  PLAN_ENTRY_TYPE_ID,
  CLOSE_ENTRY_TYPE_ID,
  REVIEW_ENTRY_TYPE_ID,
  TRADER_REFLECTION_ENTRY_TYPE_ID,
} from '@/workspace/workspace'
import type { Account, Institution, PlanDraft } from '@/books/tradebook/types'

// A full lifecycle — plan, close, review, and a standalone reflection — over
// Dexie, read back through Journal.timeline: all four in 'at' order, and a
// narrower range excludes the ones outside it.

async function seededTrade(dbName: string): Promise<{
  tradeBook: TradeBook
  journal: Journal
  tradeId: string
}> {
  const binding = new DexieBinding(createDatabase(dbName))
  const tradeBook = new TradeBook(binding)
  const journal = new Journal(binding)
  await new Workspace(tradeBook, journal).ensureSeeded()

  const institution = { id: '', name: 'Schwab' } as Institution
  await tradeBook.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await tradeBook.registries.accounts.save(account)

  const draft: PlanDraft = {
    accountId: account.id,
    thesis: 'AAPL breaks out',
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 }],
    exitLevels: [
      { scope: { level: 'trade' }, side: 'stop', kind: 'underlyingPrice', price: 14000 },
      { scope: { level: 'trade' }, side: 'target', kind: 'underlyingPrice', price: 17000 },
    ],
    plannedAt: '2026-07-01',
  }
  const tradeId = await tradeBook.confirmPlan(draft)
  return { tradeBook, journal, tradeId }
}

describe('journal timeline over Dexie', () => {
  it('returns a seeded lifecycle (plan, close, review, standalone) in order; range narrows correctly', async () => {
    const dbName = 'timeline-' + crypto.randomUUID()
    const { tradeBook, journal, tradeId } = await seededTrade(dbName)

    await journal.write({
      anchor: { kind: 'plan', tradeId },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: new Date('2026-07-01T12:00:00').getTime(),
      placeholder: false,
      answers: [{ promptId: 'why', value: 'Breakout confirmed on volume' }],
    })

    const legId = (
      await tradeBook.recordExecution(
        { tradeId, newLeg: 'AAPL' },
        {
          side: 'buy',
          qty: 100,
          price: 15000,
          fees: 100,
          timestamp: new Date('2026-07-01T13:00:00').getTime(),
        },
      )
    ).record.legs[0].id
    await tradeBook.recordExecution(
      { tradeId, legId },
      {
        side: 'sell',
        qty: 100,
        price: 16800,
        fees: 100,
        timestamp: new Date('2026-07-02T13:00:00').getTime(),
      },
    )
    await tradeBook.setCloseReason(tradeId, {
      id: 'close-reason-hit-target',
      name: 'Hit Target',
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

    const reopened = new Journal(new DexieBinding(createDatabase(dbName)))
    const timeline = await reopened.timeline()

    expect(timeline).toHaveLength(4)
    expect(timeline.map((e) => e.anchor.kind)).toEqual(['plan', 'close', 'review', 'standalone'])

    const narrowed = await reopened.timeline({ from: '2026-07-02', to: '2026-07-03' })
    expect(narrowed.map((e) => e.anchor.kind)).toEqual(['close', 'review'])
  })
})
