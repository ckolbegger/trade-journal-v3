import { describe, it, expect, vi } from 'vitest'
import { MarketDataAdapter, MarketDataApiError } from './marketdata-adapter'

// Fake HTTP transport — no live network in unit tests (JIT / TDD skill: test at
// the adapter's own seam, not the real provider). `url` isn't asserted directly
// here; response shapes come from the verified provider-decision block in
// docs/plan/slice-04-automated-pricing.md.
function fakeResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'irrelevant',
    json: async () => body,
  }
}

describe('MarketDataAdapter', () => {
  it('supports stock instruments and the covered option contracts', () => {
    const adapter = new MarketDataAdapter('key')
    expect(adapter.supports('AAPL')).toBe(true)
    expect(adapter.supports('AAPL 2027-12-17 C 300')).toBe(true)
  })

  it('declines instruments it cannot serve', () => {
    const adapter = new MarketDataAdapter('key')
    expect(adapter.supports('')).toBe(false)
    expect(adapter.supports('aapl')).toBe(false) // not our canonical uppercase form
    expect(adapter.supports('AAPL 2027-13-45 X 9999')).toBe(false) // bad month/day, bad type char
  })

  it('maps a stock candles response to SourceObservations (instrument, date, close)', async () => {
    const fetchImpl = vi.fn(async () =>
      fakeResponse(203, {
        s: 'ok',
        t: [1783915200, 1784001600, 1784088000],
        c: [317.31, 314.86, 327.5],
      }),
    )
    const adapter = new MarketDataAdapter('key', fetchImpl)

    const observations = await adapter.fetch(['AAPL'], { from: '2026-07-13', to: '2026-07-15' })

    expect(observations).toEqual([
      { instrument: 'AAPL', date: '2026-07-13', close: 31731 },
      { instrument: 'AAPL', date: '2026-07-14', close: 31486 },
      { instrument: 'AAPL', date: '2026-07-15', close: 32750 },
    ])
  })

  it('maps an option quotes response, preferring last and falling back to mid', async () => {
    const fetchImpl = vi.fn(async () =>
      fakeResponse(203, {
        s: 'ok',
        updated: [1783972800, 1784059200, 1784145600],
        last: [60.94, null, 68.59],
        mid: [61.45, 59.62, 68.95],
      }),
    )
    const adapter = new MarketDataAdapter('key', fetchImpl)

    const observations = await adapter.fetch(['AAPL 2027-12-17 C 300'], {
      from: '2026-07-13',
      to: '2026-07-15',
    })

    expect(observations).toEqual([
      { instrument: 'AAPL 2027-12-17 C 300', date: '2026-07-13', close: 6094 },
      { instrument: 'AAPL 2027-12-17 C 300', date: '2026-07-14', close: 5962 }, // last null -> mid
      { instrument: 'AAPL 2027-12-17 C 300', date: '2026-07-15', close: 6859 },
    ])
  })

  it('returns observations only for dates the provider returned (closed days absent, never zero-filled)', async () => {
    // Requested Fri..Mon, but the provider only returned Friday and Monday —
    // the weekend is simply absent from the arrays, not zero-filled.
    const fetchImpl = vi.fn(async () =>
      fakeResponse(203, { s: 'ok', t: [1783915200, 1784174400], c: [317.31, 333.26] }),
    )
    const adapter = new MarketDataAdapter('key', fetchImpl)

    const observations = await adapter.fetch(['AAPL'], { from: '2026-07-13', to: '2026-07-16' })

    expect(observations.map((o) => o.date)).toEqual(['2026-07-13', '2026-07-16'])
  })

  it('returns no observations when the provider reports no_data for the whole range (arrives as HTTP 404, live-verified)', async () => {
    const fetchImpl = vi.fn(async () =>
      fakeResponse(404, { s: 'no_data', prevTime: null, nextTime: null }),
    )
    const adapter = new MarketDataAdapter('key', fetchImpl)

    const observations = await adapter.fetch(['MSFT'], { from: '2026-07-18', to: '2026-07-18' })

    expect(observations).toEqual([])
  })

  it('surfaces a bad key as a typed 401 error carrying the provider message', async () => {
    const fetchImpl = vi.fn(async () =>
      fakeResponse(401, { s: 'error', errmsg: 'Invalid token header. No credentials provided.' }),
    )
    const adapter = new MarketDataAdapter('bad-key', fetchImpl)

    await expect(
      adapter.fetch(['AAPL'], { from: '2026-07-13', to: '2026-07-13' }),
    ).rejects.toMatchObject({
      status: 401,
      message: 'Invalid token header. No credentials provided.',
    })
    await expect(
      adapter.fetch(['AAPL'], { from: '2026-07-13', to: '2026-07-13' }),
    ).rejects.toBeInstanceOf(MarketDataApiError)
  })

  it('surfaces a rate limit as a typed 429 error carrying the provider message', async () => {
    const fetchImpl = vi.fn(async () =>
      fakeResponse(429, { s: 'error', errmsg: 'You have exceeded the rate limit.' }),
    )
    const adapter = new MarketDataAdapter('key', fetchImpl)

    await expect(
      adapter.fetch(['AAPL'], { from: '2026-07-13', to: '2026-07-13' }),
    ).rejects.toMatchObject({ status: 429, message: 'You have exceeded the rate limit.' })
  })

  it('treats an unknown symbol as zero observations — indistinguishable from a closed-market range (live-verified: the provider has no distinct unknown-symbol error)', async () => {
    const fetchImpl = vi.fn(async () =>
      fakeResponse(404, { s: 'no_data', prevTime: null, nextTime: null }),
    )
    const adapter = new MarketDataAdapter('key', fetchImpl)

    const observations = await adapter.fetch(['ZZZZ'], { from: '2026-07-13', to: '2026-07-13' })

    expect(observations).toEqual([])
  })

  it('falls back to "HTTP <status>" when the provider omits an error message (HTTP/2 responses carry an empty statusText)', async () => {
    const fetchImpl = vi.fn(async () => fakeResponse(401, { s: 'error' }))
    const adapter = new MarketDataAdapter('key', fetchImpl)

    await expect(
      adapter.fetch(['MSFT'], { from: '2026-07-13', to: '2026-07-13' }),
    ).rejects.toMatchObject({ status: 401, message: 'HTTP 401' })
  })
})
