import { describe, expect, it } from 'vitest'
import { assessOptionPlan, type OptionPlanInput } from '../../src/domain/option-plan'
import type { OptionContract } from '../../src/domain/option-contract'

const contract: OptionContract = {
  underlying: 'AAPL', kind: 'Call', strike: '190', expiration: '2026-12-18', multiplier: 100,
}
const input: OptionPlanInput = {
  strategyId: 'seed-long-call', contract, quantity: 2,
  entry: '3.00', stop: '1.00', target: '7.00',
}

describe('option Plan assessment', () => {
  it('should compute positive dollar 1R and a positive numeric Plan Baseline from exact contract economics', () => {
    const result = assessOptionPlan(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({
      oneR: '400.00', originalPlannedRisk: '400.00', originalPlannedReward: '800.00',
      baseline: '2.00', contractInstrument: 'AAPL 190Call 2026-12-18 x100',
    })
    expect(Number(result.value.baseline)).toBeGreaterThan(0)
  })

  it('should compute a short Put Baseline with the same multiplier arithmetic', () => {
    const result = assessOptionPlan({
      ...input, strategyId: 'seed-cash-secured-put',
      contract: { ...contract, kind: 'Put' }, entry: '2.00', stop: '4.00', target: '0.50',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.oneR).toBe('400.00')
    expect(result.value.originalPlannedReward).toBe('300.00')
    expect(result.value.baseline).toBe('0.75')
  })

  it('should reject a nonpositive risk, invalid number or incomplete exact contract', () => {
    expect(assessOptionPlan({ ...input, stop: '3.00' })).toMatchObject({ ok: false, error: { issues: ['NonPositiveRisk'] } })
    expect(assessOptionPlan({ ...input, entry: 'abc' })).toMatchObject({ ok: false, error: { issues: ['InvalidNumber'] } })
    expect(assessOptionPlan({ ...input, quantity: 0 })).toMatchObject({ ok: false, error: { issues: ['IncompleteLeg'] } })
  })

  it('should reject a Strategy shape whose role does not match the contract kind', () => {
    expect(assessOptionPlan({ ...input, contract: { ...contract, kind: 'Put' } })).toMatchObject({
      ok: false, error: { issues: ['StrategyShape'] },
    })
  })

  it('should freeze the Planned Leg and original management without a theoretical option price', () => {
    const result = assessOptionPlan(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.plannedLeg).toEqual({
      contract, quantity: 2, openingAction: 'Buy',
    })
    expect(result.value.management).toEqual({ stop: '1.00', target: '7.00' })
    expect(JSON.stringify(result.value)).not.toContain('theoretical')
    expect(result.value.evidenceRequirements).toContain('executions')
  })
})
