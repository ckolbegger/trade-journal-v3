import { describe, expect, it } from 'vitest'
import { browsePlannedTrades, getPlannedTradeDetail } from '../../src/domain/planned-views'
import type { ConfirmPlanResult } from '../../src/domain/confirm-plan'

const trade = (id: string, label: string): ConfirmPlanResult['value'] => ({
  trade: {
    id, lifecycle: 'Planned',
    plan: { oneR: '50.00', baseline: '2.00', underlying: label, quantity: 10, entry: '100', stop: '95', target: '110' },
    economicTime: '2026-11-24T20:00:00Z',
  },
  entry: { snapshot: {} },
  revisions: { trade: '1', entry: '1', catalog: '1' },
  postCommit: { trade: {}, entry: {} },
  affectedScopes: [],
})

describe('Planned trade views', () => {
  it('should list Planned trades with Plan Baseline and entry readiness', () => {
    const view = browsePlannedTrades([trade('t1', 'AAPL'), trade('t2', 'MSFT')])
    expect(view).toHaveLength(2)
    expect(view[0]).toEqual(expect.objectContaining({ baseline: '2.00', entryReadiness: 'Ready' }))
  })

  it('should show a complete Planned detail with frozen Plan, 1R, reflection and lifecycle', () => {
    const detail = getPlannedTradeDetail(trade('t1', 'AAPL'))
    expect(detail.lifecycle).toBe('Planned')
    expect(detail.oneR).toBe('50.00')
    expect(detail.plan.underlying).toBe('AAPL')
  })

  it('should return NotFound for an unknown Trade', () => {
    expect(getPlannedTradeDetail(undefined)).toEqual({ status: 'NotFound' })
  })

  it('should include the saved Plan Reflection answers in the detail', () => {
    const withReflection = trade('t1', 'AAPL')
    withReflection.entry.snapshot = { definitionRevision: 'D1', answers: { Thesis: 'Why now', Invalidation: 'Close below 95' }, source: 'Plan Confirmation' }
    const detail = getPlannedTradeDetail(withReflection)
    const serialized = JSON.stringify(detail)
    expect(serialized).toContain('Why now')
    expect(serialized).toContain('Close below 95')
  })

  it('should never expose an Execution, Mark or close control', () => {
    const detail = getPlannedTradeDetail(trade('t1', 'AAPL'))
    const json = JSON.stringify(detail)
    for (const forbidden of ['execution', 'mark', 'closeControl']) {
      expect(json.toLowerCase()).not.toContain(forbidden)
    }
  })
})
