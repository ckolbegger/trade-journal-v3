import { describe, expect, it } from 'vitest'
import * as deriveModule from '../../src/domain/derive'
import * as workflowModule from '../../src/domain/record-position-change'
import * as reflectionModule from '../../src/domain/position-change-reflection'

describe('D3 public contract (S3 structural)', () => {
  it('should expose derive, recordPositionChange and reflection preparation without a lifecycle setter', () => {
    expect(typeof deriveModule.derive).toBe('function')
    expect(typeof workflowModule.recordPositionChange).toBe('function')
    expect(typeof reflectionModule.preparePositionChangeReflection).toBe('function')
    for (const forbidden of ['setLifecycle', 'recordExecution', 'closeTrade', 'formula']) {
      expect(Object.keys(deriveModule)).not.toContain(forbidden)
      expect(Object.keys(workflowModule)).not.toContain(forbidden)
    }
  })

  it('should return a receipt and a post-commit projection from one command call', () => {
    const result = workflowModule.recordPositionChange({
      trade: {
        id: 'trade-c', lifecycle: 'Planned', revision: '1', economicTime: '2026-11-24T20:00:00Z',
        plan: { underlying: 'AAPL', quantity: 1, entry: '100', stop: '95', target: '110', oneR: '5.00', baseline: '2.00' },
      },
      expectedRevision: '1', positionChangeId: 'pc-c', economicTime: '2026-11-24T20:00:00Z',
      executions: [{ id: 'exec-c', instrument: 'AAPL', action: 'Buy', quantity: '1', price: '100', fee: '1', economicTime: '2026-11-24T20:00:00Z', plannedLegId: 'leg-1' }],
      reflection: { definitionRevision: 'D1', disposition: { kind: 'Defer' } },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.receipt.tradeId).toBe('trade-c')
    expect(result.value.postCommit.trade).toEqual(result.value.trade)
  })
})
