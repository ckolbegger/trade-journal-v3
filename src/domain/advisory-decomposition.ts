import {
  advisoryImpliedVolatility, blackScholes, blackScholesDelta,
} from './advisory-iv'

// Advisory explanation only. Every output here is labelled an estimate and
// is never a Position, hedge instruction, valuation or domain fact. With the
// capability absent the outputs are removed (null), never returned as a
// domain Unavailable result.
export type AdvisoryFrame = {
  date: string
  kind: 'Call' | 'Put'
  mark?: string
  underlying: string
  strike: string
  days: number
  multiplier: number
  quantity: number
  side: 1 | -1
}

type AdvisoryInput<T> = { frame: T; installed: boolean }

export type ShareEquivalent =
  | { kind: 'Value'; shares: number; label: 'Estimate' }
  | { kind: 'Unavailable'; reason: string }

export type Decomposition =
  | {
      kind: 'Value'
      estimate: true
      label: 'Estimate'
      total: number
      fromUnderlying: number
      fromTime: number
      fromVolatility: number
      unexplained: number
    }
  | { kind: 'Unavailable'; reason: string }

function fit(frame: AdvisoryFrame) {
  return advisoryImpliedVolatility({
    kind: frame.kind, mark: frame.mark, underlying: frame.underlying,
    strike: frame.strike, days: frame.days,
  }, true)
}

function usedVol(frame: AdvisoryFrame, fitted: ReturnType<typeof fit>): number | undefined {
  if (fitted.kind === 'Value') return fitted.vol
  // At expiration intrinsic value does not depend on volatility, so the
  // sensitivity is defined without a fitted vol.
  if (frame.days === 0) return 0.0001
  return undefined
}

export function advisoryShareEquivalent(
  input: AdvisoryInput<AdvisoryFrame>,
): ShareEquivalent | null {
  if (!input.installed) return null
  const frame = input.frame
  const fitted = fit(frame)
  const vol = usedVol(frame, fitted)
  if (vol === undefined) return { kind: 'Unavailable', reason: fitted.kind === 'Unavailable' ? fitted.reason : 'no volatility fits this Mark' }
  const delta = blackScholesDelta(
    frame.kind, Number(frame.underlying), Number(frame.strike), frame.days, vol,
  )
  const shares = Math.round(frame.quantity * frame.multiplier * frame.side * delta)
  return { kind: 'Value', shares, label: 'Estimate' }
}

export function priceMoveDecomposition(
  input: AdvisoryInput<{ before: AdvisoryFrame; after: AdvisoryFrame }>,
): Decomposition | null {
  if (!input.installed) return null
  const { before, after } = input
  const fitBefore = fit(before)
  const fitAfter = fit(after)
  const volBefore = usedVol(before, fitBefore)
  const volAfter = usedVol(after, fitAfter)
  if (volBefore === undefined || volAfter === undefined) {
    const reason = fitBefore.kind === 'Unavailable'
      ? `no volatility fits the ${before.date} Mark`
      : `no volatility fits the ${after.date} Mark`
    return { kind: 'Unavailable', reason }
  }

  const s0 = Number(before.underlying)
  const s1 = Number(after.underlying)
  const k = Number(after.strike)
  const multiplier = after.multiplier * after.quantity * after.side
  const total = multiplier * (
    Number(after.mark ?? '0') - Number(before.mark ?? '0')
  )
  const base = blackScholes(after.kind, s0, k, before.days, volBefore)
  const withUnderlying = blackScholes(after.kind, s1, k, before.days, volBefore)
  const withTime = blackScholes(after.kind, s1, k, after.days, volBefore)
  const withVol = after.days === 0
    ? withTime
    : blackScholes(after.kind, s1, k, after.days, volAfter)

  const fromUnderlying = multiplier * (withUnderlying - base)
  const fromTime = multiplier * (withTime - withUnderlying)
  const fromVolatility = multiplier * (withVol - withTime)
  const unexplained = total - fromUnderlying - fromTime - fromVolatility
  return {
    kind: 'Value', estimate: true, label: 'Estimate',
    total, fromUnderlying, fromTime, fromVolatility, unexplained,
  }
}
