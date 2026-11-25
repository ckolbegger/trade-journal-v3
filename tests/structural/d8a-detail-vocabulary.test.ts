import { describe, expect, it } from 'vitest'
import { buildCompleteTradeDetail, type CompleteDetailInput } from '../../src/domain/complete-detail'
import type { SessionSeries } from '../../src/domain/session-series'

const series: SessionSeries = {
  expectedDate: '2026-11-24', sessions: [], gaps: [], episodes: [],
  snapshotId: 's', digest: 'd', sessionPolicy: 'v1',
}
const input: CompleteDetailInput = {
  trade: {
    id: 't', lifecycle: 'Closed', revision: '3', strategyId: 'seed-long-call',
    underlying: 'AAPL', oneR: '400.00',
    plan: { entry: '3.00', stop: '1.00', target: '7.00' },
    positions: [], lots: [], executions: [], realizedToDate: '0.00',
  },
  series, journalRows: [], coverage: { instrument: 'AAPL', date: '2026-11-24', status: 'Available' },
}

describe('D8a complete detail vocabulary (S3 structural)', () => {
  it('should expose every required section', () => {
    const detail = buildCompleteTradeDetail(input)
    for (const section of [
      'identity', 'todayAgainst', 'stopsAndTargets', 'positionAndPlan', 'payoff',
      'earlierMarks', 'journal', 'needsYou', 'timeline', 'integrity', 'figures',
    ]) {
      expect(Object.keys(detail)).toContain(section)
    }
  })

  it('should expose only closed descriptive figure slots and no composite score', () => {
    const detail = buildCompleteTradeDetail(input)
    expect(Object.keys(detail.figures).sort()).toEqual([
      'coverage', 'entryQuality', 'planConformance', 'plannedLegFulfillment',
      'realizedR', 'deviations',
    ].sort())
    expect(Object.keys(detail.figures.deviations).sort()).toEqual([
      'entrySize', 'plannedLegTerms', 'stopDiscipline', 'unplannedExposure',
    ].sort())
    const text = JSON.stringify(detail)
    for (const forbidden of ['adherence', 'grade', 'composite', 'weighted', 'good', 'bad']) {
      expect(text.toLowerCase()).not.toContain(forbidden)
    }
  })
})
