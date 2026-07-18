import { describe, it, expect } from 'vitest'
import { buildPricingSources } from './bootstrap'
import { MARKETDATA_SOURCE_ID } from '@/books/pricebook/adapters/marketdata-adapter'

describe('composition root — buildPricingSources', () => {
  it('registers enabled adapters in Settings priority order', () => {
    const sources = buildPricingSources([
      { id: MARKETDATA_SOURCE_ID, enabled: true, apiKey: 'key' },
    ])

    expect(sources.map((s) => s.id)).toEqual([MARKETDATA_SOURCE_ID])
  })

  it('registers nothing when no source is enabled (Slice 1 no-op path unchanged)', () => {
    expect(buildPricingSources([])).toEqual([])
    expect(buildPricingSources([{ id: MARKETDATA_SOURCE_ID, enabled: false }])).toEqual([])
  })
})
