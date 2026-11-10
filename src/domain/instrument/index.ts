// The domain's tagged Instrument (A99, decision 77). A Stock's key is its bare symbol; an Option's key
// is the unpadded OCC symbol built from `root`, never from `symbol`.
import { parseDecimal } from '../values/index.ts'

export type StockInstrument = { readonly kind: 'Stock'; readonly symbol: string }
export type OptionRight = 'Call' | 'Put'
export type OptionInstrument = {
  readonly kind: 'Option'
  readonly symbol: string
  readonly root: string
  readonly expiration: string
  readonly strike: string
  readonly right: OptionRight
  readonly multiplier: 100
}
export type Instrument = StockInstrument | OptionInstrument

// Money formulas use quantity x multiplier x price; a Stock's multiplier is 1.
export function multiplierOf(instrument: Instrument): number {
  return instrument.kind === 'Option' ? instrument.multiplier : 1
}

export function instrumentKey(instrument: Instrument): string {
  if (instrument.kind === 'Stock') return instrument.symbol
  const [year, month, day] = instrument.expiration.slice(2).split('-')
  return `${instrument.root}${year}${month}${day}${instrument.right === 'Call' ? 'C' : 'P'}${strikeDigits(instrument.strike)}`
}

// The strike x 1000 as 8 digits; a validated strike has at most 5 whole and 3 fractional digits.
function strikeDigits(strike: string): string {
  const [whole = '0', fraction = ''] = strike.split('.')
  return `${whole}${fraction.padEnd(3, '0')}`.padStart(8, '0')
}

const OCC_KEY = /^([A-Z0-9]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{5})(\d{3})$/

// An OCC key carries only the root, not the listing symbol, so an Option read from a key has
// `symbol` equal to its root. That is exact for every symbol without "."; callers that hold the
// Trade's own Instrument should prefer it.
export function instrumentOf(key: string): Instrument {
  const match = key.length >= 16 ? OCC_KEY.exec(key) : null
  if (!match) return { kind: 'Stock', symbol: key }
  const [, root = '', year, month, day, right, whole = '0', fraction = ''] = match
  const trimmed = fraction.replace(/0+$/, '')
  return {
    kind: 'Option',
    symbol: root,
    root,
    expiration: `20${year}-${month}-${day}`,
    strike: `${Number(whole)}${trimmed ? `.${trimmed}` : ''}`,
    right: right === 'C' ? 'Call' : 'Put',
    multiplier: 100,
  }
}

// The expiration rules (P82). Dates are ISO trading dates, so string comparison is date order.
// The contract has expired once the date is strictly after its expiration date.
export function expiredOn(contract: OptionInstrument, date: string): boolean {
  return date > contract.expiration
}

// Settlement is due on or after the expiration date.
export function settlementDueOn(contract: OptionInstrument, date: string): boolean {
  return date >= contract.expiration
}

export type ContractIssue =
  | 'MissingInstrument'
  | 'RootTooLong'
  | 'InvalidExpiration'
  | 'InvalidStrike'
  | 'StrikeNotPositive'
  | 'StrikeTooPrecise'
  | 'InvalidRight'
export type ContractInput = { readonly symbol: string; readonly expiration: string; readonly strike: string; readonly right: string }
export type ContractResult = { readonly ok: true; readonly instrument: OptionInstrument } | { readonly ok: false; readonly issues: readonly ContractIssue[] }

// Stock symbols follow D1 A9.
const SYMBOL = /^[A-Z][A-Z0-9.]{0,9}$/

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

// The contract validation of a Plan's option leg: the Option Instrument, or every issue at once.
export function validateOptionContract(input: ContractInput): ContractResult {
  const symbol = input.symbol.trim().toUpperCase()
  const root = symbol.replace(/\./g, '')
  const issues: ContractIssue[] = []
  if (!SYMBOL.test(symbol)) issues.push('MissingInstrument')
  else if (root.length > 6) issues.push('RootTooLong')
  // The key keeps only YY and instrumentOf rebuilds 20YY, so only 2000 to 2099 round-trips.
  if (!isIsoDate(input.expiration) || input.expiration.slice(0, 2) !== '20') issues.push('InvalidExpiration')
  // Strikes have at most 3 fractional digits (decision 77) and 5 whole digits (the key's 8 digits).
  const strike = parseDecimal(input.strike)
  const [whole = '', fraction = ''] = input.strike.split('.')
  if (fraction.length > 3) issues.push('StrikeTooPrecise')
  else if (!/^-?\d+(\.\d+)?$/.test(input.strike)) issues.push('InvalidStrike')
  else if (strike.ok && strike.value.numerator <= 0n) issues.push('StrikeNotPositive')
  else if (whole.replace(/^0+/, '').length > 5) issues.push('InvalidStrike')
  if (input.right !== 'Call' && input.right !== 'Put') issues.push('InvalidRight')
  if (issues.length > 0 || !strike.ok || (input.right !== 'Call' && input.right !== 'Put')) return { ok: false, issues }
  return {
    ok: true,
    instrument: { kind: 'Option', symbol, root, expiration: input.expiration, strike: strike.normalized, right: input.right, multiplier: 100 },
  }
}
