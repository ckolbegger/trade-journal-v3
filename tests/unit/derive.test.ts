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

const disposal = (id: string, quantity: string, price: string, fee: string, economicTime: string) => ({
  id, instrument: 'AAPL', action: 'Sell' as const, quantity, price, fee, economicTime, recordedSequence: 1,
})

const partialCloseInput: TradeDerivationInput = {
  ...input,
  storedLifecycle: 'Open',
  executions: [
    ...input.executions,
    disposal('exec-3', '5', '110.00', '5.00', '2026-11-25T20:00:00Z'),
  ],
}

const finalCloseInput: TradeDerivationInput = {
  ...partialCloseInput,
  executions: [
    ...partialCloseInput.executions,
    disposal('exec-4', '5', '120.00', '4.00', '2026-11-26T20:00:00Z'),
  ],
}

describe('derive — FIFO Lot Matches', () => {
  it('should match each disposing Execution FIFO to exact open Lots ordered by Economic Time then Recorded Sequence', () => {
    const result = derive(finalCloseInput)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.closingLotMatches.map(m => [m.executionId, m.lotId, m.quantity])).toEqual([
      ['exec-3', 'lot-exec-1', '5'],
      ['exec-4', 'lot-exec-1', '1'],
      ['exec-4', 'lot-exec-2', '4'],
    ])
    expect(result.value.closingLotMatches.every(m => m.matchingMethod === 'FIFO')).toBe(true)
  })

  it('should allocate opening and disposal fees proportionally across matches exactly once and keep the unconsumed opening fee on a remaining Lot', () => {
    const partial = derive(partialCloseInput)
    expect(partial.ok).toBe(true)
    if (!partial.ok) return
    expect(partial.value.lots.map(l => [l.id, l.quantity, l.basis, l.allocatedOpeningFee])).toEqual([
      ['lot-exec-1', '1', '100.50', '0.50'],
      ['lot-exec-2', '4', '412.00', '2.00'],
    ])
    expect(partial.value.closingLotMatches[0].allocatedOpeningFee).toBe('2.50')
    expect(partial.value.closingLotMatches[0].allocatedDisposalFee).toBe('5.00')

    const final = derive(finalCloseInput)
    expect(final.ok).toBe(true)
    if (!final.ok) return
    expect(final.value.closingLotMatches.map(m => [m.allocatedOpeningFee, m.allocatedDisposalFee])).toEqual([
      ['2.50', '5.00'], ['0.50', '0.80'], ['2.00', '3.20'],
    ])
    expect(final.value.lots).toEqual([])
  })

  it('should keep the Trade Open after a partial close and derive Closed only when net exposure is flat', () => {
    const partial = derive(partialCloseInput)
    expect(partial.ok).toBe(true)
    if (!partial.ok) return
    expect(partial.value.positions).toEqual([{ instrument: 'AAPL', netQuantity: '5', lotCount: 2 }])
    expect(partial.value.expectedLifecycle).toBe('Open')

    const final = derive(finalCloseInput)
    expect(final.ok).toBe(true)
    if (!final.ok) return
    expect(final.value.positions).toEqual([{ instrument: 'AAPL', netQuantity: '0', lotCount: 0 }])
    expect(final.value.expectedLifecycle).toBe('Closed')
  })

  it('should derive realized P&L from matched facts and never duplicate price or P&L onto a Lot Match', () => {
    const partial = derive(partialCloseInput)
    expect(partial.ok).toBe(true)
    if (!partial.ok) return
    expect(partial.value.realizedToDate).toBe('42.50')
    const final = derive(finalCloseInput)
    expect(final.ok).toBe(true)
    if (!final.ok) return
    expect(final.value.realizedToDate).toBe('126.00')
    for (const match of final.value.closingLotMatches) {
      expect(Object.keys(match)).not.toContain('price')
      expect(Object.keys(match)).not.toContain('realizedPnl')
      expect(Object.keys(match)).not.toContain('basis')
    }
  })

  it('should report a structured disagreement with recorded matches without repairing it on read', () => {
    const result = derive({
      ...partialCloseInput,
      storedLots: [
        { executionId: 'exec-1', quantity: '1' },
        { executionId: 'exec-2', quantity: '4' },
      ],
      storedMatches: [{ executionId: 'exec-3', lotId: 'lot-exec-2', quantity: '5' }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.agreement.findings).toContain('StoredLotMatchDisagreement')
    // The recorded match is reported, never silently used or replaced.
    expect(result.value.closingLotMatches[0].lotId).toBe('lot-exec-1')
  })
})
