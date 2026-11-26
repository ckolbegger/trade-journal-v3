import { describe, expect, it } from 'vitest'
import { normalizeStoredTrade } from '../../src/ui/trade-read'

// Foundation of D8aR R1: one canonical stored-to-displayed Trade projection.
describe('canonical Trade read', () => {
  it('should normalise a Planned, Open and Closed stored Trade to one projection with explicit defaults', () => {
    const base = {
      plan: { entry: '3.00', stop: '1.00', target: '7.00', oneR: '2.00', underlying: 'AAPL' },
      economicTime: '2026-11-24T20:00:00Z',
    }
    const planned = normalizeStoredTrade({ ...base, id: 't-planned', lifecycle: 'Planned' })
    const open = normalizeStoredTrade({ ...base, id: 't-open', lifecycle: 'Open' })
    const closed = normalizeStoredTrade({ ...base, id: 't-closed', lifecycle: 'Closed' })

    for (const row of [planned, open, closed]) {
      expect(row.revision).toBe('1')
      expect(row.oneR).toBe('2.00')
      expect(row.underlying).toBe('AAPL')
      expect(row.positions).toEqual([])
      expect(row.lots).toEqual([])
      expect(row.executions).toEqual([])
      expect(row.realizedToDate).toBe('0.00')
      expect(row.agreement).toEqual({ lifecycle: true, lots: true, findings: [] })
    }
    expect(planned.lifecycle).toBe('Planned')
    expect(open.lifecycle).toBe('Open')
    expect(closed.lifecycle).toBe('Closed')
  })

  it('should read the frozen Plan fields from plan rather than inventing top-level values', () => {
    const row = normalizeStoredTrade({
      id: 't-option',
      lifecycle: 'Planned',
      plan: {
        underlying: 'TSLA', oneR: '7.50', strategyId: 'seed-long-call',
        contract: { underlying: 'TSLA', kind: 'Call', strike: '250', expiration: '2026-12-18', multiplier: 100 },
      },
      oneR: '',
      underlying: '',
    })
    expect(row.oneR).toBe('7.50')
    expect(row.underlying).toBe('TSLA')
    expect(row.strategyId).toBe('seed-long-call')
    expect(row.plan.contract).toMatchObject({ strike: '250', expiration: '2026-12-18', multiplier: 100 })
  })

  it('should keep an explicit top-level value over the Plan default when one exists', () => {
    const row = normalizeStoredTrade({
      id: 't-open',
      lifecycle: 'Open',
      oneR: '9.00',
      underlying: 'MSFT',
      plan: { oneR: '2.00', underlying: 'AAPL' },
    })
    expect(row.oneR).toBe('9.00')
    expect(row.underlying).toBe('MSFT')
  })

  it('should serve planned, detail and complete-detail callers through one interface', () => {
    const plannedInput = { id: 't1', lifecycle: 'Planned', plan: { oneR: '1.00', underlying: 'AAPL' } }
    const detailInput = { id: 't2', lifecycle: 'Open', plan: { entry: '1', stop: '1', target: '2' }, oneR: '1.00', underlying: 'AAPL' }
    const completeInput = { id: 't3', lifecycle: 'Closed', plan: { entry: '1', stop: '1', target: '2' }, oneR: '1.00', underlying: 'AAPL', executions: [{ id: 'e1' }] }

    const projected = [plannedInput, detailInput, completeInput].map(normalizeStoredTrade)
    expect(projected).toHaveLength(3)
    expect(projected.every(r => r.agreement.findings.length === 0)).toBe(true)
    expect(projected[2].executions).toHaveLength(1)
    expect(projected[0].executions).toEqual([])
  })
})
