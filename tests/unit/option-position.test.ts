import { describe, expect, it } from 'vitest'
import {
  deriveOptionPosition, type OptionExecution, type OptionPositionInput,
} from '../../src/domain/option-position'
import type { OptionContract } from '../../src/domain/option-contract'

const contract: OptionContract = {
  underlying: 'AAPL', kind: 'Call', strike: '190', expiration: '2026-12-18', multiplier: 100,
}
const execution = (
  id: string, action: 'Buy' | 'Sell', quantity: string, price: string, opening = true,
): OptionExecution => ({
  id, contract, action, opening, quantity, price, fee: '1.00',
  economicTime: '2026-11-24T20:00:00Z', recordedSequence: 1, plannedLegId: 'leg-1',
})
const input = (executions: OptionExecution[], overrides: Partial<OptionPositionInput> = {}): OptionPositionInput => ({
  tradeId: 'trade-opt',
  plannedLeg: { contract, quantity: 2, openingAction: 'Buy' },
  executions,
  ...overrides,
})

describe('option position and Planned Leg fulfillment', () => {
  it('should derive open Lots, fees and realized P&L for long and short single-leg exposure', () => {
    const long = deriveOptionPosition(input([execution('e1', 'Buy', '2', '3.00')]))
    expect(long.ok).toBe(true)
    if (!long.ok) return
    expect(long.value.positions).toEqual([{ instrument: 'AAPL 190Call 2026-12-18 x100', netQuantity: '2', lotCount: 1 }])
    expect(long.value.lots[0]).toMatchObject({ quantity: '2', basis: '601.00', allocatedOpeningFee: '1.00' })
    expect(long.value.realizedToDate).toBe('0.00')

    const short = deriveOptionPosition(input([execution('e2', 'Sell', '2', '3.00')], {
      plannedLeg: { contract, quantity: 2, openingAction: 'Sell' },
    }))
    expect(short.ok).toBe(true)
    if (!short.ok) return
    expect(short.value.positions[0].netQuantity).toBe('-2')

    const closed = deriveOptionPosition(input([
      execution('e1', 'Buy', '2', '3.00'),
      execution('e2', 'Sell', '2', '5.00', false),
    ]))
    expect(closed.ok).toBe(true)
    if (!closed.ok) return
    expect(closed.value.realizedToDate).toBe('398.00')
    expect(closed.value.expectedLifecycle).toBe('Closed')
  })

  it('should classify Filled As Planned, Partially Filled and Not Entered from exact-contract fills', () => {
    expect(deriveOptionPosition(input([execution('e1', 'Buy', '2', '3.00')])).value?.fulfillment).toBe('FilledAsPlanned')
    expect(deriveOptionPosition(input([execution('e1', 'Buy', '1', '3.00')])).value?.fulfillment).toBe('PartiallyFilled')
    expect(deriveOptionPosition(input([], { closed: true })).value?.fulfillment).toBe('NotEntered')
    expect(deriveOptionPosition(input([])).value?.fulfillment).toBe('Unfilled')
  })

  it('should record one Planned-Leg Terms occurrence for all mismatched fields of one served leg', () => {
    const wrong = { ...execution('e1', 'Buy', '2', '3.00'), contract: { ...contract, strike: '195' } }
    const result = deriveOptionPosition(input([wrong]))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.fulfillment).toBe('FilledWithDeviation')
    expect(result.value.deviations).toHaveLength(1)
    expect(result.value.deviations[0]).toMatchObject({
      category: 'PlannedLegTerms', fields: ['strike'],
    })
    expect(result.value.deviations[0].fingerprint).toBe('trade-opt:planned-leg-terms:leg-1')
  })

  it('should infer no Unplanned Exposure from a mismatch alone and no conformance from missing evidence', () => {
    const wrong = { ...execution('e1', 'Buy', '2', '3.00'), contract: { ...contract, strike: '195' } }
    const mismatch = deriveOptionPosition(input([wrong]))
    expect(mismatch.ok).toBe(true)
    if (!mismatch.ok) return
    expect(mismatch.value.deviations.some(d => d.category === 'UnplannedExposure')).toBe(false)

    const unplanned = deriveOptionPosition(input([{ ...wrong, explicitlyUnplanned: true }]))
    expect(unplanned.ok).toBe(true)
    if (!unplanned.ok) return
    expect(unplanned.value.deviations.some(d => d.category === 'UnplannedExposure')).toBe(true)

    const unknown = deriveOptionPosition(input([execution('e1', 'Buy', '2', '3.00')], {
      evidenceMissing: true,
    }))
    expect(unknown.ok).toBe(true)
    if (!unknown.ok) return
    expect(unknown.value.fulfillment).toBe('NotVerifiable')
    expect(unknown.value.deviations).toEqual([])
  })

  it('should keep the four Deviation categories closed and fingerprint occurrences stably', () => {
    const result = deriveOptionPosition(input([execution('e1', 'Buy', '2', '3.00')]))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.values(result.value.deviationCategories).sort()).toEqual([
      'EntrySize', 'PlannedLegTerms', 'StopDiscipline', 'UnplannedExposure',
    ])
  })
})
