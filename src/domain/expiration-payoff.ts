import Decimal from 'decimal.js'
import type { OptionContract } from './option-contract'

// TradeAnalysis.expirationPayoff — intrinsic settlement only. No theoretical
// option price, Mark or advisory IV is an input to either curve.
export type PayoffLeg = {
  contract: OptionContract
  openingAction: 'Buy' | 'Sell'
  entry: string
  quantity: number
}

export type PayoffInput = {
  view: 'Planned' | 'Current'
  legs: PayoffLeg[]
  realizedToDate?: string
  unconsumedOpeningFees?: string
  stockOnly?: boolean
  mark?: string
  impliedVolatility?: number
}

export type PayoffSegment = {
  from: string
  to: string | 'Infinity'
  slope: string
  intercept: string
}

export type PayoffCurve = {
  view: 'Planned' | 'Current'
  segments: PayoffSegment[]
  zeroCrossings: string[]
  breakEven: string[]
  extrema: { kind: 'Minimum' | 'Maximum'; value: string; attainedOn: string }[]
  attainment: string[]
}

export type PayoffResult =
  | { kind: 'Value'; value: PayoffCurve }
  | { kind: 'Unavailable'; reason: 'MultipleExpirations' }
  | { kind: 'NotApplicable'; reason: 'FlatExposure' | 'StockOnly' }

const fixed = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
const compact = (d: Decimal) => d.toString()

export function expirationPayoff(input: PayoffInput): PayoffResult {
  if (input.stockOnly || input.legs.length === 0) {
    return input.stockOnly
      ? { kind: 'NotApplicable', reason: 'StockOnly' }
      : { kind: 'NotApplicable', reason: 'FlatExposure' }
  }
  if (input.legs.length > 1) {
    const expirations = new Set(input.legs.map(l => l.contract.expiration))
    if (expirations.size > 1) return { kind: 'Unavailable', reason: 'MultipleExpirations' }
  }

  const { contract, openingAction, entry, quantity } = input.legs[0]
  const multiplier = new Decimal(contract.multiplier).times(quantity)
  const premium = new Decimal(entry).times(multiplier)
  const strike = new Decimal(contract.strike)
  const offset = new Decimal(input.realizedToDate ?? '0')
    .plus(input.unconsumedOpeningFees ?? '0')
  const isCall = contract.kind === 'Call'
  const isBuy = openingAction === 'Buy'

  const basePremium = isBuy ? premium.negated() : premium
  const lowIntercept = isCall
    ? basePremium.plus(offset)
    : isBuy
      ? basePremium.plus(strike.times(multiplier)).plus(offset)
      : basePremium.minus(strike.times(multiplier)).plus(offset)
  const highIntercept = isCall
    ? basePremium.minus(strike.times(multiplier)).plus(offset)
    : basePremium.plus(offset)
  const highSlope = isCall
    ? (isBuy ? multiplier : multiplier.negated())
    : new Decimal(0)
  const lowSlope = isCall
    ? new Decimal(0)
    : (isBuy ? multiplier.negated() : multiplier)

  const segments: PayoffSegment[] = [
    { from: '0', to: compact(strike), slope: compact(lowSlope), intercept: fixed(lowIntercept) },
    { from: compact(strike), to: 'Infinity', slope: compact(highSlope), intercept: fixed(highIntercept) },
  ]

  const crossings: string[] = []
  for (const segment of segments) {
    const slope = new Decimal(segment.slope)
    const intercept = new Decimal(segment.intercept)
    if (slope.eq(0)) continue
    const root = intercept.negated().div(slope)
    const from = new Decimal(segment.from)
    if (root.gte(from) && (segment.to === 'Infinity' || root.lt(new Decimal(segment.to)))) {
      crossings.push(compact(root))
    }
  }

  // The curve is continuous and piecewise linear on [0,K] and [K,∞). Only
  // the tail slope decides boundedness at infinity; extrema are attained at
  // 0, at the kink K, or across a whole segment — never at raw intercepts.
  const origin = '0..0'
  const kink = compact(strike)
  const lowerSpan = `0..${kink}`
  const tail = `${kink}..Infinity`
  const v0 = lowIntercept
  const vK = lowIntercept.plus(lowSlope.times(strike))
  const extrema: PayoffCurve['extrema'] = []

  if (highSlope.lt(0)) {
    extrema.push({ kind: 'Minimum', value: 'Unbounded', attainedOn: tail })
    const maxRange = lowSlope.eq(0) ? lowerSpan : lowSlope.gt(0) ? `${kink}..${kink}` : origin
    extrema.push({ kind: 'Maximum', value: fixed(Decimal.max(v0, vK)), attainedOn: maxRange })
  } else if (highSlope.gt(0)) {
    const minRange = lowSlope.eq(0) ? lowerSpan : lowSlope.lt(0) ? `${kink}..${kink}` : origin
    extrema.push({ kind: 'Minimum', value: fixed(Decimal.min(v0, vK)), attainedOn: minRange })
    extrema.push({
      kind: 'Maximum', value: 'Unbounded',
      attainedOn: `${crossings[0] ?? kink}..Infinity`,
    })
  } else if (lowSlope.gt(0)) {
    extrema.push({ kind: 'Minimum', value: fixed(v0), attainedOn: origin })
    extrema.push({ kind: 'Maximum', value: fixed(vK), attainedOn: tail })
  } else if (lowSlope.lt(0)) {
    extrema.push({ kind: 'Minimum', value: fixed(vK), attainedOn: tail })
    extrema.push({ kind: 'Maximum', value: fixed(v0), attainedOn: origin })
  } else {
    extrema.push({ kind: 'Minimum', value: fixed(v0), attainedOn: '0..Infinity' })
    extrema.push({ kind: 'Maximum', value: fixed(v0), attainedOn: '0..Infinity' })
  }

  const attainment = extrema.map(e => e.attainedOn)
  return {
    kind: 'Value',
    value: {
      view: input.view,
      segments,
      zeroCrossings: crossings,
      breakEven: crossings,
      extrema,
      attainment,
    },
  }
}
