import { describe, expect, it } from 'vitest'
import { derive, type TradeDerivationInput } from '../../src/domain/derive'

const input: TradeDerivationInput = {
  tradeId: 'trade-aapl',
  storedLifecycle: 'Planned',
  plan: {
    underlying: 'AAPL', quantity: 10, entry: '100.00', stop: '95.00',
    target: '110.00', oneR: '50.00', baseline: '2.00',
  },
  executions: [
    { id: 'exec-1', instrument: 'AAPL', action: 'Buy', quantity: '6', price: '100.00', fee: '3.00', economicTime: '2026-11-24T20:00:00Z', recordedSequence: 1, plannedLegId: 'leg-1' },
    { id: 'exec-2', instrument: 'AAPL', action: 'Buy', quantity: '4', price: '102.50', fee: '2.00', economicTime: '2026-11-24T20:00:00Z', recordedSequence: 2, plannedLegId: 'leg-1' },
  ],
}

describe('derive — opening Long Stock', () => {
  it('should derive one Instrument Position with exact signed net quantity from effective opening Executions ordered by Economic Time then Recorded Sequence', () => {
    const result = derive(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.effectiveFacts.map(f => f.id)).toEqual(['exec-1', 'exec-2'])
    expect(result.value.positions).toEqual([{ instrument: 'AAPL', netQuantity: '10', lotCount: 2 }])
  })

  it('should create open Lots with exact basis and allocate each opening fee proportionally across its Lot quantities exactly once', () => {
    const result = derive(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.lots).toEqual([
      { id: 'lot-exec-1', executionId: 'exec-1', instrument: 'AAPL', quantity: '6', basis: '603.00', allocatedOpeningFee: '3.00', economicTime: '2026-11-24T20:00:00Z', recordedSequence: 1 },
      { id: 'lot-exec-2', executionId: 'exec-2', instrument: 'AAPL', quantity: '4', basis: '412.00', allocatedOpeningFee: '2.00', economicTime: '2026-11-24T20:00:00Z', recordedSequence: 2 },
    ])
  })

  it('should report realized-to-date as zero with no disposal and no closing Lot Matches in D3 scope', () => {
    const result = derive(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.realizedToDate).toBe('0.00')
    expect(result.value.closingLotMatches).toEqual([])
  })

  it('should derive expected Lifecycle State Open when effective opening exposure exists and agree with a stored Open binding', () => {
    const result = derive({ ...input, storedLifecycle: 'Open' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.expectedLifecycle).toBe('Open')
    expect(result.value.agreement).toEqual({ lifecycle: true, lots: true, findings: [] })
  })

  it('should report a structured lifecycle disagreement without repairing it on read', () => {
    const result = derive(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.expectedLifecycle).toBe('Open')
    expect(result.value.agreement.lifecycle).toBe(false)
    expect(result.value.agreement.findings).toContain('StoredLifecycleDisagreement')
  })

  it('should keep exact decimal values so presentation rounding never changes basis or allocated fees', () => {
    const result = derive({
      ...input,
      executions: [{ ...input.executions[0], id: 'exec-3', quantity: '3', price: '100.10', fee: '1.11', recordedSequence: 1 }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.lots[0].basis).toBe('301.41')
    expect(result.value.lots[0].allocatedOpeningFee).toBe('1.11')
  })
})
