import { describe, it, expect } from 'vitest'
import { InMemoryBinding } from '@/storage/in-memory-binding'
import { valuation } from '@/domain/trademath/valuation'
import { TradeBook } from './trade-book'
import type { Account, ExecutionDraft, Institution, PlanDraft, Side } from './types'

async function bookWithPlan(): Promise<{ book: TradeBook; tradeId: string }> {
  const book = new TradeBook(new InMemoryBinding())
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  const draft: PlanDraft = {
    accountId: account.id,
    thesis: 'AAPL breaks out',
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 }],
    exitLevels: [],
    plannedAt: '2026-07-10',
  }
  const tradeId = await book.confirmPlan(draft)
  return { book, tradeId }
}

function fill(overrides: Partial<ExecutionDraft> = {}): ExecutionDraft {
  return {
    side: 'buy',
    qty: 100,
    price: 15000,
    fees: 100,
    timestamp: new Date('2026-07-10T12:00:00').getTime(),
    ...overrides,
  }
}

describe('TradeBook.recordExecution', () => {
  it('appends an Execution to a new Leg on first fill', async () => {
    const { book, tradeId } = await bookWithPlan()
    const outcome = await book.recordExecution({ tradeId, newLeg: 'AAPL' }, fill())
    expect(outcome.record.legs).toHaveLength(1)
    const leg = outcome.record.legs[0]
    expect(leg.instrument).toEqual({ kind: 'stock', ticker: 'AAPL' })
    expect(leg.executions).toHaveLength(1)
    expect(leg.executions[0]).toMatchObject({ side: 'buy', qty: 100, price: 15000, fees: 100 })
    const stored = await book.get(tradeId)
    expect(stored.legs[0].executions).toHaveLength(1)
  })

  it('appends the closing fill to the existing Leg of the same instrument', async () => {
    const { book, tradeId } = await bookWithPlan()
    const first = await book.recordExecution(
      { tradeId, newLeg: 'AAPL' },
      fill({ side: 'buy', qty: 100 }),
    )
    const legId = first.record.legs[0].id
    const outcome = await book.recordExecution({ tradeId, legId }, fill({ side: 'sell', qty: 100 }))
    expect(outcome.record.legs).toHaveLength(1)
    expect(outcome.record.legs[0].executions).toHaveLength(2)
    expect(outcome.record.legs[0].executions[1]).toMatchObject({ side: 'sell', qty: 100 })
  })

  it('rejects a target Trade that does not exist', async () => {
    const { book } = await bookWithPlan()
    await expect(
      book.recordExecution({ tradeId: 'nope', newLeg: 'AAPL' }, fill()),
    ).rejects.toThrow()
  })

  it('rejects zero or negative qty and negative price or fees', async () => {
    const { book, tradeId } = await bookWithPlan()
    await expect(
      book.recordExecution({ tradeId, newLeg: 'AAPL' }, fill({ qty: 0 })),
    ).rejects.toThrow()
    await expect(
      book.recordExecution({ tradeId, newLeg: 'AAPL' }, fill({ qty: -5 })),
    ).rejects.toThrow()
    await expect(
      book.recordExecution({ tradeId, newLeg: 'AAPL' }, fill({ price: -1 })),
    ).rejects.toThrow()
    await expect(
      book.recordExecution({ tradeId, newLeg: 'AAPL' }, fill({ fees: -1 })),
    ).rejects.toThrow()
  })

  it('returns nowFlat=false while quantity remains', async () => {
    const { book, tradeId } = await bookWithPlan()
    const outcome = await book.recordExecution(
      { tradeId, newLeg: 'AAPL' },
      fill({ side: 'buy', qty: 100 }),
    )
    expect(outcome.nowFlat).toBe(false)
  })

  it('returns nowFlat=true when the Execution nets the Trade to zero', async () => {
    const { book, tradeId } = await bookWithPlan()
    const first = await book.recordExecution(
      { tradeId, newLeg: 'AAPL' },
      fill({ side: 'buy', qty: 100 }),
    )
    const legId = first.record.legs[0].id
    const outcome = await book.recordExecution({ tradeId, legId }, fill({ side: 'sell', qty: 100 }))
    expect(outcome.nowFlat).toBe(true)
  })

  it('derives status open after the first fill (statusOf, never stored)', async () => {
    const { book, tradeId } = await bookWithPlan()
    await book.recordExecution({ tradeId, newLeg: 'AAPL' }, fill({ side: 'buy', qty: 100 }))
    expect((await book.query({ status: 'open' })).map((t) => t.id)).toEqual([tradeId])
    expect(await book.query({ status: 'planned' })).toEqual([])
  })

  it('always returns an empty newDeviations (detection arrives in Slice 9)', async () => {
    const { book, tradeId } = await bookWithPlan()
    const outcome = await book.recordExecution({ tradeId, newLeg: 'AAPL' }, fill())
    expect(outcome.newDeviations).toEqual([])
  })
})

// S5.2 partial close (docs/plan/slice-05-scaling.md): a fill that closes part
// of a Leg's position leaves the Trade open (nowFlat=false); only the fill
// that empties every Leg is nowFlat=true. A closing fill larger than what's
// held is rejected before it ever touches storage (no crossing zero).
describe('TradeBook.recordExecution (partial close)', () => {
  async function scaledInTrade(): Promise<{ book: TradeBook; tradeId: string; legId: string }> {
    const { book, tradeId } = await bookWithPlan()
    const first = await book.recordExecution(
      { tradeId, newLeg: 'AAPL' },
      fill({ side: 'buy', qty: 100 }),
    )
    const legId = first.record.legs[0].id
    await book.recordExecution({ tradeId, legId }, fill({ side: 'buy', qty: 100, price: 16000 }))
    return { book, tradeId, legId }
  }

  it('returns nowFlat=false after the partial sell of 120', async () => {
    const { book, tradeId, legId } = await scaledInTrade()
    const outcome = await book.recordExecution(
      { tradeId, legId },
      fill({ side: 'sell', qty: 120, price: 16500 }),
    )
    expect(outcome.nowFlat).toBe(false)
  })

  it('returns nowFlat=true only at the final sell', async () => {
    const { book, tradeId, legId } = await scaledInTrade()
    await book.recordExecution({ tradeId, legId }, fill({ side: 'sell', qty: 120, price: 16500 }))
    const outcome = await book.recordExecution(
      { tradeId, legId },
      fill({ side: 'sell', qty: 80, price: 17000 }),
    )
    expect(outcome.nowFlat).toBe(true)
  })

  it('rejects a close larger than held quantity (no crossing zero)', async () => {
    const { book, tradeId, legId } = await scaledInTrade()
    await book.recordExecution({ tradeId, legId }, fill({ side: 'sell', qty: 120, price: 16500 }))
    await expect(
      book.recordExecution({ tradeId, legId }, fill({ side: 'sell', qty: 81, price: 17000 })),
    ).rejects.toThrow(/80/)
    // The rejected Execution never persisted.
    const stored = await book.get(tradeId)
    expect(stored.legs[0].executions).toHaveLength(3)
  })
})

describe('ExecutionFacts.kind', () => {
  it("defaults absent kind to 'fill' when reading Slice 1 records", async () => {
    const binding = new InMemoryBinding()
    const book = new TradeBook(binding)
    const institution = { id: '', name: 'Schwab' } as Institution
    await book.registries.institutions.save(institution)
    const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
    await book.registries.accounts.save(account)

    // A Slice 1 record: written before `kind` existed on ExecutionFacts — no
    // migration runs, so storage genuinely has no such property.
    await binding.put('trades', {
      id: 'trade-legacy',
      accountId: account.id,
      plan: {
        thesis: 'AAPL breaks out',
        strategyId: 'strategy-long-stock',
        ideaSourceId: '',
        plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 }],
        exitLevels: [],
        plannedAt: '2026-07-10',
      },
      legs: [
        {
          id: 'leg-1',
          instrument: { kind: 'stock', ticker: 'AAPL' },
          executions: [
            { side: 'buy', qty: 100, price: 15000, fees: 100, timestamp: 1752177600000 },
          ],
        },
      ],
    })

    const viaGet = await book.get('trade-legacy')
    expect(viaGet.legs[0].executions[0].kind).toBe('fill')

    const viaQuery = await book.query({ status: 'open' })
    expect(viaQuery[0]?.legs[0].executions[0].kind).toBe('fill')
  })
})

describe("recordExecution (kind 'expire')", () => {
  async function bookWithOptionPlan(
    side: Side,
  ): Promise<{ book: TradeBook; tradeId: string; contract: string }> {
    const book = new TradeBook(new InMemoryBinding())
    const institution = { id: '', name: 'Schwab' } as Institution
    await book.registries.institutions.save(institution)
    const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
    await book.registries.accounts.save(account)
    const draft: PlanDraft = {
      accountId: account.id,
      thesis: 'XYZ range-bound',
      strategyId: side === 'sell' ? 'strategy-cash-secured-put' : 'strategy-long-call',
      ideaSourceId: '',
      plannedLegs: [
        {
          side,
          instrument: {
            kind: 'option',
            ticker: 'XYZ',
            expiration: '2026-08-21',
            type: side === 'sell' ? 'put' : 'call',
            strike: 10000,
          },
          qty: 1,
        },
      ],
      exitLevels: [],
      plannedAt: '2026-07-10',
    }
    const tradeId = await book.confirmPlan(draft)
    const type = side === 'sell' ? 'P' : 'C'
    return { book, tradeId, contract: `XYZ 2026-08-21 ${type} 100` }
  }

  it("closes the Leg quantity at price 0 with kind 'expire'", async () => {
    const { book, tradeId, contract } = await bookWithOptionPlan('buy')
    await book.recordExecution(
      { tradeId, newLeg: contract },
      {
        side: 'buy',
        qty: 1,
        price: 1200,
        fees: 65,
        timestamp: new Date('2026-07-10T12:00:00').getTime(),
      },
    )
    const record = await book.get(tradeId)
    const legId = record.legs[0].id

    const outcome = await book.recordExecution(
      { tradeId, legId },
      {
        side: 'sell',
        qty: 1,
        price: 0,
        fees: 0,
        kind: 'expire',
        timestamp: new Date('2026-08-21T16:00:00').getTime(),
      },
    )

    const exec = outcome.record.legs[0].executions[1]
    expect(exec).toMatchObject({ side: 'sell', qty: 1, price: 0, kind: 'expire' })
  })

  it('realizes full premium as profit for a short Leg', async () => {
    const { book, tradeId, contract } = await bookWithOptionPlan('sell')
    await book.recordExecution(
      { tradeId, newLeg: contract },
      {
        side: 'sell',
        qty: 1,
        price: 250,
        fees: 65,
        timestamp: new Date('2026-07-10T12:00:00').getTime(),
      },
    )
    const record = await book.get(tradeId)
    const legId = record.legs[0].id

    const outcome = await book.recordExecution(
      { tradeId, legId },
      {
        side: 'buy',
        qty: 1,
        price: 0,
        fees: 0,
        kind: 'expire',
        timestamp: new Date('2026-08-21T16:00:00').getTime(),
      },
    )

    const v = valuation(outcome.record, new Map())
    expect(v.realizedPnL).toBe(24935) // 250.00 credit − 0.65 fees = 249.35 profit
  })

  it('realizes full premium as loss for a long Leg', async () => {
    const { book, tradeId, contract } = await bookWithOptionPlan('buy')
    await book.recordExecution(
      { tradeId, newLeg: contract },
      {
        side: 'buy',
        qty: 1,
        price: 1200,
        fees: 65,
        timestamp: new Date('2026-07-10T12:00:00').getTime(),
      },
    )
    const record = await book.get(tradeId)
    const legId = record.legs[0].id

    const outcome = await book.recordExecution(
      { tradeId, legId },
      {
        side: 'sell',
        qty: 1,
        price: 0,
        fees: 0,
        kind: 'expire',
        timestamp: new Date('2026-08-21T16:00:00').getTime(),
      },
    )

    const v = valuation(outcome.record, new Map())
    expect(v.realizedPnL).toBe(-120065) // -1200.00 premium − 0.65 fees = -1200.65 loss
  })

  it('returns nowFlat=true when expiration empties the Trade', async () => {
    const { book, tradeId, contract } = await bookWithOptionPlan('sell')
    await book.recordExecution(
      { tradeId, newLeg: contract },
      {
        side: 'sell',
        qty: 1,
        price: 250,
        fees: 65,
        timestamp: new Date('2026-07-10T12:00:00').getTime(),
      },
    )
    const record = await book.get(tradeId)
    const legId = record.legs[0].id

    const outcome = await book.recordExecution(
      { tradeId, legId },
      {
        side: 'buy',
        qty: 1,
        price: 0,
        fees: 0,
        kind: 'expire',
        timestamp: new Date('2026-08-21T16:00:00').getTime(),
      },
    )

    expect(outcome.nowFlat).toBe(true)
  })
})

// Assignment/exercise (docs/plan/slice-03-single-leg-options.md, S3.4): ONE
// recordExecution call closes the option Leg at 0 (kind assign/exercise) AND
// opens the paired stock Leg at the strike, in the SAME Trade. Both mutations
// land in the one TradeRecord document the call's single `put` persists.
describe('recordExecution (assign)', () => {
  async function bookWithShortPut(
    openFees = 0,
  ): Promise<{ book: TradeBook; tradeId: string; legId: string }> {
    const book = new TradeBook(new InMemoryBinding())
    const institution = { id: '', name: 'Schwab' } as Institution
    await book.registries.institutions.save(institution)
    const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
    await book.registries.accounts.save(account)
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
            expiration: '2026-08-21',
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
    const outcome = await book.recordExecution(
      { tradeId, newLeg: 'XYZ 2026-08-21 P 100' },
      {
        side: 'sell',
        qty: 1,
        price: 250,
        fees: openFees,
        timestamp: new Date('2026-07-10T12:00:00').getTime(),
      },
    )
    return { book, tradeId, legId: outcome.record.legs[0].id }
  }

  function assignExec(fees = 0): ExecutionDraft {
    return {
      side: 'buy',
      qty: 1,
      price: 0,
      fees,
      kind: 'assign',
      timestamp: new Date('2026-08-21T16:00:00').getTime(),
    }
  }

  it('closes the short put Leg at 0 and opens a buy of 100 shares at the 100 strike in the same Trade', async () => {
    const { book, tradeId, legId } = await bookWithShortPut()
    const outcome = await book.recordExecution({ tradeId, legId }, assignExec())

    expect(outcome.record.legs).toHaveLength(2)
    const [optionLeg, stockLeg] = outcome.record.legs
    expect(optionLeg.executions[1]).toMatchObject({ side: 'buy', qty: 1, price: 0, kind: 'assign' })
    expect(stockLeg.instrument).toEqual({ kind: 'stock', ticker: 'XYZ' })
    expect(stockLeg.executions).toEqual([
      {
        side: 'buy',
        qty: 100,
        price: 10000,
        fees: 0,
        kind: 'fill',
        timestamp: new Date('2026-08-21T16:00:00').getTime(),
      },
    ])
  })

  it('commits both Executions in one transaction (neither exists alone after a failure)', async () => {
    const { book, tradeId } = await bookWithPlan() // a stock Trade — assign is invalid on a stock Leg
    const first = await book.recordExecution(
      { tradeId, newLeg: 'AAPL' },
      fill({ side: 'buy', qty: 100 }),
    )
    const legId = first.record.legs[0].id

    await expect(
      book.recordExecution({ tradeId, legId }, { ...assignExec(), qty: 100 }),
    ).rejects.toThrow()

    const record = await book.get(tradeId)
    expect(record.legs).toHaveLength(1)
    expect(record.legs[0].executions).toHaveLength(1) // the bogus assign-close never persisted
  })

  it('leaves the Trade open (nowFlat=false) holding the stock', async () => {
    const { book, tradeId, legId } = await bookWithShortPut()
    const outcome = await book.recordExecution({ tradeId, legId }, assignExec())
    expect(outcome.nowFlat).toBe(false)
  })

  it('realizes the full 250.00 credit on the option Leg', async () => {
    const { book, tradeId, legId } = await bookWithShortPut()
    const outcome = await book.recordExecution({ tradeId, legId }, assignExec())
    const v = valuation(
      outcome.record,
      new Map([['XYZ', { instrument: 'XYZ', date: '2026-08-21', price: 10000, origin: 'manual' }]]),
    )
    expect(v.perLeg[0].realized).toBe(25000) // 250.00, no fees on this fixture
  })
})

describe('recordExecution (exercise)', () => {
  it('closes the long call Leg at 0 and opens a buy of 100 shares at the strike', async () => {
    const book = new TradeBook(new InMemoryBinding())
    const institution = { id: '', name: 'Schwab' } as Institution
    await book.registries.institutions.save(institution)
    const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
    await book.registries.accounts.save(account)
    const draft: PlanDraft = {
      accountId: account.id,
      thesis: 'XYZ breaks out',
      strategyId: 'strategy-long-call',
      ideaSourceId: '',
      plannedLegs: [
        {
          side: 'buy',
          instrument: {
            kind: 'option',
            ticker: 'XYZ',
            expiration: '2026-08-21',
            type: 'call',
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
      { tradeId, newLeg: 'XYZ 2026-08-21 C 100' },
      {
        side: 'buy',
        qty: 1,
        price: 1200,
        fees: 0,
        timestamp: new Date('2026-07-10T12:00:00').getTime(),
      },
    )
    const legId = opened.record.legs[0].id

    const outcome = await book.recordExecution(
      { tradeId, legId },
      {
        side: 'sell',
        qty: 1,
        price: 0,
        fees: 0,
        kind: 'exercise',
        timestamp: new Date('2026-08-21T16:00:00').getTime(),
      },
    )

    expect(outcome.record.legs).toHaveLength(2)
    const stockLeg = outcome.record.legs[1]
    expect(stockLeg.instrument).toEqual({ kind: 'stock', ticker: 'XYZ' })
    expect(stockLeg.executions[0]).toMatchObject({ side: 'buy', qty: 100, price: 10000 })
  })

  // The SELL branch of the direction rule: a long PUT exercised delivers stock
  // (the holder sells at the strike), opening a SHORT stock Leg — unlike the
  // long call above, which buys. Long Put is a seeded strategy (S3.1) and the
  // agenda offers "Exercised" for any long expired leg, so this path is
  // reachable today even though this slice's worked examples never book it.
  it('closes the long put Leg at 0 and opens a sell of 100 shares at the strike', async () => {
    const book = new TradeBook(new InMemoryBinding())
    const institution = { id: '', name: 'Schwab' } as Institution
    await book.registries.institutions.save(institution)
    const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
    await book.registries.accounts.save(account)
    const draft: PlanDraft = {
      accountId: account.id,
      thesis: 'XYZ breaks down',
      strategyId: 'strategy-long-put',
      ideaSourceId: '',
      plannedLegs: [
        {
          side: 'buy',
          instrument: {
            kind: 'option',
            ticker: 'XYZ',
            expiration: '2026-08-21',
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
      { tradeId, newLeg: 'XYZ 2026-08-21 P 100' },
      {
        side: 'buy',
        qty: 1,
        price: 1200,
        fees: 0,
        timestamp: new Date('2026-07-10T12:00:00').getTime(),
      },
    )
    const legId = opened.record.legs[0].id

    const outcome = await book.recordExecution(
      { tradeId, legId },
      {
        side: 'sell',
        qty: 1,
        price: 0,
        fees: 0,
        kind: 'exercise',
        timestamp: new Date('2026-08-21T16:00:00').getTime(),
      },
    )

    expect(outcome.record.legs).toHaveLength(2)
    const stockLeg = outcome.record.legs[1]
    expect(stockLeg.instrument).toEqual({ kind: 'stock', ticker: 'XYZ' })
    // 100 shares (contract multiplier) at the 100.00 strike (10000 cents).
    expect(stockLeg.executions[0]).toMatchObject({ side: 'sell', qty: 100, price: 10000 })
  })
})

describe('valuation after assignment', () => {
  async function assignedTrade(): Promise<ReturnType<typeof valuation>> {
    const book = new TradeBook(new InMemoryBinding())
    const institution = { id: '', name: 'Schwab' } as Institution
    await book.registries.institutions.save(institution)
    const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
    await book.registries.accounts.save(account)
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
            expiration: '2026-08-21',
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
      { tradeId, newLeg: 'XYZ 2026-08-21 P 100' },
      {
        side: 'sell',
        qty: 1,
        price: 250,
        fees: 65,
        timestamp: new Date('2026-07-10T12:00:00').getTime(),
      },
    )
    const legId = opened.record.legs[0].id
    const outcome = await book.recordExecution(
      { tradeId, legId },
      {
        side: 'buy',
        qty: 1,
        price: 0,
        fees: 65,
        kind: 'assign',
        timestamp: new Date('2026-08-21T16:00:00').getTime(),
      },
    )
    const marks = new Map([
      ['XYZ', { instrument: 'XYZ', date: '2026-08-22', price: 9700, origin: 'manual' as const }],
    ])
    return valuation(outcome.record, marks)
  }

  it('carries strike-based stock basis: XYZ marked 97 shows -300.00 unrealized on the stock Leg', async () => {
    const v = await assignedTrade()
    const stockLeg = v.perLeg.find((l) => l.instrument.kind === 'stock')!
    expect(stockLeg.basis).toBe(1000000) // 10,000.00
    expect(stockLeg.unrealized).toBe(-30000) // -300.00
  })

  it('shows Trade totalPnL as option credit plus stock unrealized (-51.30 with fees at mark 97)', async () => {
    const v = await assignedTrade()
    expect(v.totalPnL).toBe(-5130)
  })
})
