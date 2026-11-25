import { describe, expect, it } from 'vitest'
import { recordClose, type CloseCommand } from '../../src/domain/record-close'
import type { ExecutionFact } from '../../src/domain/derive'

const catalog = {
  closeReasons: [
    { id: 'seed-target-reached', label: 'Target Reached', origin: 'product' },
    { id: 'seed-stop-triggered', label: 'Stop Triggered', origin: 'product' },
  ],
}

const opening: ExecutionFact = {
  id: 'exec-open', tradeId: 'trade-close', positionChangeId: 'pc-open', instrument: 'AAPL',
  action: 'Buy', quantity: '10', price: '100.00', fee: '5.00',
  economicTime: '2026-11-24T20:00:00Z', recordedSequence: 1, plannedLegId: 'leg-1',
}

const command = (overrides: Partial<CloseCommand> = {}): CloseCommand => ({
  trade: {
    id: 'trade-close', lifecycle: 'Open', revision: '2', economicTime: '2026-11-24T20:00:00Z',
    plan: { underlying: 'AAPL', quantity: 10, entry: '100.00', stop: '95.00', target: '110.00', oneR: '50.00', baseline: '2.00' },
    executions: [opening],
    lots: [{ id: 'lot-exec-open', executionId: 'exec-open', instrument: 'AAPL', quantity: '10', basis: '1005.00', allocatedOpeningFee: '5.00', economicTime: '2026-11-24T20:00:00Z', recordedSequence: 1 }],
  },
  expectedRevision: '2',
  positionChangeId: 'pc-close',
  economicTime: '2026-11-25T20:00:00Z',
  executions: [{ id: 'exec-close', instrument: 'AAPL', quantity: '10', price: '110.00', fee: '4.00', economicTime: '2026-11-25T20:00:00Z' }],
  closeReason: 'Target Reached',
  catalog,
  reflection: { definitionRevision: 'D1', disposition: { kind: 'Defer' } },
  ...overrides,
})

describe('recordClose — terminal Long Stock', () => {
  it('should reject a stale revision, a non-Open Trade, no disposal, oversell and an unresolved Close Reason with typed issues', () => {
    expect(recordClose(command({ expectedRevision: '1' }))).toMatchObject({ ok: false, error: { issues: ['StaleRevision'] } })
    expect(recordClose(command({ trade: { ...command().trade, lifecycle: 'Closed' } }))).toMatchObject({ ok: false, error: { issues: ['NotOpen'] } })
    expect(recordClose(command({ executions: [] }))).toMatchObject({ ok: false, error: { issues: ['NoExecutions'] } })
    expect(recordClose(command({ executions: [{ ...command().executions[0], quantity: '999' }] }))).toMatchObject({ ok: false, error: { issues: ['IncoherentEconomicFacts'] } })
    expect(recordClose(command({ closeReason: 'Expired' }))).toMatchObject({ ok: false, error: { issues: ['CloseReasonUnknown'] } })
    expect(recordClose(command({ closeReason: '' }))).toMatchObject({ ok: false, error: { issues: ['CloseReasonMissing'] } })
  })

  it('should return a receipt and a post-commit Closed projection bound to the committed revision without a read-back', () => {
    const result = recordClose(command())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.receipt).toMatchObject({
      tradeId: 'trade-close', factRevision: '3', positionChangeId: 'pc-close',
      lifecycleTransitions: ['Open', 'Closed'], obligationKey: 'PositionChange:pc-close',
      closeReason: { id: 'seed-target-reached', label: 'Target Reached' },
      realizedToDate: '91.00',
    })
    expect(result.value.trade).toMatchObject({
      id: 'trade-close', lifecycle: 'Closed', revision: '3', realizedToDate: '91.00',
      closeReason: { id: 'seed-target-reached', label: 'Target Reached' },
      terminalDisposition: { applicable: true, kind: 'FullyDisposedByExecution', disposedQuantity: '10' },
    })
    expect(result.value.trade.lotMatches).toHaveLength(1)
    expect(result.value.postCommit.trade).toEqual(result.value.trade)
    expect(result.value.postCommit.journalOutcome).toEqual(result.value.journalOutcome)
    expect(result.value.revisions).toEqual({ trade: '3', journal: '1' })
  })

  it('should prepare the Position Change Reflection for the closing Position Change under its own obligation key', () => {
    const result = recordClose(command())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.journalOutcome.obligationKey).toBe('PositionChange:pc-close')
    expect(result.value.journalOutcome.kind).toBe('Debt')
    expect(result.value.receipt.journalOutcomeId).toBe('Debt-pc-close')
  })

  it('should report no integrity finding for a clean close and reject a pre-close lot disagreement', () => {
    const clean = recordClose(command())
    expect(clean.ok).toBe(true)
    if (!clean.ok) return
    expect(clean.value.trade.agreement.findings).toEqual([])
    expect(clean.value.trade.agreement.lots).toBe(true)

    const disagreeing = recordClose(command({
      trade: { ...command().trade, lots: [{ ...command().trade.lots[0], quantity: '9' }] },
    }))
    expect(disagreeing.ok).toBe(false)
    if (disagreeing.ok) return
    expect(disagreeing.error.issues).toContain('StoredLotDisagreement')
  })

  it('should derive Terminal Disposition separately from the Close Reason and expose no stored disposition setter', () => {
    const result = recordClose(command())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.trade.terminalDisposition.kind).toBe('FullyDisposedByExecution')
    expect(Object.keys(result.value.trade)).not.toContain('setTerminalDisposition')
    expect(Object.keys(result.value.trade)).not.toContain('closeTrade')
  })
})
