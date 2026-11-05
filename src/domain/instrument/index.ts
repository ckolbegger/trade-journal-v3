// The domain's tagged Instrument. Only the Stock variant exists; D7 adds Option as one more union
// member, one branch in each key function and one wording label (A188).
export type Instrument = { readonly kind: 'Stock'; readonly symbol: string }

// A stock's key is its bare symbol, as Market Data stores it.
export function instrumentKey(instrument: Instrument): string {
  return instrument.symbol
}

export function instrumentOf(key: string): Instrument {
  return { kind: 'Stock', symbol: key }
}
