import { describe, it, expect } from 'vitest'
import { buildInstrumentKey, parseInstrumentKey, underlyingKeyOf } from './instrument'
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

describe('InstrumentKey (options)', () => {
  it('renders "AAPL 2027-06-18 C 200" from an option instrument', () => {
    const instrument: Instrument = {
      kind: 'option',
      ticker: 'AAPL',
      expiration: '2027-06-18',
      type: 'call',
      strike: 20000,
    }
    expect(buildInstrumentKey(instrument)).toBe('AAPL 2027-06-18 C 200')
  })

  it('parses the canonical string back including fractional strikes ("BRK.B 2026-12-18 P 447.50")', () => {
    const instrument: Instrument = {
      kind: 'option',
      ticker: 'BRK.B',
      expiration: '2026-12-18',
      type: 'put',
      strike: 44750,
    }
    const key = buildInstrumentKey(instrument)
    expect(key).toBe('BRK.B 2026-12-18 P 447.50')
    expect(parseInstrumentKey(key)).toEqual(instrument)
  })

  it('extracts the underlying ticker from an option key', () => {
    expect(underlyingKeyOf('AAPL 2027-06-18 C 200')).toBe('AAPL')
    expect(underlyingKeyOf('AAPL')).toBe('AAPL')
  })
})
