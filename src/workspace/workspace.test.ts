import { describe, it, expect } from 'vitest'
import { InMemoryBinding } from '@/storage/in-memory-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import {
  Workspace,
  LONG_STOCK_STRATEGY_ID,
  PLAN_ENTRY_TYPE_ID,
  CLOSE_ENTRY_TYPE_ID,
  REVIEW_ENTRY_TYPE_ID,
  CLOSE_REASON_IDS,
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
    expect(strategies.map((s) => s.name)).toEqual(['Long Stock'])
    expect(strategies[0].id).toBe(LONG_STOCK_STRATEGY_ID)
  })

  it('does not duplicate on a second run', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await workspace.ensureSeeded()
    await workspace.ensureSeeded()
    expect(await tradeBook.registries.strategies.list()).toHaveLength(1)
  })

  it('does not overwrite a seeded item the trader edited', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await workspace.ensureSeeded()
    const [seeded] = await tradeBook.registries.strategies.list()
    await tradeBook.registries.strategies.save({ ...seeded, name: 'My Long Stock' })

    await workspace.ensureSeeded()

    const strategies = await tradeBook.registries.strategies.list()
    expect(strategies.map((s) => s.name)).toEqual(['My Long Stock'])
  })

  it('does not resurrect a seeded item the trader archived', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await workspace.ensureSeeded()
    await tradeBook.registries.strategies.archive(LONG_STOCK_STRATEGY_ID)

    await workspace.ensureSeeded()

    expect(await tradeBook.registries.strategies.list()).toEqual([])
    expect(await tradeBook.registries.strategies.list(true)).toHaveLength(1)
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
