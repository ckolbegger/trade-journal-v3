import { describe, expect, it } from 'vitest'
import { replayX, replayY, sparkline, splitSegments } from '../../src/ui/replay-visual'

describe('replay visualization helpers', () => {
  it('should space sessions evenly across the chart width', () => {
    expect(replayX(0, 1, 300)).toBe(0)
    expect(replayX(1, 3, 300)).toBe(150)
    expect(replayX(2, 3, 300)).toBe(300)
  })

  it('should clamp observed Marks between the Stop and Target rails', () => {
    expect(replayY('1.00', '1.00', '7.00', 120)).toBe(120)
    expect(replayY('7.00', '1.00', '7.00', 120)).toBe(0)
    expect(replayY('4.00', '1.00', '7.00', 120)).toBe(60)
    expect(replayY('99.00', '1.00', '7.00', 120)).toBe(0)
    expect(replayY(undefined, '1.00', '7.00', 120)).toBeNull()
  })

  it('should build a named split bar from advisory decomposition only', () => {
    const decomposition = {
      kind: 'Value' as const, estimate: true as const, label: 'Estimate' as const,
      total: 1, fromUnderlying: 0.6, fromTime: 0.3, fromVolatility: 0.1, unexplained: 0,
    }
    expect(splitSegments(decomposition)).toEqual([
      { name: 'Underlying', value: 0.6 },
      { name: 'Time', value: 0.3 },
      { name: 'Volatility', value: 0.1 },
    ])
  })

  it('should draw a sparkline with one point per supplied advisory value', () => {
    const points = sparkline([1.5, 2, 1.8], 100, 40)
    expect(points.split(' ')).toHaveLength(3)
    expect(points).not.toContain('NaN')
    expect(sparkline([], 100, 40)).toBeNull()
  })
})
