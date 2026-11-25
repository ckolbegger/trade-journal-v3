import { describe, expect, it } from 'vitest'
import { openDb, repo, transaction } from '../../src/persistence/db'
import { saveCloseReview } from '../../src/ui/close-review-controller'
import { getClosedTradeDetail } from '../../src/domain/open-views'
import type { ReadinessEvidence } from '../../src/domain/types'

const writable: ReadinessEvidence = {
  outcome: 'Writable', passed: true, failedChecks: [], protection: { kind: 'BestEffort', reason: 'test' },
}

describe('Closed Trade Detail narrative', () => {
  it('should attach each Journal outcome once without a second Trade read', async () => {
    const db = await openDb()
    await transaction(db, ['trade'], 'readwrite', async tx => {
      await repo.putInTx(tx, 'trade', {
        id: 'trade-narrative', lifecycle: 'Closed', revision: '3', economicTime: '2026-11-23T20:00:00Z',
        plan: { underlying: 'AAPL', quantity: 10, entry: '100.00', stop: '95.00', target: '110.00', oneR: '50.00', baseline: '2.00' },
        executions: [{ id: 'exec-narrative', tradeId: 'trade-narrative', instrument: 'AAPL', action: 'Buy', quantity: '10', price: '100', fee: '5', economicTime: '2026-11-23T20:00:00Z', recordedSequence: 1 }],
        lots: [], lotMatches: [], positions: [], realizedToDate: '0.00',
        closeReason: { id: 'seed-target-reached', label: 'Target Reached' },
        terminalDisposition: { applicable: true, kind: 'FullyDisposedByExecution', disposedQuantity: '10', mechanisms: [] },
        closeReasonRequirement: 'RequiresCloseReason',
        agreement: { lifecycle: true, lots: true, findings: [] },
      })
    })
    await saveCloseReview({
      tradeId: 'trade-narrative', definitionRevision: 'D1', economicTime: '2026-11-23T20:00:00Z',
      disposition: { kind: 'Complete', form: { takeAgain: 'No' } }, readiness: writable,
    }, db)
    const detail = await getClosedTradeDetail(db, 'trade-narrative')
    expect(detail.status).toBe('Ready')
    if (detail.status !== 'Ready') return
    expect(detail.narrative).toHaveLength(1)
    expect(detail.narrative[0]).toMatchObject({
      obligationKey: 'CloseReview:trade-narrative', kind: 'Entry', source: 'Trade Close',
    })
  })
})
