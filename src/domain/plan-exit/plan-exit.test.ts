import { describe, expect, it } from 'vitest'
import { measurePlanExit, type PlanExitCondition, type PlanExitInput } from './index.ts'

const stop = (over: Partial<PlanExitCondition> = {}): PlanExitCondition => ({ id: 'stop-1', role: 'Stop', boundary: '95', status: 'Breached', pricedInTradedInstrument: true, ...over })
const target = (over: Partial<PlanExitCondition> = {}): PlanExitCondition => ({ id: 'target-1', role: 'Target', boundary: '120', status: 'Active', pricedInTradedInstrument: true, ...over })
const sale = (over: Partial<PlanExitInput> = {}): PlanExitInput => ({
  held: '200',
  change: { side: 'Sell', quantity: '200', price: '94' },
  conditions: [stop(), target()],
  heldPast: [],
  ...over,
})

describe('The measure of a sale against the Plan Exit (A309)', () => {
  it('should give Follows for a sale of the whole Position with the Stop reached at the latest Marks and no Hold saved past it', () => {
    expect(measurePlanExit(sale())).toEqual({ kind: 'Follows' })
  })
  it('should give Follows the same at the Target', () => {
    expect(measurePlanExit(sale({ conditions: [stop({ status: 'Active' }), target({ status: 'Reached' })] }))).toEqual({ kind: 'Follows' })
  })
  it('should give Leaves with BeforeCondition when neither is reached', () => {
    const measure = measurePlanExit(sale({ conditions: [stop({ status: 'Active' }), target()], change: { side: 'Sell', quantity: '200', price: '110' } }))
    expect(measure).toEqual({ kind: 'Leaves', reasons: [{ kind: 'BeforeCondition' }] })
  })
  it('should give Follows when a condition priced in the traded Instrument is reached at the sale own price', () => {
    const active = [stop({ status: 'Active' }), target()]
    expect(measurePlanExit(sale({ conditions: active, change: { side: 'Sell', quantity: '200', price: '95' } }))).toEqual({ kind: 'Follows' })
    expect(measurePlanExit(sale({ conditions: active, change: { side: 'Sell', quantity: '200', price: '120' } }))).toEqual({ kind: 'Follows' })
    expect(measurePlanExit(sale({ conditions: active, change: { side: 'Sell', quantity: '200', price: '95.01' } }))?.kind).toBe('Leaves')
    // A short Position's Stop lies above: a buy-back at or above it reaches it.
    const short = [stop({ status: 'Active', boundary: '105' }), target({ status: 'Active', boundary: '80' })]
    expect(measurePlanExit(sale({ held: '-100', conditions: short, change: { side: 'Buy', quantity: '100', price: '105' } }))).toEqual({ kind: 'Follows' })
    expect(measurePlanExit(sale({ held: '-100', conditions: short, change: { side: 'Buy', quantity: '100', price: '104.99' } }))?.kind).toBe('Leaves')
    // A condition priced in another Instrument is not reached by the sale's own price.
    const underlying = [stop({ status: 'Active', pricedInTradedInstrument: false }), target({ status: 'Active', pricedInTradedInstrument: false })]
    expect(measurePlanExit(sale({ conditions: underlying, change: { side: 'Sell', quantity: '200', price: '90' } }))?.kind).toBe('Leaves')
  })
  it('should give Leaves with HeldPast, naming the line, the date it was reached and the sessions held, when a Hold was saved on an earlier Review Date while the condition was reached', () => {
    const heldPast = [{ conditionId: 'stop-1', line: 'Stop' as const, since: '2026-11-09', sessions: 5 }]
    expect(measurePlanExit(sale({ heldPast }))).toEqual({ kind: 'Leaves', reasons: [{ kind: 'HeldPast', line: 'Stop', since: '2026-11-09', sessions: 5 }] })
    // A Hold past a line the Trade is no longer at does not make a sale before the other line a held-past one.
    const other = [{ conditionId: 'target-1', line: 'Target' as const, since: '2026-11-02', sessions: 2 }]
    expect(measurePlanExit(sale({ heldPast: other }))).toEqual({ kind: 'Follows' })
  })
  it('should give Leaves with PartOnly for a sale of less than is held', () => {
    expect(measurePlanExit(sale({ change: { side: 'Sell', quantity: '50', price: '94' } }))).toEqual({ kind: 'Leaves', reasons: [{ kind: 'PartOnly', held: '200', sold: '50' }] })
    expect(measurePlanExit(sale({ held: '-3', change: { side: 'Buy', quantity: '1', price: '105' } }))).toEqual({ kind: 'Leaves', reasons: [{ kind: 'PartOnly', held: '3', sold: '1' }] })
  })
  it('should give no measure for a buy', () => {
    expect(measurePlanExit(sale({ change: { side: 'Buy', quantity: '50', price: '94' } }))).toBeUndefined()
    expect(measurePlanExit(sale({ held: '-100', change: { side: 'Sell', quantity: '100', price: '94' } }))).toBeUndefined()
  })
  it('should give every reason that applies, together', () => {
    const heldPast = [{ conditionId: 'stop-1', line: 'Stop' as const, since: '2026-11-09', sessions: 5 }]
    expect(measurePlanExit(sale({ heldPast, change: { side: 'Sell', quantity: '50', price: '94' } }))).toEqual({
      kind: 'Leaves',
      reasons: [{ kind: 'HeldPast', line: 'Stop', since: '2026-11-09', sessions: 5 }, { kind: 'PartOnly', held: '200', sold: '50' }],
    })
    expect(measurePlanExit(sale({ conditions: [stop({ status: 'Active' }), target()], change: { side: 'Sell', quantity: '50', price: '110' } }))).toEqual({
      kind: 'Leaves',
      reasons: [{ kind: 'BeforeCondition' }, { kind: 'PartOnly', held: '200', sold: '50' }],
    })
  })
})
