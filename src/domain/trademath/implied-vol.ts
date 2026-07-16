import type { Mark, OptionInstrument } from './types'

// Black-Scholes implied volatility, inverted from an observed Mark — display
// only (ADR 0009): IV never feeds valuation/riskReward, it only tells the
// trader what the market's price implies. No dividend modeling (accepted
// display error, trademath.md open item — the caller supplies the risk-free
// rate). Bisection over sigma, since Black-Scholes price is monotonic
// increasing in volatility.
//
// Time to expiry is ACT/365 from the Mark's own date to the contract's
// expiration — the Mark's date stands in for "today" (no clock is read here;
// TradeMath takes every fact as a parameter).

const DAY_MS = 24 * 60 * 60 * 1000

function yearsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const fromMs = Date.UTC(fy, fm - 1, fd)
  const toMs = Date.UTC(ty, tm - 1, td)
  return (toMs - fromMs) / DAY_MS / 365
}

// Abramowitz & Stegun 7.1.26 approximation of the error function — accurate to
// ~1.5e-7, ample precision for a display figure.
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  const t = 1 / (1 + p * ax)
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax)
  return sign * y
}

function stdNormCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.sqrt(2)))
}

function bsPrice(
  type: 'call' | 'put',
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
): number {
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T))
  const d2 = d1 - sigma * Math.sqrt(T)
  return type === 'call'
    ? S * stdNormCdf(d1) - K * Math.exp(-r * T) * stdNormCdf(d2)
    : K * Math.exp(-r * T) * stdNormCdf(-d2) - S * stdNormCdf(-d1)
}

const MIN_VOL = 1e-4
const MAX_VOL = 5 // 500% — well beyond any real quote, the search ceiling
const TOLERANCE = 1e-6
const MAX_ITERATIONS = 100

export function impliedVol(
  contract: OptionInstrument,
  mark: Mark,
  underlying: Mark,
  riskFreeRate: number,
): number | undefined {
  const T = yearsBetween(mark.date, contract.expiration)
  if (T <= 0) return undefined

  const S = underlying.price / 100
  const K = contract.strike / 100
  const target = mark.price / 100

  const priceAt = (sigma: number) => bsPrice(contract.type, S, K, T, riskFreeRate, sigma)
  let lo = MIN_VOL
  let hi = MAX_VOL
  const fLo = priceAt(lo) - target
  const fHi = priceAt(hi) - target
  // Black-Scholes price is monotonic increasing in sigma — if the target isn't
  // bracketed between the near-zero-vol floor and the search ceiling, no
  // volatility reproduces it (e.g. a quote below the discounted intrinsic
  // floor on a deep-ITM contract).
  if (fLo > 0 || fHi < 0) return undefined

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const mid = (lo + hi) / 2
    const fMid = priceAt(mid) - target
    if (Math.abs(fMid) < TOLERANCE) return mid
    if (fMid > 0) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}
