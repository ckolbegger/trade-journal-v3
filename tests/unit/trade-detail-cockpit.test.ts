import { describe, expect, it } from 'vitest'
import {
  ALL_DRAWERS, comparisonRows, hasObservedMark, payoffPolyline,
  trackBounds, trackPercent, visibleDrawers,
} from '../../src/ui/detail-visual'
import { expirationPayoff } from '../../src/domain/expiration-payoff'

describe('Trade Detail cockpit visuals', () => {
  it('should derive track bounds from Stop, Target, entry and observed prices only', () => {
    expect(trackBounds(['95', '110', '100', '102'])).toEqual({ min: 95, max: 110 })
    expect(trackBounds(['3.00', '7.00', '1.00'])).toEqual({ min: 1, max: 7 })
    expect(trackBounds([])).toEqual({ min: 0, max: 1 })
  })

  it('should clamp track markers to the visible range', () => {
    const bounds = { min: 95, max: 110 }
    expect(trackPercent(95, bounds)).toBe(0)
    expect(trackPercent(102.5, bounds)).toBe(50)
    expect(trackPercent(110, bounds)).toBe(100)
    expect(trackPercent(200, bounds)).toBe(100)
  })

  it('should build a comparison table with explicit dashes where no Change exists', () => {
    const rows = comparisonRows({ entry: '100', previous: '101', current: '103' }, '190')
    expect(rows).toEqual([
      { label: 'Entry', previous: '—', today: '100', change: '—' },
      { label: 'Mark', previous: '101', today: '103', change: '2.00' },
      { label: 'Payoff break-even', previous: '—', today: '190', change: '—' },
    ])
  })

  it('should distinguish an observed Mark from the plan-entry fallback', () => {
    expect(hasObservedMark([
      { status: 'Missing' }, { status: 'Missing' },
    ])).toBe(false)
    expect(hasObservedMark([
      { status: 'Missing' }, { status: 'Available', price: '3.25' },
    ])).toBe(true)
  })

  it('should suppress derived drawers when the facts cannot be replayed', () => {
    expect(visibleDrawers(true)).toEqual(ALL_DRAWERS)
    expect(visibleDrawers(false)).toEqual(['Position', 'Plan and Risk', 'Journal'])
  })

  it('should turn intrinsic payoff segments into a drawable polyline without model prices', () => {
    const payoff = expirationPayoff({
      view: 'Planned',
      legs: [{
        contract: { underlying: 'AAPL', kind: 'Call', strike: '190', expiration: '2026-12-18', multiplier: 100 },
        openingAction: 'Buy', entry: '3.00', quantity: 2,
      }],
    })
    expect(payoff.kind).toBe('Value')
    if (payoff.kind !== 'Value') return
    const points = payoffPolyline(payoff, 300)
    expect(points).toContain('0,')
    expect(points).toContain('190,')
    expect(points).toContain('300,')
    expect(points).not.toContain('NaN')
  })
})
