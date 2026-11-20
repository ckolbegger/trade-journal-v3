// D9 A258, P121, P122: the price of a European option without dividends, its implied volatility and its delta.
// Floating point throughout; imports nothing from the exact values and nothing from trade-analysis (T9.20's estimates rule).
import { LONG_TERM_RATE, SHORT_TERM_LAST_DAY, SHORT_TERM_RATE } from './assumptions'

export type OptionKind = 'Call' | 'Put'
export type ImpliedVolatilityReason = 'ExpirationSession' | 'AtOrBelowExerciseValue' | 'NoVolatilityFits' | 'InsensitiveToVolatility'
export type ImpliedVolatility =
  | { readonly kind: 'Volatility'; readonly value: number }
  | { readonly kind: 'Unavailable'; readonly reason: ImpliedVolatilityReason }

// The standard normal distribution, W. J. Cody-style double precision (Hart 1968, West 2005). Symmetric, so N(x) + N(−x) = 1.
function normalCdf(x: number): number {
  const a = Math.abs(x)
  let c = 0
  if (a <= 37) {
    const e = Math.exp((-a * a) / 2)
    if (a < 7.07106781186547) {
      let b = 3.52624965998911e-2 * a + 0.700383064443688
      b = b * a + 6.37396220353165
      b = b * a + 33.912866078383
      b = b * a + 112.079291497871
      b = b * a + 221.213596169931
      b = b * a + 220.206867912376
      let d = 8.83883476483184e-2 * a + 1.75566716318264
      d = d * a + 16.064177579207
      d = d * a + 86.7807322029461
      d = d * a + 296.564248779674
      d = d * a + 637.333633378831
      d = d * a + 793.826512519948
      d = d * a + 440.413735824752
      c = (e * b) / d
    } else {
      let b = a + 0.65
      b = a + 4 / b
      b = a + 3 / b
      b = a + 2 / b
      b = a + 1 / b
      c = e / b / 2.506628274631
    }
  }
  return x > 0 ? 1 - c : c
}

function d1d2(underlying: number, strike: number, days: number, volatility: number, rate: number): readonly [number, number] {
  const t = days / 365
  const sd = volatility * Math.sqrt(t)
  const d1 = (Math.log(underlying / strike) + (rate + (volatility * volatility) / 2) * t) / sd
  return [d1, d1 - sd]
}

export function optionPrice(kind: OptionKind, underlying: number, strike: number, days: number, volatility: number, rate: number): number {
  const [d1, d2] = d1d2(underlying, strike, days, volatility, rate)
  const discounted = strike * Math.exp(-rate * (days / 365))
  return kind === 'Call' ? underlying * normalCdf(d1) - discounted * normalCdf(d2) : discounted * normalCdf(-d2) - underlying * normalCdf(-d1)
}
// The sensitivity to the Underlying: the price change per dollar of the Underlying (T9.22 turns it into a share equivalent).
export function optionDelta(kind: OptionKind, underlying: number, strike: number, days: number, volatility: number, rate: number): number {
  const [d1] = d1d2(underlying, strike, days, volatility, rate)
  return kind === 'Call' ? normalCdf(d1) : normalCdf(d1) - 1
}
const LOWEST_VOLATILITY = 0.0001 // 0.01%
const HIGHEST_VOLATILITY = 5 // 500%
const BISECTION_STEPS = 100
const HALF_A_CENT = 0.005

// Implied volatility: the volatility at which the price equals the Mark, found by bisection. It explains a price; it predicts nothing.
export function impliedVolatility(kind: OptionKind, mark: number, underlying: number, strike: number, days: number, rate: number): ImpliedVolatility {
  if (days <= 0) return { kind: 'Unavailable', reason: 'ExpirationSession' }
  // Half a cent above the exercise value (the price at the lowest volatility), the Mark leaves no volatility to read.
  if (mark <= optionPrice(kind, underlying, strike, days, LOWEST_VOLATILITY, rate) + HALF_A_CENT) return { kind: 'Unavailable', reason: 'AtOrBelowExerciseValue' }
  if (optionPrice(kind, underlying, strike, days, HIGHEST_VOLATILITY, rate) < mark) return { kind: 'Unavailable', reason: 'NoVolatilityFits' }
  let low = LOWEST_VOLATILITY
  let high = HIGHEST_VOLATILITY
  for (let step = 0; step < BISECTION_STEPS; step += 1) {
    const middle = (low + high) / 2
    if (optionPrice(kind, underlying, strike, days, middle, rate) < mark) low = middle
    else high = middle
  }
  const value = (low + high) / 2
  // Where one volatility point moves the price by under half a cent, a one-cent step in the Mark swings the answer.
  const perPoint = optionPrice(kind, underlying, strike, days, value + 0.01, rate) - optionPrice(kind, underlying, strike, days, value, rate)
  if (perPoint < HALF_A_CENT) return { kind: 'Unavailable', reason: 'InsensitiveToVolatility' }
  return { kind: 'Volatility', value }
}
// P122: the rate chosen by days to expiration.
export function rateForDays(days: number): number {
  return days <= SHORT_TERM_LAST_DAY ? SHORT_TERM_RATE : LONG_TERM_RATE
}
