import { describe, expect, it } from 'vitest'
import { canonicalInstrument, parseOptionContract } from '../../src/domain/option-contract'
import { resolveStrategyShape } from '../../src/domain/strategy-shapes'

const draft = {
  underlying: 'AAPL', kind: 'Call' as const, strike: '190', expiration: '2026-12-18', multiplier: '100',
}

describe('option Strategy shapes', () => {
  it('should resolve the three seeded single-leg shapes to their exact role and contract requirement', () => {
    expect(resolveStrategyShape('seed-long-call')).toMatchObject({
      ok: true, value: { label: 'Long Call', expectedKind: 'Call', openingAction: 'Buy' },
    })
    expect(resolveStrategyShape('seed-long-put')).toMatchObject({
      ok: true, value: { label: 'Long Put', expectedKind: 'Put', openingAction: 'Buy' },
    })
    expect(resolveStrategyShape('seed-cash-secured-put')).toMatchObject({
      ok: true, value: { label: 'Cash-Secured Put', expectedKind: 'Put', openingAction: 'Sell' },
    })
  })

  it('should build one canonical Instrument identity from exact contract fields', () => {
    const parsed = parseOptionContract(draft)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(canonicalInstrument(parsed.value)).toBe('AAPL 190Call 2026-12-18 x100')
    expect(canonicalInstrument(parsed.value)).not.toBe(canonicalInstrument({ ...parsed.value, strike: '195' }))
  })

  it('should reject a missing strike, expiration or nonpositive multiplier with typed issues', () => {
    expect(parseOptionContract({ ...draft, strike: '' })).toMatchObject({ ok: false, error: { issues: ['Strike'] } })
    expect(parseOptionContract({ ...draft, expiration: '' })).toMatchObject({ ok: false, error: { issues: ['Expiration'] } })
    expect(parseOptionContract({ ...draft, multiplier: '0' })).toMatchObject({ ok: false, error: { issues: ['Multiplier'] } })
    expect(parseOptionContract({ ...draft, kind: 'Future' as 'Call' })).toMatchObject({ ok: false, error: { issues: ['OptionKind'] } })
  })

  it('should reject an unseeded or multi-leg Strategy shape', () => {
    expect(resolveStrategyShape('seed-iron-condor')).toMatchObject({ ok: false, error: { issue: 'UnsupportedShape' } })
    expect(resolveStrategyShape('custom')).toMatchObject({ ok: false, error: { issue: 'UnknownStrategy' } })
  })
})
