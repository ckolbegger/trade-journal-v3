import { describe, expect, it } from 'vitest'
import { resolveStrategyShape } from '../../src/domain/strategy-shapes'
import { SEED_MANIFEST } from '../../src/domain/seeds'

describe('D8 Strategy shapes and vocabulary (S3 structural)', () => {
  it('should resolve only the three seeded single-leg shapes', () => {
    for (const label of ['Long Call', 'Long Put', 'Cash-Secured Put']) {
      const id = `seed-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`
      expect(SEED_MANIFEST.strategies).toContain(label)
      expect(resolveStrategyShape(id).ok).toBe(true)
    }
    expect(resolveStrategyShape('seed-covered-call').ok).toBe(false)
    expect(Object.keys(resolveStrategyShape('seed-long-call')).length).toBeGreaterThan(0)
  })

  it('should expose only the fixed fulfillment and deviation vocabularies', () => {
    const shapes = resolveStrategyShape('seed-long-call')
    expect(shapes.ok).toBe(true)
    if (!shapes.ok) return
    expect(shapes.value.role).toBe('Long Call')
    expect(shapes.value.expectedKind).toBe('Call')
  })
})
