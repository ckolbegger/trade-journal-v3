import type { ISODate, InstrumentKey, Money } from '@/domain/trademath/types'
import { parseInstrumentKey } from '@/domain/trademath/instrument'
import type { DateRange, PricingSource, SourceObservation } from '../types'

// marketdata.app adapter (ADR 0008, provider decision in
// docs/plan/slice-04-automated-pricing.md). EOD closes only this slice: stock
// candles' `c`, option quotes' `last` falling back to `mid`. Auth is a `?token=`
// query param; no custom headers, no preflight (browser-callable from static
// hosting, per the provider decision's verified CORS behaviour).

export const MARKETDATA_SOURCE_ID = 'marketdata.app'

const BASE_URL = 'https://api.marketdata.app/v1'

// Distinguishable by `status` (401 bad key, 429 rate limit, ...); `message` is
// the provider's own errmsg, carried verbatim so the FetchReport / Settings UI
// can show the real reason instead of a generic failure.
export class MarketDataApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'MarketDataApiError'
  }
}

interface HttpResponse {
  ok: boolean
  status: number
  statusText: string
  json(): Promise<unknown>
}

type FetchFn = (url: string) => Promise<HttpResponse>

interface ErrorBody {
  s: 'error'
  errmsg?: string
}

interface StockCandlesResponse {
  s: 'ok' | 'no_data' | 'error'
  t?: number[]
  c?: number[]
  errmsg?: string
}

interface OptionQuotesResponse {
  s: 'ok' | 'no_data' | 'error'
  updated?: number[]
  last?: (number | null)[]
  mid?: (number | null)[]
  errmsg?: string
}

// The provider's per-day timestamp (unix seconds, midnight/close US Eastern)
// always falls inside the intended UTC calendar date — no timezone shift needed.
function unixToISODate(seconds: number): ISODate {
  return new Date(seconds * 1000).toISOString().slice(0, 10)
}

function dollarsToCents(dollars: number): Money {
  return Math.round(dollars * 100)
}

// OCC symbol: ticker + YYMMDD + C/P + strike*1000 zero-padded to 8 digits.
// Our strikes are already cents, so strike*1000-in-dollars === strikeCents*10.
function toOccSymbol(
  ticker: string,
  expiration: ISODate,
  typeChar: 'C' | 'P',
  strikeCents: Money,
): string {
  const [year, month, day] = expiration.split('-')
  const yymmdd = `${year.slice(2)}${month}${day}`
  const strikeCode = String(strikeCents * 10).padStart(8, '0')
  return `${ticker}${yymmdd}${typeChar}${strikeCode}`
}

// A well-formed InstrumentKey this app produces: a bare ticker (stock), or
// "TICKER YYYY-MM-DD C|P STRIKE" (option) — anything else is declined rather
// than sent to the provider as a guess.
function isWellFormedInstrumentKey(key: InstrumentKey): boolean {
  const parts = key.trim().split(' ')
  const tickerPattern = /^[A-Z.]{1,10}$/
  if (parts.length === 1) return tickerPattern.test(parts[0])
  if (parts.length !== 4) return false
  const [ticker, expiration, typeChar, strike] = parts
  return (
    tickerPattern.test(ticker) &&
    /^\d{4}-\d{2}-\d{2}$/.test(expiration) &&
    (typeChar === 'C' || typeChar === 'P') &&
    strike.trim() !== '' &&
    !Number.isNaN(Number(strike))
  )
}

export class MarketDataAdapter implements PricingSource {
  readonly id = MARKETDATA_SOURCE_ID

  constructor(
    private apiKey: string,
    // Wrapped rather than passed as a bare reference: an unbound `fetch` throws
    // "Illegal invocation" in real browsers (it needs `window` as `this`).
    private fetchImpl: FetchFn = (url) => fetch(url),
  ) {}

  supports(instrument: InstrumentKey): boolean {
    return isWellFormedInstrumentKey(instrument)
  }

  async fetch(instruments: InstrumentKey[], range: DateRange): Promise<SourceObservation[]> {
    const observations: SourceObservation[] = []
    for (const instrument of instruments) {
      const parsed = parseInstrumentKey(instrument)
      if (parsed.kind === 'stock') {
        observations.push(...(await this.fetchStock(instrument, parsed.ticker, range)))
      } else {
        const occ = toOccSymbol(
          parsed.ticker,
          parsed.expiration,
          parsed.type === 'call' ? 'C' : 'P',
          parsed.strike,
        )
        observations.push(...(await this.fetchOption(instrument, occ, range)))
      }
    }
    return observations
  }

  private async fetchStock(
    instrument: InstrumentKey,
    ticker: string,
    range: DateRange,
  ): Promise<SourceObservation[]> {
    const url = `${BASE_URL}/stocks/candles/D/${ticker}/?from=${range.from}&to=${range.to}&token=${this.apiKey}`
    const body = await this.request<StockCandlesResponse>(url)
    if (body.s === 'no_data') return []
    const dates = body.t ?? []
    const closes = body.c ?? []
    return dates.map((t, i) => ({
      instrument,
      date: unixToISODate(t),
      close: dollarsToCents(closes[i]),
    }))
  }

  private async fetchOption(
    instrument: InstrumentKey,
    occSymbol: string,
    range: DateRange,
  ): Promise<SourceObservation[]> {
    const url = `${BASE_URL}/options/quotes/${occSymbol}/?from=${range.from}&to=${range.to}&token=${this.apiKey}`
    const body = await this.request<OptionQuotesResponse>(url)
    if (body.s === 'no_data') return []
    const dates = body.updated ?? []
    const lasts = body.last ?? []
    const mids = body.mid ?? []
    const observations: SourceObservation[] = []
    for (let i = 0; i < dates.length; i++) {
      const close = lasts[i] ?? mids[i]
      if (close === null || close === undefined) continue
      observations.push({ instrument, date: unixToISODate(dates[i]), close: dollarsToCents(close) })
    }
    return observations
  }

  private async request<T extends { s: string }>(url: string): Promise<T> {
    const response = await this.fetchImpl(url)
    const body = (await response.json()) as T | ErrorBody
    // `no_data` arrives over HTTP 404 (live-verified) — it must be recognized
    // before any non-2xx status is treated as an error, or a plain closed-market
    // range (or an unknown symbol, which the provider reports identically —
    // it has no distinct unknown-symbol error) throws instead of yielding zero
    // observations.
    if (body.s === 'no_data') return body as T
    if (!response.ok || body.s === 'error') {
      // HTTP/2 responses carry an empty statusText, so an errmsg-less error
      // still needs a non-empty message to show the trader.
      const message = (body as ErrorBody).errmsg?.trim() || `HTTP ${response.status}`
      throw new MarketDataApiError(response.status, message)
    }
    return body as T
  }
}
