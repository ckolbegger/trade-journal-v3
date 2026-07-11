import { describe, it, expect } from 'vitest'
import { InMemoryBinding } from '@/storage/in-memory-binding'
import { PriceBook } from './price-book'

function priceBook(): PriceBook {
  return new PriceBook(new InMemoryBinding())
}

describe('PriceBook.record / markSet / series', () => {
  it('stores a manual Mark keyed (instrument, date)', async () => {
    const pb = priceBook()
    await pb.record('AAPL', '2026-07-10', 16000, 'manual')

    const marks = await pb.markSet(['AAPL'], '2026-07-10')
    expect(marks.get('AAPL')).toEqual({
      instrument: 'AAPL',
      date: '2026-07-10',
      price: 16000,
      origin: 'manual',
    })
  })

  it('returns overwrote with the prior Mark when re-recording the same key', async () => {
    const pb = priceBook()
    const first = await pb.record('AAPL', '2026-07-10', 16000, 'manual')
    expect(first.overwrote).toBeUndefined()

    const second = await pb.record('AAPL', '2026-07-10', 16100, 'manual')
    expect(second.overwrote).toEqual({
      instrument: 'AAPL',
      date: '2026-07-10',
      price: 16000,
      origin: 'manual',
    })
  })

  it('markSet() returns exactly the requested instruments for a date', async () => {
    const pb = priceBook()
    await pb.record('AAPL', '2026-07-10', 16000, 'manual')
    await pb.record('MSFT', '2026-07-10', 40000, 'manual')
    await pb.record('TSLA', '2026-07-10', 25000, 'manual')

    const marks = await pb.markSet(['AAPL', 'MSFT'], '2026-07-10')
    expect([...marks.keys()].sort()).toEqual(['AAPL', 'MSFT'])
  })

  it('markSet() omits instruments with no Mark that date (absence, not zero)', async () => {
    const pb = priceBook()
    await pb.record('AAPL', '2026-07-10', 16000, 'manual')

    const marks = await pb.markSet(['AAPL', 'MSFT'], '2026-07-10')
    expect(marks.has('AAPL')).toBe(true)
    expect(marks.has('MSFT')).toBe(false)
  })

  it('series() returns date-ordered Marks per instrument', async () => {
    const pb = priceBook()
    await pb.record('AAPL', '2026-07-12', 16200, 'manual')
    await pb.record('AAPL', '2026-07-10', 16000, 'manual')
    await pb.record('AAPL', '2026-07-11', 16100, 'manual')

    const series = await pb.series(['AAPL'])
    expect(series.get('AAPL')?.map((m) => m.date)).toEqual([
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
    ])
  })

  it('series() respects a date range; gaps simply have no entry', async () => {
    const pb = priceBook()
    await pb.record('AAPL', '2026-07-10', 16000, 'manual')
    // 2026-07-11 deliberately has no Mark — a gap
    await pb.record('AAPL', '2026-07-12', 16200, 'manual')
    await pb.record('AAPL', '2026-07-14', 16400, 'manual')

    const series = await pb.series(['AAPL'], { from: '2026-07-11', to: '2026-07-13' })
    expect(series.get('AAPL')?.map((m) => m.date)).toEqual(['2026-07-12'])
  })
})
