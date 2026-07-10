import type { Instrument, InstrumentKey } from './types'

// The canonical string an instrument is keyed by. Stock only this slice — a
// stock's key is simply its ticker ("AAPL"); option keys arrive in Slice 3.

export function buildInstrumentKey(instrument: Instrument): InstrumentKey {
  return instrument.ticker
}

export function parseInstrumentKey(key: InstrumentKey): Instrument {
  return { kind: 'stock', ticker: key }
}
