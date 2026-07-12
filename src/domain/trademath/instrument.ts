import type { Instrument, InstrumentKey, Money } from './types'

// The canonical string an instrument is keyed by. Stock is simply its ticker
// ("AAPL"); an option is OCC-style: "AAPL 2027-06-18 C 200" (ticker, expiration,
// C/P, strike in dollars — fractional strikes like "447.50" round-trip).

function formatStrike(strike: Money): string {
  return strike % 100 === 0 ? String(strike / 100) : (strike / 100).toFixed(2)
}

export function buildInstrumentKey(instrument: Instrument): InstrumentKey {
  if (instrument.kind === 'stock') return instrument.ticker
  const typeChar = instrument.type === 'call' ? 'C' : 'P'
  return `${instrument.ticker} ${instrument.expiration} ${typeChar} ${formatStrike(instrument.strike)}`
}

export function parseInstrumentKey(key: InstrumentKey): Instrument {
  const parts = key.split(' ')
  if (parts.length === 1) return { kind: 'stock', ticker: key }
  const [ticker, expiration, typeChar, strikeStr] = parts
  return {
    kind: 'option',
    ticker,
    expiration,
    type: typeChar === 'C' ? 'call' : 'put',
    strike: Math.round(parseFloat(strikeStr) * 100),
  }
}

// The underlying's InstrumentKey for any key (a stock key is already its own
// underlying) — used to find the Marks an option's underlying-anchored math needs.
export function underlyingKeyOf(key: InstrumentKey): InstrumentKey {
  return key.split(' ')[0]
}
