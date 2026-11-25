import { describe, expect, it } from 'vitest'
import { replay, type ReplayFrame } from '../../src/domain/replay'

const frames = (values: (string | undefined)[]): ReplayFrame[] =>
  values.map((price, i) => ({
    date: `2026-11-${String(16 + i).padStart(2, '0')}`,
    status: price === undefined ? 'Missing' : 'Available',
    ...(price ? { price } : {}),
  }))

describe('replay — Stop Discipline', () => {
  it('should begin an episode at the first exact observation demonstrating breach, never earlier', () => {
    const result = replay({ tradeId: 'trade-aapl', stop: '95.00', frames: frames(['100', '94', '93']) })
    expect(result.episodes).toHaveLength(1)
    expect(result.episodes[0]).toMatchObject({ start: '2026-11-17', active: true })
    expect(result.episodes[0].dates).toEqual(['2026-11-17', '2026-11-18'])
  })

  it('should end an episode only on an exact unbreached observation', () => {
    const result = replay({ tradeId: 'trade-aapl', stop: '95.00', frames: frames(['94', '96', '97']) })
    expect(result.episodes).toHaveLength(1)
    expect(result.episodes[0]).toMatchObject({ start: '2026-11-16', end: '2026-11-17', active: false })
  })

  it('should treat a gap as first-observed and never fabricate a crossing date', () => {
    const result = replay({ tradeId: 'trade-aapl', stop: '95.00', frames: frames([undefined, '94']) })
    expect(result.gaps).toEqual(['2026-11-16'])
    expect(result.episodes[0].start).toBe('2026-11-17')
    expect(result.episodes[0].dates).not.toContain('2026-11-16')
  })

  it('should assign a stable fingerprint so one episode reconciles once', () => {
    const input = { tradeId: 'trade-aapl', stop: '95.00', frames: frames(['94', '93']) }
    expect(replay(input).episodes[0].fingerprint).toBe(replay(input).episodes[0].fingerprint)
    expect(replay(input).episodes[0].fingerprint).toContain('trade-aapl')
  })

  it('should return explicit gaps per session without interpolation or carry-forward', () => {
    const result = replay({
      tradeId: 'trade-aapl', stop: '95.00',
      frames: frames(['100', undefined, undefined, '96']),
    })
    expect(result.gaps).toEqual(['2026-11-17', '2026-11-18'])
    expect(result.episodes).toEqual([])
    expect(result.coveredDates).toEqual(['2026-11-16', '2026-11-19'])
  })
})
