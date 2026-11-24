import { describe, expect, it } from 'vitest'
import { confirmPlan } from '../../src/domain/confirm-plan'
import type { PlanInput } from '../../src/domain/assess-plan'

const base = {
  account: { id: 'acct-1', institutionId: 'inst-1', label: 'Main', active: true, revision: '1', history: [] },
  strategy: { id: 'seed-long-stock', label: 'Long Stock', active: true, revision: '1' },
  plan: {
    strategyId: 'seed-long-stock', underlying: 'AAPL', quantity: 10,
    entry: '100.00', stop: '95.00', target: '110.00',
  } satisfies PlanInput,
  reflection: { thesis: 'Why now', invalidation: 'Close below 50d' },
  definitionRevision: 'D1',
  economicTime: '2026-11-24T20:00:00Z',
}

describe('confirmPlan', () => {
  it('should atomically create Trade, frozen Plan, Planned lifecycle and one completed Plan Reflection', () => {
    const result = confirmPlan(base)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.trade.lifecycle).toBe('Planned')
      expect(result.value.trade.plan.oneR).toBe('50.00')
      expect(result.value.entry.snapshot.source).toBe('Plan Confirmation')
      expect(result.value.revisions.trade).toBe('1')
    }
  })

  it('should return a revision-bound post-commit result sufficient to render success without a read-back', () => {
    const result = confirmPlan(base)
    if (result.ok) expect(result.value.postCommit).toEqual(expect.objectContaining({ trade: expect.anything(), entry: expect.anything() }))
  })

  it('should reject a stale Account revision and write nothing', () => {
    const result = confirmPlan({ ...base, accountRevision: '1', account: { ...base.account, revision: '99' } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.issues).toContain('StaleAccount')
  })

  it('should reject an inactive Strategy new selection and write nothing', () => {
    const result = confirmPlan({ ...base, strategy: { ...base.strategy, active: false } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.issues).toContain('InactiveStrategy')
  })

  it('should reject a missing Plan Reflection answer and write nothing', () => {
    const result = confirmPlan({ ...base, reflection: { thesis: '', invalidation: 'I' } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.issues).toContain('Thesis')
  })
})
