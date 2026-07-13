import { describe, it, expect } from 'vitest'
import { InMemoryBinding } from '@/storage/in-memory-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import {
  Workspace,
  LONG_STOCK_STRATEGY_ID,
  LONG_CALL_STRATEGY_ID,
  LONG_PUT_STRATEGY_ID,
  CASH_SECURED_PUT_STRATEGY_ID,
  PLAN_ENTRY_TYPE_ID,
  CLOSE_ENTRY_TYPE_ID,
  REVIEW_ENTRY_TYPE_ID,
  CLOSE_REASON_IDS,
  TRADER_REFLECTION_ENTRY_TYPE_ID,
  REVIEW_NOTE_ENTRY_TYPE_ID,
} from './workspace'

function makeWorkspace(): { workspace: Workspace; tradeBook: TradeBook; journal: Journal } {
  const binding = new InMemoryBinding()
  const tradeBook = new TradeBook(binding)
  const journal = new Journal(binding)
  return { workspace: new Workspace(tradeBook, journal), tradeBook, journal }
}

describe('Workspace.ensureSeeded — strategies', () => {
  it('seeds the Long Stock strategy into an empty registry', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await workspace.ensureSeeded()
    const strategies = await tradeBook.registries.strategies.list()
    // The full expected set, so an accidental extra seed can't slip in unnoticed.
    expect(strategies.map((s) => s.name)).toEqual([
      'Long Stock',
      'Long Call',
      'Long Put',
      'Cash-Secured Put',
    ])
    const longStock = strategies.find((s) => s.id === LONG_STOCK_STRATEGY_ID)
    expect(longStock?.name).toBe('Long Stock')
  })

  it('does not duplicate on a second run', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await workspace.ensureSeeded()
    await workspace.ensureSeeded()
    const strategies = await tradeBook.registries.strategies.list()
    expect(strategies.filter((s) => s.id === LONG_STOCK_STRATEGY_ID)).toHaveLength(1)
  })

  it('does not overwrite a seeded item the trader edited', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await workspace.ensureSeeded()
    const seeded = (await tradeBook.registries.strategies.list()).find(
      (s) => s.id === LONG_STOCK_STRATEGY_ID,
    )!
    await tradeBook.registries.strategies.save({ ...seeded, name: 'My Long Stock' })

    await workspace.ensureSeeded()

    const strategies = await tradeBook.registries.strategies.list()
    expect(strategies.find((s) => s.id === LONG_STOCK_STRATEGY_ID)?.name).toBe('My Long Stock')
  })

  it('does not resurrect a seeded item the trader archived', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await workspace.ensureSeeded()
    await tradeBook.registries.strategies.archive(LONG_STOCK_STRATEGY_ID)

    await workspace.ensureSeeded()

    expect(
      (await tradeBook.registries.strategies.list()).some((s) => s.id === LONG_STOCK_STRATEGY_ID),
    ).toBe(false)
    expect(
      (await tradeBook.registries.strategies.list(true)).filter(
        (s) => s.id === LONG_STOCK_STRATEGY_ID,
      ),
    ).toHaveLength(1)
  })
})

describe('Workspace.ensureSeeded — Plan Entry Type', () => {
  it('seeds the Plan Entry Type into an empty registry', async () => {
    const { workspace, journal } = makeWorkspace()
    await workspace.ensureSeeded()
    const plan = (await journal.entryTypes.list()).find((t) => t.id === PLAN_ENTRY_TYPE_ID)
    expect(plan?.name).toBe('Plan')
    expect(plan?.designatedFor).toBe('plan')
    expect(plan?.prompts.map((p) => p.kind)).toEqual(['text', 'text', 'scale', 'select'])
  })

  it('does not duplicate the Plan type on a second run', async () => {
    const { workspace, journal } = makeWorkspace()
    await workspace.ensureSeeded()
    await workspace.ensureSeeded()
    const plans = (await journal.entryTypes.list()).filter((t) => t.id === PLAN_ENTRY_TYPE_ID)
    expect(plans).toHaveLength(1)
  })

  it('does not overwrite a Plan Entry Type the trader edited', async () => {
    const { workspace, journal } = makeWorkspace()
    await workspace.ensureSeeded()
    const seeded = (await journal.entryTypes.list()).find((t) => t.id === PLAN_ENTRY_TYPE_ID)!
    await journal.entryTypes.save({ ...seeded, name: 'My Plan' })

    await workspace.ensureSeeded()

    const plan = (await journal.entryTypes.list()).find((t) => t.id === PLAN_ENTRY_TYPE_ID)
    expect(plan?.name).toBe('My Plan')
  })

  it('does not resurrect a Plan Entry Type the trader archived', async () => {
    const { workspace, journal } = makeWorkspace()
    await workspace.ensureSeeded()
    await journal.entryTypes.archive(PLAN_ENTRY_TYPE_ID)

    await workspace.ensureSeeded()

    expect((await journal.entryTypes.list()).some((t) => t.id === PLAN_ENTRY_TYPE_ID)).toBe(false)
    expect(
      (await journal.entryTypes.list(true)).filter((t) => t.id === PLAN_ENTRY_TYPE_ID),
    ).toHaveLength(1)
  })
})

describe('Workspace.ensureSeeded — Trade Review Entry Type', () => {
  it('seeds the Trade Review Entry Type with the Action list as its select options', async () => {
    const { workspace, journal } = makeWorkspace()
    await workspace.ensureSeeded()

    const review = (await journal.entryTypes.list()).find((t) => t.id === REVIEW_ENTRY_TYPE_ID)
    expect(review?.name).toBe('Trade Review')
    expect(review?.designatedFor).toBe('review')
    expect(review?.prompts.map((p) => p.kind)).toEqual(['select', 'scale', 'text'])
    // The Action select's options ARE the Action list — trader-configurable for
    // free, because editing the Entry Type edits the Actions (review.md).
    expect(review?.prompts[0].options).toEqual(['Hold', 'Exit Soon', 'Adjust', 'Watch Closely'])
  })

  it('does not duplicate the Trade Review type on a second run', async () => {
    const { workspace, journal } = makeWorkspace()
    await workspace.ensureSeeded()
    await workspace.ensureSeeded()
    const types = (await journal.entryTypes.list()).filter((t) => t.id === REVIEW_ENTRY_TYPE_ID)
    expect(types).toHaveLength(1)
  })

  it('does not overwrite a Trade Review type the trader edited', async () => {
    const { workspace, journal } = makeWorkspace()
    await workspace.ensureSeeded()
    const seeded = (await journal.entryTypes.list()).find((t) => t.id === REVIEW_ENTRY_TYPE_ID)!
    await journal.entryTypes.save({
      ...seeded,
      prompts: [{ ...seeded.prompts[0], options: ['Hold', 'Close it'] }],
    })

    await workspace.ensureSeeded()

    const review = (await journal.entryTypes.list()).find((t) => t.id === REVIEW_ENTRY_TYPE_ID)
    expect(review?.prompts[0].options).toEqual(['Hold', 'Close it'])
  })
})

describe('Workspace.ensureSeeded — Close Reasons and Close Entry Type', () => {
  it('seeds the five Close Reasons and the Close Entry Type iff absent', async () => {
    const { workspace, tradeBook, journal } = makeWorkspace()
    await workspace.ensureSeeded()

    const reasons = await tradeBook.registries.closeReasons.list()
    expect(reasons.map((r) => r.name)).toEqual([
      'Hit Target',
      'Hit Stop',
      'Thesis Invalidated',
      'Timed Out',
      'Never Filled',
    ])
    expect(reasons.map((r) => r.id)).toEqual(CLOSE_REASON_IDS)

    const close = (await journal.entryTypes.list()).find((t) => t.id === CLOSE_ENTRY_TYPE_ID)
    expect(close?.name).toBe('Close')
    expect(close?.designatedFor).toBe('close')
    expect(close?.prompts.map((p) => p.kind)).toEqual(['text', 'select', 'text'])
  })

  it('does not duplicate the Close Reasons on a second run', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await workspace.ensureSeeded()
    await workspace.ensureSeeded()
    expect(await tradeBook.registries.closeReasons.list()).toHaveLength(5)
  })

  it('does not overwrite a Close Reason the trader edited', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await workspace.ensureSeeded()
    const [seeded] = await tradeBook.registries.closeReasons.list()
    await tradeBook.registries.closeReasons.save({ ...seeded, name: 'Target Reached' })

    await workspace.ensureSeeded()

    const reasons = await tradeBook.registries.closeReasons.list()
    expect(reasons.find((r) => r.id === seeded.id)?.name).toBe('Target Reached')
    expect(reasons).toHaveLength(5)
  })

  it('does not resurrect a Close Reason the trader archived', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await workspace.ensureSeeded()
    await tradeBook.registries.closeReasons.archive(CLOSE_REASON_IDS[0])

    await workspace.ensureSeeded()

    expect(await tradeBook.registries.closeReasons.list()).toHaveLength(4)
    expect(await tradeBook.registries.closeReasons.list(true)).toHaveLength(5)
  })
})

describe('seeding (extension)', () => {
  it('seeds Long Call and Long Put iff absent', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await workspace.ensureSeeded()

    const strategies = await tradeBook.registries.strategies.list()
    const longCall = strategies.find((s) => s.id === LONG_CALL_STRATEGY_ID)
    const longPut = strategies.find((s) => s.id === LONG_PUT_STRATEGY_ID)

    expect(longCall?.name).toBe('Long Call')
    expect(longCall?.legs).toEqual([{ side: 'buy', instrumentKind: 'option', optionType: 'call' }])
    expect(longCall?.exitLevels).toEqual([
      { side: 'stop', kind: 'structureValue' },
      { side: 'target', kind: 'structureValue' },
    ])

    expect(longPut?.name).toBe('Long Put')
    expect(longPut?.legs).toEqual([{ side: 'buy', instrumentKind: 'option', optionType: 'put' }])
    expect(longPut?.exitLevels).toEqual([
      { side: 'stop', kind: 'structureValue' },
      { side: 'target', kind: 'structureValue' },
    ])

    // Not duplicated, and a trader edit survives a second seeding run.
    await tradeBook.registries.strategies.save({ ...longCall!, name: 'My Long Call' })
    await workspace.ensureSeeded()
    const again = await tradeBook.registries.strategies.list()
    expect(again.filter((s) => s.id === LONG_CALL_STRATEGY_ID)).toHaveLength(1)
    expect(again.find((s) => s.id === LONG_CALL_STRATEGY_ID)?.name).toBe('My Long Call')
  })

  it('seeds Cash-Secured Put iff absent', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await workspace.ensureSeeded()

    const strategies = await tradeBook.registries.strategies.list()
    const csp = strategies.find((s) => s.id === CASH_SECURED_PUT_STRATEGY_ID)

    expect(csp?.name).toBe('Cash-Secured Put')
    expect(csp?.legs).toEqual([{ side: 'sell', instrumentKind: 'option', optionType: 'put' }])
    expect(csp?.exitLevels).toEqual([
      { side: 'stop', kind: 'underlyingPrice' },
      { side: 'target', kind: 'pctOfMaxProfit' },
    ])

    await workspace.ensureSeeded()
    const again = await tradeBook.registries.strategies.list()
    expect(again.filter((s) => s.id === CASH_SECURED_PUT_STRATEGY_ID)).toHaveLength(1)
  })
})

describe('Workspace.ensureSeeded — Trader Reflection and Review Note Entry Types', () => {
  it('seeds Trader Reflection and Review Note iff absent', async () => {
    const { workspace, journal } = makeWorkspace()
    await workspace.ensureSeeded()

    const types = await journal.entryTypes.list()
    const reflection = types.find((t) => t.id === TRADER_REFLECTION_ENTRY_TYPE_ID)
    const reviewNote = types.find((t) => t.id === REVIEW_NOTE_ENTRY_TYPE_ID)

    expect(reflection?.name).toBe('Trader Reflection')
    expect(reflection?.designatedFor).toBeUndefined()
    expect(reflection?.prompts.map((p) => p.kind)).toEqual(['text', 'select', 'scale'])

    expect(reviewNote?.name).toBe('Review Note')
    expect(reviewNote?.designatedFor).toBeUndefined()
    expect(reviewNote?.prompts.map((p) => p.kind)).toEqual(['text', 'select'])

    // Running seeding again does not duplicate either type.
    await workspace.ensureSeeded()
    const again = await journal.entryTypes.list()
    expect(again.filter((t) => t.id === TRADER_REFLECTION_ENTRY_TYPE_ID)).toHaveLength(1)
    expect(again.filter((t) => t.id === REVIEW_NOTE_ENTRY_TYPE_ID)).toHaveLength(1)
  })
})
