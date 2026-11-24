import { describe, expect, it } from 'vitest'
import { recordPositionChange, type PositionChangeCommand } from '../../src/domain/record-position-change'

const command: PositionChangeCommand = {
  trade: {
    id: 'trade-aapl',
    lifecycle: 'Planned',
    revision: '1',
    economicTime: '2026-11-24T20:00:00Z',
    plan: { underlying: 'AAPL', quantity: 10, entry: '100.00', stop: '95.00', target: '110.00', oneR: '50.00', baseline: '2.00' },
  },
  expectedRevision: '1',
  positionChangeId: 'pc-1',
  economicTime: '2026-11-24T20:00:00Z',
  executions: [
    { id: 'exec-1', instrument: 'AAPL', action: 'Buy', quantity: '6', price: '100.00', fee: '3.00', economicTime: '2026-11-24T20:00:00Z', plannedLegId: 'leg-1' },
    { id: 'exec-2', instrument: 'AAPL', action: 'Buy', quantity: '4', price: '102.50', fee: '2.00', economicTime: '2026-11-24T20:00:00Z', plannedLegId: 'leg-1' },
  ],
  reflection: {
    definitionRevision: 'D1',
    disposition: { kind: 'Complete', form: { decisionMode: 'As Planned', primaryEmotion: 'Calm', decisionConfidence: 4 } },
  },
}

describe('recordPositionChange — opening', () => {
  it('should atomically store several opening Executions as one Position Change with one shared decision identity and stable order, each bound to its Planned Leg', () => {
    const result = recordPositionChange(command)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.trade.positionChangeId).toBe('pc-1')
    expect(result.value.receipt.positionChangeId).toBe('pc-1')
    expect(result.value.trade.executions.map(e => e.id)).toEqual(['exec-1', 'exec-2'])
    expect(result.value.trade.executions.every(e => e.tradeId === 'trade-aapl' && e.plannedLegId === 'leg-1')).toBe(true)
    expect(result.value.receipt.executionIds).toEqual(['exec-1', 'exec-2'])
  })

  it('should derive and store Positions, open Lots, allocated opening fees, realized-to-date and lifecycle Open in the same commit', () => {
    const result = recordPositionChange(command)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.trade.lifecycle).toBe('Open')
    expect(result.value.trade.positions).toEqual([{ instrument: 'AAPL', netQuantity: '10', lotCount: 2 }])
    expect(result.value.trade.lots.map(l => [l.executionId, l.basis, l.allocatedOpeningFee])).toEqual([
      ['exec-1', '603.00', '3.00'], ['exec-2', '412.00', '2.00'],
    ])
    expect(result.value.trade.realizedToDate).toBe('0.00')
    expect(result.value.receipt.lifecycleTransitions).toEqual(['Planned', 'Open'])
  })

  it('should return a revision-bound post-commit result sufficient to render success without a read-back', () => {
    const result = recordPositionChange(command)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.revisions.trade).toBe('2')
    expect(result.value.postCommit.trade).toEqual(result.value.trade)
    expect(result.value.postCommit.journalOutcome).toEqual(result.value.journalOutcome)
    expect(result.value.receipt.factRevision).toBe('2')
  })

  it('should complete, decline or defer the single Position Change Reflection in the same transaction without blocking factual recording', () => {
    const deferred = recordPositionChange({ ...command, reflection: { definitionRevision: 'D1', disposition: { kind: 'Defer' } } })
    expect(deferred.ok).toBe(true)
    if (!deferred.ok) return
    expect(deferred.value.trade.lifecycle).toBe('Open')
    expect(deferred.value.journalOutcome.kind).toBe('Debt')
    expect(deferred.value.receipt.obligationKey).toBe('PositionChange:pc-1')

    const declined = recordPositionChange({ ...command, reflection: { definitionRevision: 'D1', disposition: { kind: 'Decline', reason: 'No time' } } })
    expect(declined.ok).toBe(true)
    if (!declined.ok) return
    expect(declined.value.journalOutcome.kind).toBe('Decline')
  })

  it('should reject a stale Trade revision, an unconfirmed Plan, or incoherent economics with typed issues and write nothing', () => {
    const stale = recordPositionChange({ ...command, expectedRevision: '9' })
    expect(stale.ok).toBe(false)
    if (stale.ok) return
    expect(stale.error.issues).toContain('StaleRevision')

    const unconfirmed = recordPositionChange({ ...command, trade: { ...command.trade, lifecycle: 'Abandoned' } })
    expect(unconfirmed.ok).toBe(false)
    if (unconfirmed.ok) return
    expect(unconfirmed.error.issues).toContain('NotPlanned')

    const badEconomics = recordPositionChange({ ...command, executions: [{ ...command.executions[0], price: '0' }] })
    expect(badEconomics.ok).toBe(false)
    if (badEconomics.ok) return
    expect(badEconomics.error.issues.some(i => i.startsWith('InvalidExecution'))).toBe(true)
  })

  it('should expose no valuation, Mark, disposal or close control', () => {
    const result = recordPositionChange(command)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const forbidden of ['valuation', 'mark', 'close', 'closingLotMatches']) {
      expect(Object.keys(result.value.trade)).not.toContain(forbidden)
    }
  })
})
