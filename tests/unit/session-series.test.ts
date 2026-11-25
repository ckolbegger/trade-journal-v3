import { describe, expect, it } from 'vitest'
import { readSessionSeries } from '../../src/domain/session-series'
import type { FrameResult } from '../../src/domain/market-frames'

const framesResult = (frames: FrameResult['frames'], expectedDate = '2026-11-24'): FrameResult => ({
  expectedDate, frames, gaps: frames.filter(f => f.status === 'Missing').map(f => f.date),
  snapshotId: 'frames-test', digest: 'digest-test', sessionPolicy: 'v1',
})

describe('mark-only session replay', () => {
  it('should produce one point per completed session from exact end-of-day Marks only', () => {
    const result = readSessionSeries({
      tradeId: 'trade-aapl', stop: '95',
      framesResult: framesResult([
        { instrument: 'AAPL', date: '2026-11-20', status: 'Available', price: '100' },
        { instrument: 'AAPL', date: '2026-11-23', status: 'Available', price: '102' },
        { instrument: 'AAPL', date: '2026-11-24', status: 'Available', price: '101' },
      ]),
    })
    expect(result.sessions).toEqual([
      { date: '2026-11-20', status: 'Available', price: '100', gap: false, keyMoments: [] },
      { date: '2026-11-23', status: 'Available', price: '102', gap: false, keyMoments: [] },
      { date: '2026-11-24', status: 'Available', price: '101', gap: false, keyMoments: [] },
    ])
    expect(result.episodes).toEqual([])
  })

  it('should mark absent or acknowledged-unavailable sessions as explicit gaps without interpolation or carry-forward', () => {
    const result = readSessionSeries({
      tradeId: 'trade-aapl', stop: '95',
      framesResult: framesResult([
        { instrument: 'AAPL', date: '2026-11-20', status: 'Available', price: '100' },
        { instrument: 'AAPL', date: '2026-11-23', status: 'Missing' },
        { instrument: 'AAPL', date: '2026-11-24', status: 'AcknowledgedUnavailable' },
      ]),
    })
    expect(result.sessions[1]).toEqual({ date: '2026-11-23', status: 'Missing', gap: true, keyMoments: [] })
    expect(result.sessions[2]).toEqual({ date: '2026-11-24', status: 'AcknowledgedUnavailable', gap: true, keyMoments: [] })
    expect(result.gaps).toEqual(['2026-11-23', '2026-11-24'])
    expect(result.sessions.some(s => s.date === '2026-11-23' && 'price' in s)).toBe(false)
    expect(JSON.stringify(result)).not.toContain('carryForward')
  })

  it('should attach Stop episodes and key moments from the reused replay operation', () => {
    const result = readSessionSeries({
      tradeId: 'trade-aapl', stop: '95',
      framesResult: framesResult([
        { instrument: 'AAPL', date: '2026-11-20', status: 'Available', price: '100' },
        { instrument: 'AAPL', date: '2026-11-23', status: 'Available', price: '94' },
        { instrument: 'AAPL', date: '2026-11-24', status: 'Available', price: '96' },
      ]),
    })
    expect(result.episodes).toHaveLength(1)
    expect(result.episodes[0].start).toBe('2026-11-23')
    expect(result.episodes[0].end).toBe('2026-11-24')
    expect(result.sessions[1].keyMoments).toContain('Stop breached')
    expect(result.sessions[2].keyMoments).toContain('Stop recovered')
  })

  it('should cap the series at the expected Mark date and never require a Daily Bar', () => {
    const result = readSessionSeries({
      tradeId: 'trade-aapl', stop: '95',
      framesResult: framesResult([
        { instrument: 'AAPL', date: '2026-11-23', status: 'Available', price: '100' },
        { instrument: 'AAPL', date: '2026-11-25', status: 'Available', price: '99' },
      ], '2026-11-24'),
    })
    expect(result.sessions.map(s => s.date)).toEqual(['2026-11-23'])
    expect(result.expectedDate).toBe('2026-11-24')
    expect(Object.keys(result)).not.toContain('bars')
    expect(JSON.stringify(result)).not.toContain('ohlc')
  })
})
