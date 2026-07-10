import { describe, it, expect } from 'vitest'
import { buildInstrumentKey, parseInstrumentKey } from './instrument'
import type { Instrument } from './types'

describe('InstrumentKey', () => {
  it('renders a stock instrument as its ticker ("AAPL")', () => {
    const instrument: Instrument = { kind: 'stock', ticker: 'AAPL' }
    expect(buildInstrumentKey(instrument)).toBe('AAPL')
  })

  it('parses "AAPL" back to a stock instrument', () => {
    expect(parseInstrumentKey('AAPL')).toEqual({ kind: 'stock', ticker: 'AAPL' })
  })
})
