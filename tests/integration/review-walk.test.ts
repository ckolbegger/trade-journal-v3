import { describe, it, expect } from 'vitest'
import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { PriceBook } from '@/books/pricebook/price-book'
import { Workspace, REVIEW_ENTRY_TYPE_ID } from '@/workspace/workspace'
import { Valuations } from '@/coordinators/valuations'
import { Review } from '@/coordinators/review'
import type { Account, ExecutionDraft, Institution, PlanDraft } from '@/books/tradebook/types'

// A whole Daily Review session over Dexie: two open Trades (the MSFT one owes its
// plan journal), the trader fills the missing Marks, records an Action on each,
// and settles the debt. Everything the session produced must survive a reopen —
// the review entries are the only record that a Trade was reviewed (ADR 0005).

const FRIDAY = '2026-07-10'
const MONDAY = '2026-07-13'
const TUESDAY = '2026-07-14'
const WEDNESDAY = '2026-07-15'

const buy100: ExecutionDraft = {
  side: 'buy',
  qty: 100,
  price: 15000,
  fees: 100,
  timestamp: new Date(`${FRIDAY}T12:00:00`).getTime(),
}

function draft(accountId: string, ticker: string): PlanDraft {
  return {
    accountId,
    thesis: `${ticker} breaks out`,
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker }, qty: 100 }],
    exitLevels: [],
    plannedAt: FRIDAY,
  }
}

function books(dbName: string) {
  const binding = new DexieBinding(createDatabase(dbName))
  const tradeBook = new TradeBook(binding)
  const journal = new Journal(binding)
  const priceBook = new PriceBook(binding)
  const review = new Review(new Valuations(tradeBook, priceBook), journal, tradeBook)
  return { tradeBook, journal, priceBook, review }
}

async function seedSession(dbName: string): Promise<{ aapl: string; msft: string; owed: string }> {
  const { tradeBook, journal, priceBook } = books(dbName)

  const institution = { id: '', name: 'Schwab' } as Institution
  await tradeBook.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await tradeBook.registries.accounts.save(account)
  await new Workspace(tradeBook, journal).ensureSeeded()

  const aapl = await tradeBook.confirmPlan(draft(account.id, 'AAPL'))
  await tradeBook.recordExecution({ tradeId: aapl, newLeg: 'AAPL' }, buy100)
  const msft = await tradeBook.confirmPlan(draft(account.id, 'MSFT'))
  await tradeBook.recordExecution({ tradeId: msft, newLeg: 'MSFT' }, buy100)

  // AAPL was marked Monday; MSFT never was. The MSFT plan journal was skipped.
  await priceBook.record('AAPL', MONDAY, 16000, 'manual')
  const planType = (await journal.entryTypes.list()).find((t) => t.designatedFor === 'plan')!
  const owed = await journal.write({
    anchor: { kind: 'plan', tradeId: msft },
    entryTypeId: planType.id,
    at: new Date(`${FRIDAY}T11:00:00`).getTime(),
    answers: [],
    placeholder: true,
  })

  return { aapl, msft, owed }
}

describe('the Daily Review walk over Dexie', () => {
  it('records Marks, Actions and settlement in one session — and reopens caught up', async () => {
    const dbName = 'review-walk-' + crypto.randomUUID()
    const { aapl, msft, owed } = await seedSession(dbName)

    // ——— the session ———
    const session = books(dbName)
    const agenda = await session.review.agenda(WEDNESDAY)
    expect(agenda.journalDebt.map((e) => e.id)).toEqual([owed])

    const walk = await session.review.walk(WEDNESDAY)
    expect(walk.map((i) => i.tradeId)).toEqual([aapl, msft]) // insertion order
    expect(walk.map((i) => i.reviewedToday)).toEqual([false, false])
    expect(walk.map((i) => i.outstandingDebt)).toEqual([0, 1])

    // Per checkpoint: fill THIS Trade's missing Marks, then record the Action.
    for (const item of walk) {
      const needed = agenda.marksNeeded.find((m) => m.tradeId === item.tradeId)!
      const missing = await session.priceBook.missingMarks(needed.instruments, needed.range)
      for (const row of missing) {
        await session.priceBook.record(row.instrument, row.date, 16000, 'manual')
      }
      await session.journal.write({
        anchor: { kind: 'review', date: WEDNESDAY, tradeId: item.tradeId },
        entryTypeId: REVIEW_ENTRY_TYPE_ID,
        at: new Date(`${WEDNESDAY}T18:00:00`).getTime(),
        answers: [
          { promptId: 'action', value: 'Hold' },
          { promptId: 'conviction', value: 4 },
        ],
        placeholder: false,
      })
    }
    // The MSFT plan journal is settled at its checkpoint.
    await session.journal.settle(owed, [
      { promptId: 'why', value: 'Cloud reacceleration' },
      { promptId: 'invalidates', value: 'Close back below 380' },
      { promptId: 'conviction', value: 3 },
      { promptId: 'emotion', value: 'calm' },
    ])

    // ——— reopen the database ———
    const next = books(dbName)

    const entries = await next.journal.entriesFor({ trade: aapl })
    const reviewEntry = entries.find((e) => e.anchor.kind === 'review')!
    expect(reviewEntry.anchor).toEqual({ kind: 'review', date: WEDNESDAY, tradeId: aapl })
    expect(reviewEntry.answered.find((a) => a.prompt.id === 'action')?.answer?.value).toBe('Hold')

    const walkAgain = await next.review.walk(WEDNESDAY)
    expect(walkAgain.map((i) => i.reviewedToday)).toEqual([true, true])
    expect(walkAgain.map((i) => i.outstandingDebt)).toEqual([0, 0])

    // The settled placeholder keeps both timestamps — late journaling stays visible.
    const settled = (await next.journal.entriesFor({ trade: msft })).find((e) => e.id === owed)!
    expect(settled.at).toBe(new Date(`${FRIDAY}T11:00:00`).getTime())
    expect(settled.settledAt).toBeDefined()
    expect(settled.answered.find((a) => a.prompt.id === 'why')?.answer?.value).toBe(
      'Cloud reacceleration',
    )
    expect(await next.journal.outstandingDebt()).toEqual([])

    // Re-running the agenda: nothing left to collect, nothing owed. Tuesday is
    // interior history now that Wednesday is marked.
    const after = await next.review.agenda(WEDNESDAY)
    expect(after.marksNeeded).toEqual([])
    expect(after.journalDebt).toEqual([])
    expect(await next.priceBook.markSet(['AAPL', 'MSFT'], TUESDAY)).toHaveProperty('size', 2)
  })
})
