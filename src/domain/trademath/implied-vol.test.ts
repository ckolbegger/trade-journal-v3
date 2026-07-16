import { describe, it, expect } from 'vitest'
import type { Mark, OptionInstrument } from './types'
import { impliedVol } from './implied-vol'

// Display-only Black-Scholes inversion (ADR 0009) — no dividend modeling, caller
// supplies the risk-free rate (trademath.md open item). Worked case: AAPL
// 2027-01-01 C 200 (expiration chosen so a 2026-01-01 Mark gives T=1yr exactly),
// Marked 2026-01-01 at $23.67 with the underlying at $200 — an independently
// computed Black-Scholes price (S=200, K=200, T=1yr, r=0.04, sigma=0.25) that
// round-trips within 0.001. See implied-vol test cases for exact numbers.

const CONTRACT: OptionInstrument = {
  kind: 'option',
  ticker: 'AAPL',
  expiration: '2027-01-01',
  type: 'call',
  strike: 20000, // $200
}

function markOf(date: string, price: number): Mark {
  return { instrument: 'AAPL 2027-01-01 C 200', date, price, origin: 'manual' }
}

function underlyingOf(date: string, price: number): Mark {
  return { instrument: 'AAPL', date, price, origin: 'manual' }
}

describe('TradeMath.impliedVol', () => {
  it('recovers ~0.25 vol from a mark priced with 0.25 vol (round-trip within 0.001)', () => {
    // Independently computed Black-Scholes call price for S=200, K=200, T=1yr
    // (2026-01-01 → 2027-01-01), r=0.04, sigma=0.25: 23.674092881648164 → 2367
    // cents (an external Black-Scholes calculator with these inputs should agree
    // within a cent).
    const mark = markOf('2026-01-01', 2367)
    const underlying = underlyingOf('2026-01-01', 20000)

    const iv = impliedVol(CONTRACT, mark, underlying, 0.04)

    expect(iv).toBeDefined()
    expect(Math.abs(iv! - 0.25)).toBeLessThan(0.001)
  })

  it('returns undefined when no vol reproduces the mark (deep-ITM below intrinsic)', () => {
    // Discounted intrinsic floor for this put (K=200, S=50, T=1yr, r=0.04) is
    // K·e^(-rT) − S ≈ 142.16 — no volatility can price the option below that
    // floor, so a mark of 100.00 (10000 cents) is unreachable.
    const put: OptionInstrument = { ...CONTRACT, type: 'put' }
    const mark: Mark = {
      instrument: 'AAPL 2027-01-01 P 200',
      date: '2026-01-01',
      price: 10000,
      origin: 'manual',
    }
    const underlying = underlyingOf('2026-01-01', 5000)

    expect(impliedVol(put, mark, underlying, 0.04)).toBeUndefined()
  })

  it('returns undefined for an expired contract', () => {
    const mark = markOf('2027-01-02', 100)
    const underlying = underlyingOf('2027-01-02', 20000)

    expect(impliedVol(CONTRACT, mark, underlying, 0.04)).toBeUndefined()
  })
})
