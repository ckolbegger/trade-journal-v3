import type { Instrument } from './types'

// The contract multiplier — 100 for an option (one contract represents 100
// shares), 1 for stock. Keyed off the instrument kind, and lives here in
// TradeMath only: valuation, R/R, and position math read it; the UI never sees
// or applies it directly (docs/plan/slice-03-single-leg-options.md).
export function contractMultiplierOf(instrument: Instrument): number {
  return instrument.kind === 'option' ? 100 : 1
}
