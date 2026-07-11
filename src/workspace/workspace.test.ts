import { describe, it, expect } from 'vitest'
import { InMemoryBinding } from '@/storage/in-memory-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { Workspace, LONG_STOCK_STRATEGY_ID, PLAN_ENTRY_TYPE_ID } from './workspace'

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
    const types = await journal.entryTypes.list()
    expect(types.map((t) => t.name)).toEqual(['Plan'])
    const [plan] = types
    expect(plan.id).toBe(PLAN_ENTRY_TYPE_ID)
    expect(plan.designatedFor).toBe('plan')
    expect(plan.prompts.map((p) => p.kind)).toEqual(['text', 'text', 'scale', 'select'])
  })

  it('does not duplicate on a second run', async () => {
    const { workspace, journal } = makeWorkspace()
    await workspace.ensureSeeded()
    await workspace.ensureSeeded()
    expect(await journal.entryTypes.list()).toHaveLength(1)
  })

  it('does not overwrite a Plan Entry Type the trader edited', async () => {
    const { workspace, journal } = makeWorkspace()
    await workspace.ensureSeeded()
    const [seeded] = await journal.entryTypes.list()
    await journal.entryTypes.save({ ...seeded, name: 'My Plan' })

    await workspace.ensureSeeded()

    expect((await journal.entryTypes.list()).map((t) => t.name)).toEqual(['My Plan'])
  })

  it('does not resurrect a Plan Entry Type the trader archived', async () => {
    const { workspace, journal } = makeWorkspace()
    await workspace.ensureSeeded()
    await journal.entryTypes.archive(PLAN_ENTRY_TYPE_ID)

    await workspace.ensureSeeded()

    expect(await journal.entryTypes.list()).toEqual([])
    expect(await journal.entryTypes.list(true)).toHaveLength(1)
  })
})
