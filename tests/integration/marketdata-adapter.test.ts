import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  MarketDataAdapter,
  MarketDataApiError,
} from '@/books/pricebook/adapters/marketdata-adapter'

// S4.1.T4 — the adapter exercised against recorded fixtures (real responses
// captured live via curl against api.marketdata.app, per the provider-decision
// block in docs/plan/slice-04-automated-pricing.md). No live HTTP in CI: the
// fixtures stand in for the network via an injected fetch.

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'marketdata')

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf-8'))
}

function fetchReturning(body: unknown, status = 203) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'irrelevant',
    json: async () => body,
  }))
}

describe('MarketDataAdapter against recorded fixtures', () => {
  it('maps a recorded 3-day stock candles response to SourceObservations', async () => {
    const fetchImpl = fetchReturning(loadFixture('stock-candles-3day.json'))
    const adapter = new MarketDataAdapter('key', fetchImpl)

    const observations = await adapter.fetch(['AAPL'], { from: '2026-07-13', to: '2026-07-15' })

    expect(observations).toEqual([
      { instrument: 'AAPL', date: '2026-07-13', close: 31731 },
      { instrument: 'AAPL', date: '2026-07-14', close: 31486 },
      { instrument: 'AAPL', date: '2026-07-15', close: 32750 },
    ])
  })

  it('maps a recorded 3-day option quotes response to SourceObservations', async () => {
    const fetchImpl = fetchReturning(loadFixture('option-quotes-3day.json'))
    const adapter = new MarketDataAdapter('key', fetchImpl)

    const observations = await adapter.fetch(['AAPL 2027-12-17 C 300'], {
      from: '2026-07-13',
      to: '2026-07-15',
    })

    expect(observations).toEqual([
      { instrument: 'AAPL 2027-12-17 C 300', date: '2026-07-13', close: 6094 },
      { instrument: 'AAPL 2027-12-17 C 300', date: '2026-07-14', close: 5916 },
      { instrument: 'AAPL 2027-12-17 C 300', date: '2026-07-15', close: 6859 },
    ])
  })

  it('surfaces a recorded 401 bad-key response as a typed error carrying the provider message verbatim', async () => {
    const fetchImpl = fetchReturning(loadFixture('error-401-bad-key.json'), 401)
    const adapter = new MarketDataAdapter('bad-key', fetchImpl)

    const failure = adapter.fetch(['AAPL'], { from: '2026-07-13', to: '2026-07-15' })

    await expect(failure).rejects.toBeInstanceOf(MarketDataApiError)
    await expect(failure).rejects.toMatchObject({
      status: 401,
      message: 'Invalid token header. No credentials provided.',
    })
  })

  // Live-verified (T6, 2026-07-18): a closed-market range (and an unknown
  // symbol, which the provider reports identically) arrives as HTTP 404 with
  // this exact no_data body — it must map to zero observations, not an error.
  it('maps a recorded 404 no_data response to zero observations', async () => {
    const fetchImpl = fetchReturning(loadFixture('no-data-404.json'), 404)
    const adapter = new MarketDataAdapter('key', fetchImpl)

    const observations = await adapter.fetch(['MSFT'], { from: '2026-07-18', to: '2026-07-18' })

    expect(observations).toEqual([])
  })
})
