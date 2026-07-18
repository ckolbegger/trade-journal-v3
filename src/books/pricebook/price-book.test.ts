import { describe, it, expect } from 'vitest'
import { InMemoryBinding } from '@/storage/in-memory-binding'
import { PriceBook } from './price-book'
import type { DateRange, PricingSource, SourceObservation } from './types'

function priceBook(sources: PricingSource[] = [], binding = new InMemoryBinding()): PriceBook {
  return new PriceBook(binding, sources)
}

// A minimal PricingSource stub — exercises PriceBook's own seam (routing,
// storing, error reporting) without any real adapter's HTTP concerns.
function stubSource(opts: {
  id: string
  supports: (instrument: string) => boolean
  observations?: SourceObservation[]
  error?: Error
}): PricingSource {
  return {
    id: opts.id,
    supports: opts.supports,
    fetch: async (_instruments: string[], _range: DateRange) => {
      if (opts.error) throw opts.error
      return opts.observations ?? []
    },
  }
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

describe('PriceBook.lastMarked', () => {
  it('returns the latest Mark date per instrument', async () => {
    const pb = priceBook()
    await pb.record('AAPL', '2026-07-10', 16000, 'manual')
    await pb.record('AAPL', '2026-07-13', 16300, 'manual')
    await pb.record('AAPL', '2026-07-11', 16100, 'manual')
    await pb.record('MSFT', '2026-07-09', 40000, 'manual')

    const last = await pb.lastMarked(['AAPL', 'MSFT'])
    expect(last.get('AAPL')).toBe('2026-07-13')
    expect(last.get('MSFT')).toBe('2026-07-09')
  })

  it('returns undefined for a never-marked instrument', async () => {
    const pb = priceBook()
    await pb.record('AAPL', '2026-07-10', 16000, 'manual')

    const last = await pb.lastMarked(['AAPL', 'TSLA'])
    expect(last.get('TSLA')).toBeUndefined()
    expect(last.has('TSLA')).toBe(true)
  })
})

describe('PriceBook.missingMarks', () => {
  it('lists (instrument, date) pairs in the range with no Mark', async () => {
    const pb = priceBook()
    // Monday marked, Tuesday skipped, Wednesday unmarked for AAPL; MSFT unmarked.
    await pb.record('AAPL', '2026-07-13', 16000, 'manual')

    const missing = await pb.missingMarks(['AAPL', 'MSFT'], {
      from: '2026-07-13',
      to: '2026-07-15',
    })

    expect(missing).toEqual([
      { instrument: 'AAPL', date: '2026-07-14' },
      { instrument: 'AAPL', date: '2026-07-15' },
      { instrument: 'MSFT', date: '2026-07-13' },
      { instrument: 'MSFT', date: '2026-07-14' },
      { instrument: 'MSFT', date: '2026-07-15' },
    ])
  })

  it('returns nothing when the range is fully marked', async () => {
    const pb = priceBook()
    await pb.record('AAPL', '2026-07-13', 16000, 'manual')
    await pb.record('AAPL', '2026-07-14', 16100, 'manual')

    const missing = await pb.missingMarks(['AAPL'], { from: '2026-07-13', to: '2026-07-14' })
    expect(missing).toEqual([])
  })

  it('treats every calendar date in range as needed (no trading calendar)', async () => {
    const pb = priceBook()
    // 2026-07-18 and 2026-07-19 are a Saturday and Sunday — they are still
    // needed: a date needs a Mark because the trader reviewed it, not because a
    // calendar said the exchange was open.
    const missing = await pb.missingMarks(['AAPL'], { from: '2026-07-17', to: '2026-07-20' })
    expect(missing.map((m) => m.date)).toEqual([
      '2026-07-17',
      '2026-07-18',
      '2026-07-19',
      '2026-07-20',
    ])
  })

  it('spans a month boundary', async () => {
    const pb = priceBook()
    const missing = await pb.missingMarks(['AAPL'], { from: '2026-07-30', to: '2026-08-02' })
    expect(missing.map((m) => m.date)).toEqual([
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-02',
    ])
  })
})

describe('PriceBook.fetch (no adapters)', () => {
  it('returns immediately with all requested instruments unsupported', async () => {
    const pb = priceBook()

    const report = await pb.fetch(['AAPL', 'MSFT'], { from: '2026-07-13', to: '2026-07-15' })

    expect(report).toEqual({
      stored: [],
      skippedManual: [],
      unsupported: ['AAPL', 'MSFT'],
      errors: [],
    })
  })

  it('stores nothing', async () => {
    const pb = priceBook()

    await pb.fetch(['AAPL'], { from: '2026-07-13', to: '2026-07-15' })

    const missing = await pb.missingMarks(['AAPL'], { from: '2026-07-13', to: '2026-07-15' })
    expect(missing).toHaveLength(3)
    expect(await pb.lastMarked(['AAPL'])).toEqual(new Map([['AAPL', undefined]]))
  })
})

describe('PriceBook.fetch (with adapters)', () => {
  it("stores fetched Marks with origin 'fetched'", async () => {
    const source = stubSource({
      id: 'test-source',
      supports: () => true,
      observations: [{ instrument: 'AAPL', date: '2026-07-13', close: 31731 }],
    })
    const pb = priceBook([source])

    const report = await pb.fetch(['AAPL'], { from: '2026-07-13', to: '2026-07-13' })

    expect(report).toEqual({
      stored: [{ instrument: 'AAPL', date: '2026-07-13', price: 31731, origin: 'fetched' }],
      skippedManual: [],
      unsupported: [],
      errors: [],
    })
    const marks = await pb.markSet(['AAPL'], '2026-07-13')
    expect(marks.get('AAPL')).toEqual({
      instrument: 'AAPL',
      date: '2026-07-13',
      price: 31731,
      origin: 'fetched',
    })
  })

  it('never overwrites a manual Mark (skippedManual reports it)', async () => {
    const binding = new InMemoryBinding()
    const pb = priceBook([], binding)
    await pb.record('AAPL', '2026-07-13', 30000, 'manual')
    const source = stubSource({
      id: 'test-source',
      supports: () => true,
      observations: [{ instrument: 'AAPL', date: '2026-07-13', close: 31731 }],
    })
    const priced = priceBook([source], binding)

    const report = await priced.fetch(['AAPL'], { from: '2026-07-13', to: '2026-07-13' })

    expect(report).toEqual({ stored: [], skippedManual: ['AAPL'], unsupported: [], errors: [] })
    const marks = await priced.markSet(['AAPL'], '2026-07-13')
    expect(marks.get('AAPL')).toEqual({
      instrument: 'AAPL',
      date: '2026-07-13',
      price: 30000,
      origin: 'manual',
    })
  })

  it('replaces a previously fetched Mark on re-fetch', async () => {
    const binding = new InMemoryBinding()
    const first = stubSource({
      id: 'test-source',
      supports: () => true,
      observations: [{ instrument: 'AAPL', date: '2026-07-13', close: 31731 }],
    })
    const pb = priceBook([first], binding)
    await pb.fetch(['AAPL'], { from: '2026-07-13', to: '2026-07-13' })

    const second = stubSource({
      id: 'test-source',
      supports: () => true,
      observations: [{ instrument: 'AAPL', date: '2026-07-13', close: 31900 }],
    })
    const rePriced = priceBook([second], binding)
    const report = await rePriced.fetch(['AAPL'], { from: '2026-07-13', to: '2026-07-13' })

    expect(report).toEqual({
      stored: [{ instrument: 'AAPL', date: '2026-07-13', price: 31900, origin: 'fetched' }],
      skippedManual: [],
      unsupported: [],
      errors: [],
    })
    const marks = await rePriced.markSet(['AAPL'], '2026-07-13')
    expect(marks.get('AAPL')?.price).toBe(31900)
  })

  it('routes each instrument to the first adapter that supports it', async () => {
    const first = stubSource({
      id: 'first-source',
      supports: () => true,
      observations: [{ instrument: 'AAPL', date: '2026-07-13', close: 31731 }],
    })
    const second = stubSource({
      id: 'second-source',
      supports: () => true,
      observations: [{ instrument: 'AAPL', date: '2026-07-13', close: 99999 }],
    })
    const pb = priceBook([first, second])

    const report = await pb.fetch(['AAPL'], { from: '2026-07-13', to: '2026-07-13' })

    expect(report.stored).toEqual([
      { instrument: 'AAPL', date: '2026-07-13', price: 31731, origin: 'fetched' },
    ])
  })

  it('reports unsupported instruments (no adapter accepts them)', async () => {
    const source = stubSource({ id: 'test-source', supports: () => false })
    const pb = priceBook([source])

    const report = await pb.fetch(['AAPL'], { from: '2026-07-13', to: '2026-07-13' })

    expect(report).toEqual({ stored: [], skippedManual: [], unsupported: ['AAPL'], errors: [] })
  })

  it('reports per-instrument errors with source id and message, storing the rest', async () => {
    const good = stubSource({
      id: 'test-source',
      supports: (i) => i === 'AAPL',
      observations: [{ instrument: 'AAPL', date: '2026-07-13', close: 31731 }],
    })
    const bad = stubSource({
      id: 'test-source',
      supports: (i) => i === 'MSFT',
      error: new Error('API key expired'),
    })
    const pb = priceBook([good, bad])

    const report = await pb.fetch(['AAPL', 'MSFT'], { from: '2026-07-13', to: '2026-07-13' })

    expect(report).toEqual({
      stored: [{ instrument: 'AAPL', date: '2026-07-13', price: 31731, origin: 'fetched' }],
      skippedManual: [],
      unsupported: [],
      errors: [{ instrument: 'MSFT', source: 'test-source', message: 'API key expired' }],
    })
  })

  it('stores nothing for dates the source returned no observation (market closed)', async () => {
    const source = stubSource({
      id: 'test-source',
      supports: () => true,
      // A two-day range; the source only answers for the first day (the second
      // was a closed market — the feed simply omits it, never a zero-fill).
      observations: [{ instrument: 'AAPL', date: '2026-07-13', close: 31731 }],
    })
    const pb = priceBook([source])

    const report = await pb.fetch(['AAPL'], { from: '2026-07-13', to: '2026-07-14' })

    expect(report.stored).toEqual([
      { instrument: 'AAPL', date: '2026-07-13', price: 31731, origin: 'fetched' },
    ])
    const marks = await pb.markSet(['AAPL'], '2026-07-14')
    expect(marks.has('AAPL')).toBe(false)
  })
})

describe('missingMarks after fetch', () => {
  it('is the authoritative remainder: fetched dates gone, error/unsupported dates still listed', async () => {
    const fetched = stubSource({
      id: 'test-source',
      supports: (i) => i === 'AAPL',
      observations: [{ instrument: 'AAPL', date: '2026-07-13', close: 31731 }],
    })
    const erroring = stubSource({
      id: 'test-source',
      supports: (i) => i === 'MSFT',
      error: new Error('API key expired'),
    })
    const pb = priceBook([fetched, erroring])

    await pb.fetch(['AAPL', 'MSFT', 'TSLA'], { from: '2026-07-13', to: '2026-07-13' })

    const missing = await pb.missingMarks(['AAPL', 'MSFT', 'TSLA'], {
      from: '2026-07-13',
      to: '2026-07-13',
    })
    expect(missing).toEqual([
      { instrument: 'MSFT', date: '2026-07-13' }, // errored — not stored
      { instrument: 'TSLA', date: '2026-07-13' }, // unsupported — not stored
    ])
  })
})
