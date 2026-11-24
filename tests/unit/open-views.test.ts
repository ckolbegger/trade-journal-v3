import { describe, expect, it } from 'vitest'
import { toAnalysisInput, toBrowseRows, toDetail, toHistoryView } from '../../src/domain/open-views'
import type { OpenTradeProjection } from '../../src/domain/record-position-change'

const trade: OpenTradeProjection = {
  id: 'trade-aapl',
  lifecycle: 'Open',
  revision: '2',
  economicTime: '2026-11-24T20:00:00Z',
  plan: { underlying: 'AAPL', quantity: 10, entry: '100.00', stop: '95.00', target: '110.00', oneR: '50.00', baseline: '2.00' },
  positionChangeId: 'pc-1',
  executions: [
    { id: 'exec-1', tradeId: 'trade-aapl', positionChangeId: 'pc-1', instrument: 'AAPL', action: 'Buy', quantity: '6', price: '100.00', fee: '3.00', economicTime: '2026-11-24T20:00:00Z', recordedSequence: 1, plannedLegId: 'leg-1' },
    { id: 'exec-2', tradeId: 'trade-aapl', positionChangeId: 'pc-1', instrument: 'AAPL', action: 'Buy', quantity: '4', price: '102.50', fee: '2.00', economicTime: '2026-11-24T20:00:00Z', recordedSequence: 2, plannedLegId: 'leg-1' },
  ],
  lots: [
    { id: 'lot-exec-1', executionId: 'exec-1', instrument: 'AAPL', quantity: '6', basis: '603.00', allocatedOpeningFee: '3.00', economicTime: '2026-11-24T20:00:00Z', recordedSequence: 1 },
    { id: 'lot-exec-2', executionId: 'exec-2', instrument: 'AAPL', quantity: '4', basis: '412.00', allocatedOpeningFee: '2.00', economicTime: '2026-11-24T20:00:00Z', recordedSequence: 2 },
  ],
  positions: [{ instrument: 'AAPL', netQuantity: '10', lotCount: 2 }],
  realizedToDate: '0.00',
}

describe('Open trade reads', () => {
  it('should return one AnalysisInput projection at a single FactRevision for an Open Trade with its Executions and Lots', () => {
    const view = toAnalysisInput(trade)
    expect(view.tradeId).toBe('trade-aapl')
    expect(view.factRevision).toBe('2')
    expect(view.executions).toHaveLength(2)
    expect(view.lots).toHaveLength(2)
    expect(view.lifecycle).toBe('Open')
  })

  it('should list Open Trades from the lifecycle index with Position and allocated fees', () => {
    const rows = toBrowseRows([trade])
    expect(rows).toEqual([{
      id: 'trade-aapl', lifecycle: 'Open', underlying: 'AAPL',
      netQuantity: '10', allocatedOpeningFees: '5.00', factRevision: '2',
    }])
  })

  it('should return complete history with Execution Economic Time and Recorded Sequence', () => {
    const history = toHistoryView(trade)
    expect(history.map(h => [h.id, h.economicTime, h.recordedSequence])).toEqual([
      ['exec-1', '2026-11-24T20:00:00Z', 1],
      ['exec-2', '2026-11-24T20:00:00Z', 2],
    ])
  })

  it('should return NotFound for an unknown Trade and never repair a disagreement as a side effect of reading', () => {
    expect(toDetail(undefined)).toEqual({ status: 'NotFound' })
    const before = JSON.stringify(trade)
    const detail = toDetail({ ...trade, agreement: { lifecycle: false, lots: true, findings: ['StoredLifecycleDisagreement'] } })
    expect(detail.status).toBe('Ready')
    if (detail.status !== 'Ready') return
    expect(detail.integrity).toEqual({ agreement: false, findings: ['StoredLifecycleDisagreement'] })
    expect(JSON.stringify(trade)).toBe(before)
  })
})
