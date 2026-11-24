import { describe, expect, it } from 'vitest'
import { openDb, repo, transaction } from '../../src/persistence/db'
import { saveManualMark, evaluateOpenTrade } from '../../src/ui/market-controller'
import { recordOpeningPositionChange } from '../../src/ui/position-controller'
import type { StoredOpenTrade } from '../../src/domain/open-views'
import type { ReadinessEvidence } from '../../src/domain/types'

const writable: ReadinessEvidence = {
  outcome: 'Writable', passed: true, failedChecks: [], protection: { kind: 'BestEffort', reason: 'test' },
}

async function openTrade() {
  const db = await openDb()
  await transaction(db, ['trade'], 'readwrite', async tx => {
    await repo.putInTx(tx, 'trade', {
      id: 'trade-eval', lifecycle: 'Planned', revision: '1', economicTime: '2026-11-23T20:00:00Z',
      plan: { underlying: 'AAPL', quantity: 10, entry: '100.00', stop: '95.00', target: '110.00', oneR: '50.00', baseline: '2.00' },
    })
    await repo.putInTx(tx, 'trade', { id: 'lifecycle-index', members: { Planned: ['trade-eval'], Open: [], Closed: [], Abandoned: [] } })
  })
  const result = await recordOpeningPositionChange({
    tradeId: 'trade-eval', expectedRevision: '1', positionChangeId: 'pc-eval',
    economicTime: '2026-11-23T20:00:00Z',
    executions: [{ id: 'exec-eval', instrument: 'AAPL', action: 'Buy', quantity: '10', price: '100.00', fee: '5.00', economicTime: '2026-11-23T20:00:00Z', plannedLegId: 'leg-1' }],
    reflection: { definitionRevision: 'D1', disposition: { kind: 'Defer' } },
    readiness: writable,
  }, db)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error('setup failed')
  return { db, trade: result.value.trade as StoredOpenTrade }
}

describe('evaluate integration (mock-free)', () => {
  it('should keep realized-to-date a Value and mark-dependent figures Unavailable before a Mark', async () => {
    const { db, trade } = await openTrade()
    const result = await evaluateOpenTrade(trade, db, new Date('2026-11-24T17:00:00Z'))
    expect(result.evaluation.realizedToDate).toEqual({ kind: 'Value', value: '0.00' })
    expect(result.evaluation.markedPnl).toMatchObject({ kind: 'Unavailable', reason: 'ExpectedMarkMissing' })
    expect(result.expectedDate).toBe('2026-11-23')
  })

  it('should evaluate an Open Trade against a persisted exact-date Mark', async () => {
    const { db, trade } = await openTrade()
    await saveManualMark({
      instrument: 'AAPL', date: '2026-11-23', expectedRevision: '0', intention: 'RecordManualMark',
      price: '105.00', observedAt: '2026-11-23T20:00:00Z', savedAt: '2026-11-23T20:05:00Z', readiness: writable,
    }, db)
    const result = await evaluateOpenTrade(trade, db, new Date('2026-11-24T17:00:00Z'))
    expect(result.evaluation.markedPnl).toEqual({ kind: 'Value', value: '45.00' })
    expect(result.evaluation.ongoingRiskToStop).toEqual({ kind: 'Value', value: '100.00' })
    expect(result.evaluation.oneR).toEqual({ kind: 'Value', value: '50.00' })
    expect(result.frame).toMatchObject({ status: 'Available', price: '105.00' })
  })
})
