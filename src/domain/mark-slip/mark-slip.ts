import type { Instrument } from '../instrument/index.ts'
import { formatDecimal, parseDecimal, Rational } from '../values/index.ts'

export type MarkSlipAnswer =
  | { readonly kind: 'Pass' }
  | { readonly kind: 'NotAPrice' }
  | { readonly kind: 'WorthNothing' }
  | { readonly kind: 'ZeroSharePrice' }
  | { readonly kind: 'Moved'; readonly percent: string }
  // The entry looks like a price off by a factor of ten or a hundred: the price the other reading gives.
  | { readonly kind: 'Scaled'; readonly factor: 10 | 100; readonly candidate: string }

// Every limit, in percent of the last Mark. D23 replaces this constant with a setting.
export const MARK_SLIP_LIMITS = {
  stock: { up: 5, down: 5 },
  option: { up: 100, down: 50 },
}
export type MarkSlipLimits = typeof MARK_SLIP_LIMITS

const HUNDRED = Rational.of(100n)

function percentOf(limit: number): Rational {
  // A limit is written as a decimal (5.5), so it is read exactly, never through a float.
  const parsed = parseDecimal(String(limit))
  if (!parsed.ok) throw new RangeError(`Mark slip limit ${limit} is not a plain decimal`)
  return parsed.value.div(HUNDRED)
}

// At least two fractional digits, as many more as the price has (a Mark has at most six).
function priceText(price: Rational): string {
  return formatDecimal(price, 6).replace(/(\.\d\d)0+$/, '$1')
}

export function checkMarkSlip(input: { instrument: Instrument; entry: string; lastMark?: string }, limits: MarkSlipLimits = MARK_SLIP_LIMITS): MarkSlipAnswer {
  const entry = parseDecimal(input.entry)
  const last = input.lastMark === undefined ? undefined : parseDecimal(input.lastMark)
  if (!entry.ok || entry.value.numerator < 0n) return { kind: 'NotAPrice' }
  const isOption = input.instrument.kind === 'Option'
  if (entry.value.numerator === 0n && !isOption) return { kind: 'ZeroSharePrice' }
  // No last Mark, or one of zero, gives nothing to measure a move against.
  if (last === undefined || !last.ok || last.value.numerator === 0n) return { kind: 'Pass' }
  if (entry.value.numerator === 0n) return { kind: 'WorthNothing' }
  const band = isOption ? limits.option : limits.stock
  const one = Rational.of(1n)
  const top = last.value.mul(one.add(percentOf(band.up)))
  const bottom = last.value.mul(one.sub(percentOf(band.down)))
  const within = (price: Rational) => price.compare(top) <= 0 && price.compare(bottom) >= 0
  if (within(entry.value)) return { kind: 'Pass' }
  for (const factor of [10n, 100n] as const) {
    for (const scaled of [entry.value.div(Rational.of(factor)), entry.value.mul(Rational.of(factor))]) {
      // The band is tested on the price as shown, which is rounded to six decimals.
      const candidate = priceText(scaled)
      const shown = parseDecimal(candidate)
      if (shown.ok && within(shown.value) && shown.value.numerator !== 0n) return { kind: 'Scaled', factor: Number(factor) as 10 | 100, candidate }
    }
  }
  const move = entry.value.sub(last.value).div(last.value).mul(HUNDRED)
  return { kind: 'Moved', percent: `${move.numerator > 0n ? '+' : ''}${formatDecimal(move, 1)}` }
}
