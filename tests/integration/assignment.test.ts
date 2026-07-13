import { describe, it, expect } from 'vitest'
import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { Workspace } from '@/workspace/workspace'
import { valuation } from '@/domain/trademath/valuation'
import type { Account, Institution, PlanDraft } from '@/books/tradebook/types'

// An assigned cash-secured put over Dexie + fake-indexeddb
// (docs/plan/slice-03-single-leg-options.md, S3.4): recordExecution's single
// call closes the option Leg and opens the paired stock Leg atomically; both
// survive a reopen, the Trade stays open holding the stock, and selling it
// flattens the Trade into the ordinary Close Reason flow.

const EXPIRATION = '2026-08-21'
const CONTRACT = `XYZ ${EXPIRATION} P 100`

async function seedAssignedCsp(dbName: string): Promise<{ tradeId: string }> {
  const binding = new DexieBinding(createDatabase(dbName))
  const book = new TradeBook(binding)
  const journal = new Journal(binding)
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  await new Workspace(book, journal).ensureSeeded()

  const draft: PlanDraft = {
    accountId: account.id,
    thesis: 'XYZ range-bound',
    strategyId: 'strategy-cash-secured-put',
    ideaSourceId: '',
    plannedLegs: [
      {
        side: 'sell',
        instrument: {
          kind: 'option',
          ticker: 'XYZ',
          expiration: EXPIRATION,
          type: 'put',
          strike: 10000,
        },
        qty: 1,
      },
    ],
    exitLevels: [],
    plannedAt: '2026-07-10',
  }
  const tradeId = await book.confirmPlan(draft)
  const opened = await book.recordExecution(
    { tradeId, newLeg: CONTRACT },
    {
      side: 'sell',
      qty: 1,
      price: 250,
      fees: 65,
      timestamp: new Date('2026-07-10T12:00:00').getTime(),
    },
  )
  const legId = opened.record.legs[0].id

  await book.recordExecution(
    { tradeId, legId },
    {
      side: 'buy',
      qty: 1,
      price: 0,
      fees: 0,
      kind: 'assign',
      timestamp: new Date(`${EXPIRATION}T16:00:00`).getTime(),
    },
  )
  return { tradeId }
}

describe('assigned CSP over Dexie', () => {
  it('keeps both Legs after a reopen — option realized, stock strike basis, Trade open', async () => {
    const dbName = 'assignment-' + crypto.randomUUID()
    const { tradeId } = await seedAssignedCsp(dbName)

    const reopened = new TradeBook(new DexieBinding(createDatabase(dbName)))
    const record = await reopened.get(tradeId)

    expect(record.legs).toHaveLength(2)
    const [optionLeg, stockLeg] = record.legs
    expect(optionLeg.instrument.kind).toBe('option')
    expect(stockLeg.instrument).toEqual({ kind: 'stock', ticker: 'XYZ' })

    const open = await reopened.query({ status: 'open' })
    expect(open.map((t) => t.id)).toEqual([tradeId])

    const v = valuation(
      record,
      new Map([
        ['XYZ', { instrument: 'XYZ', date: EXPIRATION, price: 10000, origin: 'manual' as const }],
      ]),
    )
    expect(v.perLeg[0].realized).toBe(24935) // 250.00 credit − 0.65 open fee
    expect(v.perLeg[1].basis).toBe(1000000) // 10,000.00
  })

  it('sells the assigned stock, flattens, and takes a Close Reason', async () => {
    const dbName = 'assignment-' + crypto.randomUUID()
    const { tradeId } = await seedAssignedCsp(dbName)

    const sellBinding = new DexieBinding(createDatabase(dbName))
    const sellBook = new TradeBook(sellBinding)
    const record = await sellBook.get(tradeId)
    const stockLeg = record.legs[1]

    const outcome = await sellBook.recordExecution(
      { tradeId, legId: stockLeg.id },
      {
        side: 'sell',
        qty: 100,
        price: 9900,
        fees: 0,
        timestamp: new Date('2026-08-24T12:00:00').getTime(),
      },
    )
    expect(outcome.nowFlat).toBe(true)

    await sellBook.setCloseReason(tradeId, { id: 'close-reason-hit-target', name: 'Hit Target' })

    const finalBook = new TradeBook(new DexieBinding(createDatabase(dbName)))
    const closed = await finalBook.get(tradeId)
    expect(closed.closeReason?.name).toBe('Hit Target')
    const finalOpen = await finalBook.query({ status: 'open' })
    expect(finalOpen).toEqual([])
  })
})
