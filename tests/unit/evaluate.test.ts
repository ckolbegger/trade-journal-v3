import { describe, expect, it } from 'vitest'
import { evaluate, type TradeEvaluationInput } from '../../src/domain/evaluate'

const input: TradeEvaluationInput = {
  tradeId: 'trade-aapl',
  plan: { underlying: 'AAPL', quantity: 10, entry: '100.00', stop: '95.00', target: '110.00', oneR: '50.00', baseline: '2.00' },
  positions: [{ instrument: 'AAPL', netQuantity: '10' }],
  lots: [{ instrument: 'AAPL', quantity: '10', basis: '1005.00' }],
  realizedToDate: '0.00',
  frame: { instrument: 'AAPL', date: '2026-11-23', status: 'Available', price: '105.00', revision: '1' },
}

describe('evaluate — Long Stock', () => {
  it('should keep realized-to-date a Value when the expected Mark is Missing and return Unavailable only for mark-dependent figures', () => {
    const result = evaluate({ ...input, frame: { ...input.frame, status: 'Missing', price: undefined } })
    expect(result.realizedToDate).toEqual({ kind: 'Value', value: '0.00' })
    expect(result.oneR).toEqual({ kind: 'Value', value: '50.00' })
    expect(result.markedPnl).toMatchObject({ kind: 'Unavailable' })
    expect(result.ongoingRiskToStop).toMatchObject({ kind: 'Unavailable' })
  })

  it('should compute marked P&L, ongoing risk to Stop, incremental reward, Plan-R conversions and Overrun from one exact frame with decimal arithmetic', () => {
    const result = evaluate(input)
    expect(result.markedPnl).toEqual({ kind: 'Value', value: '45.00' })
    expect(result.ongoingRiskToStop).toEqual({ kind: 'Value', value: '100.00' })
    expect(result.incrementalReward).toEqual({ kind: 'Value', value: '50.00' })
    expect(result.planR.risk).toEqual({ kind: 'Value', value: '2.00' })
    expect(result.planR.reward).toEqual({ kind: 'Value', value: '1.00' })
    expect(result.overrun).toEqual({ kind: 'Value', value: '0.00' })
    expect(result.maxIncrementalReward).toEqual({ kind: 'Unbounded', direction: 'Above', explanation: 'Long stock upside is unbounded.' })
  })

  it('should keep Stop and Target conditions independent under OR semantics and never classify a Target or revision as a Deviation', () => {
    const result = evaluate(input)
    expect(result.conditions).toEqual([
      { id: 'stop-underlying', kind: 'Stop', status: 'Unbreached', detail: 'Stop 95.00 is below the Mark 105.00.' },
      { id: 'target-underlying', kind: 'Target', status: 'Unreached', detail: 'Target 110.00 is above the Mark 105.00.' },
    ])
    expect(result).not.toHaveProperty('deviations')
  })

  it('should keep 1R and the frozen Plan Baseline unchanged while current risk uses the remaining Position', () => {
    const result = evaluate(input)
    expect(result.oneR).toEqual({ kind: 'Value', value: '50.00' })
    expect(result.planBaseline).toEqual({ kind: 'Value', value: '2.00' })
    expect(result.ongoingRiskToStop).toEqual({ kind: 'Value', value: '100.00' })
    const scaled = evaluate({
      ...input,
      positions: [{ instrument: 'AAPL', netQuantity: '6' }],
      lots: [{ instrument: 'AAPL', quantity: '6', basis: '603.00' }],
    })
    expect(scaled.oneR).toEqual({ kind: 'Value', value: '50.00' })
    expect(scaled.ongoingRiskToStop).toEqual({ kind: 'Value', value: '60.00' })
  })

  it('should return stable Unavailable reasons naming Instrument and date with no fill-cost, zero or Stale substitution', () => {
    const result = evaluate({ ...input, frame: { ...input.frame, status: 'AcknowledgedUnavailable', price: undefined } })
    expect(result.markedPnl).toEqual({
      kind: 'Unavailable', reason: 'ExpectedMarkAcknowledgedUnavailable',
      details: { instrument: 'AAPL', date: '2026-11-23' },
    })
    expect(JSON.stringify(result)).not.toContain('1005.00" as')
  })

  it('should disclose a Stop Overrun without changing lifecycle or producing a Deviation', () => {
    const result = evaluate({
      ...input,
      frame: { ...input.frame, price: '90.00' },
    })
    expect(result.ongoingRiskToStop).toEqual({ kind: 'Value', value: '0.00' })
    expect(result.overrun).toEqual({ kind: 'Value', value: '50.00' })
    expect(result.conditions[0].status).toBe('Crossed')
    expect(result).not.toHaveProperty('lifecycle')
  })
})
