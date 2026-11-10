import { describe, expect, it } from 'vitest'
import { expiredOn, instrumentKey, instrumentOf, multiplierOf, settlementDueOn, validateOptionContract, type Instrument } from './index'

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

describe('Option Instruments (A99, decision 77)', () => {
  const contract = { symbol: 'XYZ', expiration: '2026-11-20', strike: '55.00', right: 'Call' }

  it('should normalize XYZ 2026-11-20 strike 55.00 Call to key XYZ261120C00055000 with multiplier 100 and parse the key back', () => {
    const result = validateOptionContract(contract)
    if (!result.ok) throw new Error(`expected a valid contract, got ${result.issues.join(',')}`)
    expect(result.instrument).toEqual({ kind: 'Option', symbol: 'XYZ', root: 'XYZ', expiration: '2026-11-20', strike: '55', right: 'Call', multiplier: 100 })
    expect(instrumentKey(result.instrument)).toBe('XYZ261120C00055000')
    expect(multiplierOf(result.instrument)).toBe(100)
    expect(instrumentOf('XYZ261120C00055000')).toEqual(result.instrument)
  })

  it('should give BRK.B option the root BRKB in its key', () => {
    const result = validateOptionContract({ ...contract, symbol: 'BRK.B', strike: '412.5', right: 'Put' })
    if (!result.ok) throw new Error('expected valid')
    expect(result.instrument.root).toBe('BRKB')
    expect(instrumentKey(result.instrument)).toBe('BRKB261120P00412500')
  })

  it('should reject a root longer than 6 characters', () => {
    expect(validateOptionContract({ ...contract, symbol: 'ABCDEFG' })).toEqual({ ok: false, issues: ['RootTooLong'] })
  })

  it('should reject a strike with 4 decimal places', () => {
    expect(validateOptionContract({ ...contract, strike: '55.0001' })).toEqual({ ok: false, issues: ['StrikeTooPrecise'] })
  })

  it('should reject a malformed symbol, a non-ISO date, a bad strike and a bad right returning every issue at once', () => {
    expect(validateOptionContract({ symbol: '1X!', expiration: '11/20/2026', strike: '0', right: 'Straddle' })).toEqual({
      ok: false,
      issues: ['MissingInstrument', 'InvalidExpiration', 'StrikeNotPositive', 'InvalidRight'],
    })
    expect(validateOptionContract({ ...contract, strike: '-1' })).toEqual({ ok: false, issues: ['StrikeNotPositive'] })
    expect(validateOptionContract({ ...contract, strike: '1.1234567' })).toEqual({ ok: false, issues: ['StrikeTooPrecise'] })
    expect(validateOptionContract({ ...contract, strike: 'abc' })).toEqual({ ok: false, issues: ['InvalidStrike'] })
    expect(validateOptionContract({ ...contract, expiration: '2026-02-30' })).toEqual({ ok: false, issues: ['InvalidExpiration'] })
  })

  it('should reject an expiration outside 2000 to 2099 with InvalidExpiration, and accept 2000-01-21 and 2099-12-18, each round-tripping through its key', () => {
    for (const expiration of ['1999-12-17', '2100-01-15', '2126-11-20']) {
      expect(validateOptionContract({ ...contract, expiration })).toEqual({ ok: false, issues: ['InvalidExpiration'] })
    }
    for (const [expiration, key] of [['2000-01-21', 'XYZ000121C00055000'], ['2099-12-18', 'XYZ991218C00055000']] as const) {
      const result = validateOptionContract({ ...contract, expiration })
      if (!result.ok) throw new Error(`expected ${expiration} valid`)
      expect(instrumentKey(result.instrument)).toBe(key)
      expect(instrumentOf(key)).toEqual(result.instrument)
    }
  })

  it('should classify a bare symbol such as BRK.B as a Stock key with multiplier 1', () => {
    const instrument = instrumentOf('BRK.B')
    expect(instrument).toEqual({ kind: 'Stock', symbol: 'BRK.B' })
    expect(multiplierOf(instrument)).toBe(1)
  })
})

describe('expiration rules (P82)', () => {
  const result = validateOptionContract({ symbol: 'XYZ', expiration: '2026-11-20', strike: '55', right: 'Call' })
  if (!result.ok) throw new Error('expected the D7 contract valid')
  const contract = result.instrument

  it('should say the contract has not expired on Thu 11-19 or Fri 11-20, and has expired on Sat 11-21 and Mon 11-23', () => {
    expect(instrumentKey(contract)).toBe('XYZ261120C00055000')
    expect([expiredOn(contract, '2026-11-19'), expiredOn(contract, '2026-11-20'), expiredOn(contract, '2026-11-21'), expiredOn(contract, '2026-11-23')]).toEqual([false, false, true, true])
  })

  it('should say Settlement is not due on Thu 11-19, and is due on Fri 11-20, Sat 11-21 and Mon 11-23', () => {
    expect([settlementDueOn(contract, '2026-11-19'), settlementDueOn(contract, '2026-11-20'), settlementDueOn(contract, '2026-11-21'), settlementDueOn(contract, '2026-11-23')]).toEqual([false, true, true, true])
  })
})
