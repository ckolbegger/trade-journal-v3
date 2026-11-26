import { describe, expect, it } from 'vitest'
import { buildAdvisory, buildAdvisoryFrames } from '../../src/domain/advisory-frames'
import type { SessionSeries } from '../../src/domain/session-series'
import type { ObservationRecord } from '../../src/domain/market-data'

const contract = {
  underlying: 'AAPL', kind: 'Call' as const, strike: '190',
  expiration: '2026-12-18', multiplier: 100,
}

const series: SessionSeries = {
  expectedDate: '2026-11-24',
  sessions: [
    { date: '2026-11-20', status: 'Available', price: '3.00', gap: false, keyMoments: [] },
    { date: '2026-11-23', status: 'Available', price: '3.80', gap: false, keyMoments: [] },
  ],
  gaps: [], episodes: [], snapshotId: 'frames-aapl', digest: 'digest', sessionPolicy: 'v1',
}

const record = (date: string, price: string): ObservationRecord => ({
  id: `AAPL:${date}`, instrument: 'AAPL', date, revision: '1',
  marks: [{ revision: '1', price, source: 'Manual', intention: 'RecordManualMark', observedAt: `${date}T20:00:00Z`, savedAt: `${date}T20:30:00Z` }],
  acknowledgments: [],
})

const records = [record('2026-11-20', '100.00'), record('2026-11-23', '102.00')]
const trade = {
  id: 't-call', underlying: 'AAPL',
  plan: { underlying: 'AAPL', quantity: 2, contract },
}

describe('advisory frame assembly', () => {
  it('should resolve the frozen Strategy id from both plan and Trade placements', () => {
    const fromTop = buildAdvisoryFrames({
      trade: { ...trade, strategyId: 'seed-long-call' }, series, records,
    })
    const fromPlan = buildAdvisoryFrames({
      trade: { ...trade, plan: { ...trade.plan, strategyId: 'seed-long-call' } }, series, records,
    })
    expect(fromTop).toEqual(fromPlan)
    expect(fromTop[0]).toMatchObject({ kind: 'Call', strike: '190', multiplier: 100, quantity: 2, side: 1 })
  })

  it('should build exact option frames from contract, multiplier and underlying Marks', () => {
    const frames = buildAdvisoryFrames({
      trade: { ...trade, plan: { ...trade.plan, strategyId: 'seed-long-call' } }, series, records,
    })
    expect(frames).toEqual([
      { date: '2026-11-20', kind: 'Call', mark: '3.00', underlying: '100.00', strike: '190', days: 28, multiplier: 100, quantity: 2, side: 1 },
      { date: '2026-11-23', kind: 'Call', mark: '3.80', underlying: '102.00', strike: '190', days: 25, multiplier: 100, quantity: 2, side: 1 },
    ])
  })

  it('should keep the advisory result deterministic and byte-equivalent with the capability off', () => {
    const input = {
      trade: { ...trade, strategyId: 'seed-long-call' }, series, records,
    }
    expect(buildAdvisory({ ...input, installed: false })).toBeNull()
    const on = buildAdvisory({ ...input, installed: true })
    expect(buildAdvisory({ ...input, installed: true })).toEqual(on)
    expect(on && Object.keys(on).sort()).toEqual(['decomposition', 'iv', 'shareEquivalent'])
  })

  it('should return the same stable Unavailable reasons for missing evidence', () => {
    const tinyMark: SessionSeries = {
      ...series,
      sessions: series.sessions.map(s => ({ ...s, price: '0.01' })),
    }
    const advisory = buildAdvisory({
      trade: { ...trade, strategyId: 'seed-long-call' }, series: tinyMark, records, installed: true,
    })
    expect(advisory?.shareEquivalent?.kind).toBe('Unavailable')
    expect(advisory?.decomposition?.kind).toBe('Unavailable')
    expect(JSON.stringify(advisory)).toContain('no volatility fits')
  })

  it('should never feed an advisory value into valuation, P&L, risk, payoff or reports', () => {
    const advisory = buildAdvisory({
      trade: { ...trade, strategyId: 'seed-long-call' }, series, records, installed: true,
    })
    const json = JSON.stringify(advisory)
    for (const forbidden of ['payoff', 'valuation', 'realized', 'stopTarget', 'report']) {
      expect(json).not.toContain(forbidden)
    }
    expect(advisory?.iv?.kind).toBe('Value')
  })
})
