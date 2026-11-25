import { describe, expect, it } from 'vitest'
import { buildCompleteTradeDetail, type CompleteDetailInput } from '../../src/domain/complete-detail'
import type { SessionSeries } from '../../src/domain/session-series'

const series: SessionSeries = {
  expectedDate: '2026-11-24',
  sessions: [
    { date: '2026-11-20', status: 'Available', price: '100', gap: false, keyMoments: [] },
    { date: '2026-11-23', status: 'Missing', gap: true, keyMoments: [] },
    { date: '2026-11-24', status: 'Available', price: '102', gap: false, keyMoments: ['Stop breached'] },
  ],
  gaps: ['2026-11-23'],
  episodes: [{
    fingerprint: 'trade-aapl:stop-underlying:2026-11-24', conditionId: 'stop-underlying',
    start: '2026-11-24', active: true, dates: ['2026-11-24'],
  }],
  snapshotId: 'frames-aapl', digest: 'digest', sessionPolicy: 'v1',
}

const input = (overrides: Partial<CompleteDetailInput> = {}): CompleteDetailInput => ({
  trade: {
    id: 'trade-aapl', lifecycle: 'Open', revision: '2', strategyId: 'seed-long-stock',
    underlying: 'AAPL', oneR: '50.00',
    plan: { entry: '100', stop: '95', target: '110' },
    positions: [{ instrument: 'AAPL', netQuantity: '10', lotCount: 2 }],
    lots: [{ id: 'lot-1', instrument: 'AAPL', quantity: '10', basis: '1005.00', allocatedOpeningFee: '5.00' }],
    executions: [{ id: 'exec-1', instrument: 'AAPL', action: 'Buy', quantity: '10', price: '100', fee: '5', economicTime: '2026-11-20T20:00:00Z' }],
    realizedToDate: '0.00',
    fulfillment: 'FilledAsPlanned',
    deviations: [],
  },
  series,
  journalRows: [
    {
      id: 'Debt-pc-1', kind: 'Debt', obligationKey: 'PositionChange:pc-1', status: 'Unpaid',
      snapshot: { anchor: { tradeId: 'trade-aapl' } },
    },
    {
      id: 'entry-plan-1', kind: 'Entry', obligationKey: 'PlanReflection:trade-aapl',
      snapshot: { anchor: { tradeId: 'trade-aapl' }, source: 'Plan Confirmation' },
    },
  ],
  coverage: { instrument: 'AAPL', date: '2026-11-24', status: 'Available' },
  ...overrides,
})

describe('complete Trade Detail', () => {
  it('should assemble identity, Plan, position, Lots, conditions, payoff, Earlier Marks, narrative, Needs you, timeline and integrity from persisted rows', () => {
    const detail = buildCompleteTradeDetail(input())
    expect(detail.identity).toMatchObject({ tradeId: 'trade-aapl', lifecycle: 'Open', strategy: 'Long Stock', underlying: 'AAPL' })
    expect(detail.todayAgainst).toEqual({ entry: '100', previous: '100', current: '102' })
    expect(detail.stopsAndTargets).toEqual({ stop: '95', target: '110' })
    expect(detail.positionAndPlan.lots).toHaveLength(1)
    expect(detail.positionAndPlan.positions[0].netQuantity).toBe('10')
    expect(detail.payoff?.kind).toBe('NotApplicable')
    expect(detail.earlierMarks.map(m => m.date)).toEqual(['2026-11-20', '2026-11-23', '2026-11-24'])
    expect(detail.journal).toHaveLength(1)
    expect(detail.needsYou).toContain('PositionChange:pc-1')
    expect(detail.timeline.map(s => s.date)).toEqual(['2026-11-20', '2026-11-23', '2026-11-24'])
    expect(detail.integrity).toEqual({ agreement: true, findings: [] })
  })

  it('should populate descriptive figure slots without a composite adherence score or grade', () => {
    const detail = buildCompleteTradeDetail(input())
    expect(detail.figures).toEqual({
      plannedLegFulfillment: 'Filled As Planned',
      entryQuality: 'As Planned',
      realizedR: '0.00',
      deviations: { plannedLegTerms: 0, entrySize: 0, unplannedExposure: 0, stopDiscipline: 1 },
      planConformance: 'With Deviations',
      coverage: 'Available',
    })
    expect(Object.keys(detail)).not.toContain('adherence')
    expect(JSON.stringify(detail)).not.toContain('grade')
    expect(JSON.stringify(detail)).not.toContain('composite')
  })

  it('should show each Journal outcome once and disclose coverage and gaps without inventing facts', () => {
    const rows = [
      ...input().journalRows,
      { ...input().journalRows[0], id: 'entry-CloseReview:trade-aapl', kind: 'Entry' as const, obligationKey: 'CloseReview:trade-aapl' },
    ]
    const detail = buildCompleteTradeDetail(input({ journalRows: rows }))
    expect(detail.journal).toHaveLength(2)
    expect(new Set(detail.journal.map(j => j.id)).size).toBe(2)
    expect(detail.gaps).toEqual(['2026-11-23'])
    expect(detail.coverage).toEqual({ instrument: 'AAPL', date: '2026-11-24', status: 'Available' })
    expect(detail.earlierMarks.find(m => m.date === '2026-11-23')?.price).toBeUndefined()
  })
})
