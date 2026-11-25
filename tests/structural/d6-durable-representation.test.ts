import { describe, expect, it } from 'vitest'
import type { ClosedTradeProjection } from '../../src/domain/record-close'
import { deriveTerminalDisposition } from '../../src/domain/close'

describe('D6 durable representation (S2 structural)', () => {
  it('should store match links with matched quantity and allocated fees but no price or P&L', () => {
    const trade: ClosedTradeProjection = {
      id: 'trade-x', lifecycle: 'Closed', revision: '3', economicTime: '2026-11-25T20:00:00Z',
      plan: { underlying: 'AAPL', quantity: 10, entry: '100.00', stop: '95.00', target: '110.00', oneR: '50.00', baseline: '2.00' },
      positionChangeId: 'pc-close', executions: [], lots: [],
      lotMatches: [{ id: 'match-1', executionId: 'close-exec', lotId: 'lot-open', matchingMethod: 'FIFO', quantity: '10', allocatedOpeningFee: '5.00', allocatedDisposalFee: '4.00' }],
      positions: [], realizedToDate: '91.00',
      closeReason: { id: 'seed-target-reached', label: 'Target Reached' },
      terminalDisposition: { applicable: true, kind: 'FullyDisposedByExecution', disposedQuantity: '10', mechanisms: [{ kind: 'Execution', quantity: '10' }] },
      closeReasonRequirement: 'RequiresCloseReason',
      agreement: { lifecycle: true, lots: true, findings: [] },
    }
    expect(trade.lifecycle).toBe('Closed')
    expect(trade.lotMatches[0]).toMatchObject({ matchingMethod: 'FIFO', quantity: '10' })
    for (const forbidden of ['price', 'basis', 'realizedPnl']) {
      expect(Object.keys(trade.lotMatches[0])).not.toContain(forbidden)
    }
    expect(trade).toHaveProperty('closeReason')
    expect(trade).toHaveProperty('terminalDisposition')
    expect(trade).not.toHaveProperty('setLifecycle')
  })

  it('should keep Terminal Disposition derived and Close Reason as a separate stable fact', () => {
    const disposition = deriveTerminalDisposition([], false)
    expect(disposition).toEqual({ applicable: false, kind: 'NotApplicable', mechanisms: [] })
  })
})
