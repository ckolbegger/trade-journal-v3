import type { Decomposition } from '../domain/advisory-decomposition'

// Presentation-only geometry. Every value comes from an existing read: no
// interpolation, no provider candle and no model price is introduced here.

export function replayX(index: number, count: number, width: number): number {
  if (count <= 1) return 0
  return Number(((index / (count - 1)) * width).toFixed(2))
}

export function replayY(
  price: string | undefined, stop: string, target: string, height: number,
): number | null {
  if (price === undefined || price === '') return null
  const low = Number(stop)
  const high = Number(target)
  const value = Number(price)
  if (![low, high, value].every(Number.isFinite) || high === low) return null
  const ratio = (value - low) / (high - low)
  return Number((height - Math.max(0, Math.min(1, ratio)) * height).toFixed(2))
}

export type SplitSegment = { name: string; value: number }

export function splitSegments(decomposition: Decomposition): SplitSegment[] {
  if (decomposition.kind !== 'Value') return []
  return [
    { name: 'Underlying', value: decomposition.fromUnderlying },
    { name: 'Time', value: decomposition.fromTime },
    { name: 'Volatility', value: decomposition.fromVolatility },
  ]
}

export function sparkline(values: number[], width: number, height: number): string | null {
  const finite = values.filter(Number.isFinite)
  if (finite.length === 0) return null
  if (finite.length === 1) return `0,${height / 2} ${width},${height / 2}`
  const min = Math.min(...finite)
  const max = Math.max(...finite)
  const span = max - min || 1
  return finite.map((value, i) => {
    const x = (i / (finite.length - 1)) * width
    const y = height - ((value - min) / span) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}
