import { describe, expect, it } from 'vitest'
import { assessPlan } from '../../src/domain/assess-plan'

const longStock = {
  strategyId: 'seed-long-stock',
  underlying: 'AAPL',
  quantity: 10,
  entry: '100.00',
  stop: '95.00',
  target: '110.00',
}

describe('assessPlan — Long Stock', () => {
  it('should compute a positive numeric Plan Baseline and 1R equal to Original Planned Risk using exact decimal arithmetic', () => {
    const result = assessPlan(longStock)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.oneR).toBe('50.00')
      expect(result.value.originalPlannedRisk).toBe('50.00')
      expect(result.value.originalPlannedReward).toBe('100.00')
      expect(result.value.baseline).toBe('2.00')
    }
  })

  it('should keep exact cents across boundaries without float drift', () => {
    const result = assessPlan({ ...longStock, entry: '100.01', stop: '99.99', quantity: 3 })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.oneR).toBe('0.06')
  })

  it('should accept one long Stock Planned Leg with a complete exact underlying and positive quantity', () => {
    expect(assessPlan(longStock).ok).toBe(true)
  })

  it('should reject an incoherent Strategy shape with typed issues and write nothing', () => {
    const result = assessPlan({ ...longStock, strategyId: 'seed-iron-condor' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.issues).toContain('StrategyShape')
  })

  it('should reject a non-numeric or non-positive baseline with typed issues', () => {
    const noRisk = assessPlan({ ...longStock, entry: '100', stop: '100' })
    expect(noRisk.ok).toBe(false)
    if (!noRisk.ok) expect(noRisk.error.issues).toContain('NonPositiveRisk')
    const invalid = assessPlan({ ...longStock, entry: 'abc' })
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) expect(invalid.error.issues).toContain('InvalidNumber')
  })

  it('should return conformance-evidence requirements', () => {
    const result = assessPlan(longStock)
    if (result.ok) expect(result.value.evidenceRequirements).toContain('executions')
  })
})
