import { STRATEGY_SEEDS } from './seeds'
import type { Result } from './types'

// ReferenceCatalog.resolve(StrategyShape) for the seeded single-leg shapes.
// Spreads and other seeds are deliberately unsupported here.
export type StrategyShape = {
  id: string
  label: string
  role: string
  expectedKind: 'Call' | 'Put'
  openingAction: 'Buy' | 'Sell'
  legCount: 1
}

const SINGLE_LEG_SHAPES: Record<string, StrategyShape> = {
  'seed-long-call': {
    id: 'seed-long-call', label: 'Long Call', role: 'Long Call',
    expectedKind: 'Call', openingAction: 'Buy', legCount: 1,
  },
  'seed-long-put': {
    id: 'seed-long-put', label: 'Long Put', role: 'Long Put',
    expectedKind: 'Put', openingAction: 'Buy', legCount: 1,
  },
  'seed-cash-secured-put': {
    id: 'seed-cash-secured-put', label: 'Cash-Secured Put', role: 'Short Put',
    expectedKind: 'Put', openingAction: 'Sell', legCount: 1,
  },
}

export const OPTION_STRATEGY_IDS = Object.keys(SINGLE_LEG_SHAPES) as (keyof typeof SINGLE_LEG_SHAPES)[]

export function resolveStrategyShape(
  id: string,
): Result<StrategyShape, { issue: 'UnknownStrategy' | 'UnsupportedShape' }> {
  const shape = SINGLE_LEG_SHAPES[id]
  if (!shape) {
    const seeded = STRATEGY_SEEDS.some(
      label => `seed-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}` === id,
    )
    return { ok: false, error: { issue: seeded ? 'UnsupportedShape' : 'UnknownStrategy' } }
  }
  return { ok: true, value: shape }
}
