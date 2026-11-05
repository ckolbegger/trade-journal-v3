import { describe, expect, it } from 'vitest'
import { instrumentKey, instrumentOf, type Instrument } from './index'

describe('Instrument keys (P68)', () => {
  it('should give a stock key as its symbol', () => {
    expect(instrumentKey({ kind: 'Stock', symbol: 'XYZ' })).toBe('XYZ')
    expect(instrumentKey({ kind: 'Stock', symbol: 'BRK.B' })).toBe('BRK.B')
  })

  it('should read a stock key back as the same Instrument', () => {
    for (const symbol of ['XYZ', 'BRK.B']) {
      const instrument: Instrument = { kind: 'Stock', symbol }
      expect(instrumentOf(instrumentKey(instrument))).toEqual(instrument)
    }
  })
})
