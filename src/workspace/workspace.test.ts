import { describe, it, expect } from 'vitest'
import { InMemoryBinding } from '@/storage/in-memory-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Workspace, LONG_STOCK_STRATEGY_ID } from './workspace'

function makeWorkspace(): { workspace: Workspace; tradeBook: TradeBook } {
  const tradeBook = new TradeBook(new InMemoryBinding())
  return { workspace: new Workspace(tradeBook), tradeBook }
}

describe('Workspace.ensureSeeded', () => {
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
