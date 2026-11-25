// Advisory explanation only. Deterministic inversion of the observed Mark by
// the stated European Black-Scholes formula (no dividends, short rate 0.04,
// calendar days/365). No result here is used by valuation, P&L, risk/reward,
// Stop/Target, expiration payoff, lifecycle, Deviations, Daily Review or any
// report. Removing the capability returns null; it is not a domain Unavailable.
export type AdvisoryIvInput = {
  kind: 'Call' | 'Put'
  mark?: string
  underlying?: string
  strike: string
  days: number
}

export type AdvisoryIvResult =
  | {
      kind: 'Value'
      vol: number
      inputs: AdvisoryIvInput & { rate: number }
    }
  | { kind: 'Unavailable'; reason: string }

const RATE = 0.04
const MIN_VOL = 0.0001
const MAX_VOL = 5

export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp(-x * x / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - p : p
}

export function blackScholes(kind: 'Call' | 'Put', s: number, k: number, days: number, vol: number): number {
  const t = days / 365
  if (days <= 0) return kind === 'Call' ? Math.max(0, s - k) : Math.max(0, k - s)
  const sqrtT = Math.sqrt(t)
  const d1 = (Math.log(s / k) + (RATE + vol * vol / 2) * t) / (vol * sqrtT)
  const d2 = d1 - vol * sqrtT
  const df = Math.exp(-RATE * t)
  return kind === 'Call'
    ? s * normCdf(d1) - k * df * normCdf(d2)
    : k * df * normCdf(-d2) - s * normCdf(-d1)
}

export function blackScholesDelta(
  kind: 'Call' | 'Put', s: number, k: number, days: number, vol: number,
): number {
  if (days <= 0) {
    return kind === 'Call' ? (s > k ? 1 : 0) : (k > s ? -1 : 0)
  }
  const t = days / 365
  const sqrtT = Math.sqrt(t)
  const d1 = (Math.log(s / k) + (RATE + vol * vol / 2) * t) / (vol * sqrtT)
  return kind === 'Call' ? normCdf(d1) : normCdf(d1) - 1
}

export function advisoryImpliedVolatility(
  input: AdvisoryIvInput,
  installed: boolean,
): AdvisoryIvResult | null {
  if (!installed) return null
  if (!input.mark || !input.underlying) return { kind: 'Unavailable', reason: 'a Mark is missing' }
  if (input.days <= 0) {
    return { kind: 'Unavailable', reason: 'on the expiration session the price no longer depends on volatility' }
  }

  const s = Number(input.underlying)
  const k = Number(input.strike)
  const mark = Number(input.mark)
  const floor = blackScholes(input.kind, s, k, input.days, MIN_VOL)
  if (!Number.isFinite(mark) || !Number.isFinite(s) || !Number.isFinite(k) || s <= 0 || k <= 0) {
    return { kind: 'Unavailable', reason: 'a Mark is missing' }
  }
  if (mark <= floor + 0.005) {
    return { kind: 'Unavailable', reason: 'the Mark is at or below the option’s exercise value, so no volatility fits' }
  }

  let lo = MIN_VOL
  let hi = MAX_VOL
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2
    if (blackScholes(input.kind, s, k, input.days, mid) < mark) lo = mid
    else hi = mid
  }
  if (blackScholes(input.kind, s, k, input.days, hi) < mark) {
    return { kind: 'Unavailable', reason: 'no volatility fits this Mark' }
  }
  const vol = (lo + hi) / 2
  const perPoint = blackScholes(input.kind, s, k, input.days, vol + 0.01) - blackScholes(input.kind, s, k, input.days, vol)
  if (perPoint < 0.005) {
    return { kind: 'Unavailable', reason: 'this far from the strike, or this close to expiration, the price barely depends on volatility' }
  }
  return { kind: 'Value', vol, inputs: { ...input, rate: RATE } }
}
