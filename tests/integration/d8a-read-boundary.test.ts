import { describe, expect, it } from 'vitest'
import { openDb, repo, STORES, type Db } from '../../src/persistence/db'
import { loadCompleteTradeDetail } from '../../src/ui/detail-controller'

const tradeId = 'trade-d8a-aapl'
const trade = {
  id: tradeId, lifecycle: 'Open', revision: '2', strategyId: 'seed-long-call',
  underlying: 'AAPL', oneR: '400.00',
  plan: { entry: '3.00', stop: '1.00', target: '7.00', underlying: 'AAPL', quantity: 2 },
  positions: [{ instrument: 'AAPL 190Call 2026-12-18 x100', netQuantity: '2', lotCount: 1 }],
  lots: [{
    id: 'lot-1', instrument: 'AAPL 190Call 2026-12-18 x100', quantity: '2',
    basis: '601.00', allocatedOpeningFee: '1.00',
  }],
  executions: [{
    id: 'exec-1', instrument: 'AAPL 190Call 2026-12-18 x100', action: 'Buy',
    quantity: '2', price: '3.00', fee: '1.00', economicTime: '2026-11-20T20:00:00Z',
  }],
  realizedToDate: '0.00', fulfillment: 'FilledAsPlanned', deviations: [],
  agreement: { lifecycle: true, lots: true, findings: [] },
}

async function seed(db: Db) {
  await repo.put(db, 'trade', { id: tradeId, ...trade })
  await repo.put(db, 'trade', {
    id: 'lifecycle-index',
    members: { Planned: [], Open: [tradeId], Closed: [], Abandoned: [] },
  })
  await repo.put(db, 'journal', {
    id: 'entry-plan-d8a', kind: 'Entry', obligationKey: 'PlanReflection:trade-d8a-aapl',
    snapshot: { anchor: { tradeId }, source: 'Plan Confirmation' },
  })
  await repo.put(db, 'market', {
    id: 'AAPL 190Call 2026-12-18 x100:2026-11-23', instrument: 'AAPL 190Call 2026-12-18 x100',
    date: '2026-11-23', revision: '1',
    marks: [{ revision: '1', price: '3.20', source: 'Manual', intention: 'RecordManualMark', observedAt: '2026-11-23T20:00:00Z', savedAt: '2026-11-23T20:30:00Z' }],
    acknowledgments: [],
  })
}

async function snapshot(db: Db) {
  const result: Record<string, unknown[]> = {}
  for (const store of STORES) result[store] = await repo.all(db, store)
  return result
}

describe('detail read boundary (mock-free)', () => {
  it('should open a complete detail and replay after a DB reopen without writing any store', async () => {
    const db = await openDb()
    await seed(db)
    const afterSeed = await snapshot(db)
    const reopened = await openDb()
    const loaded = await loadCompleteTradeDetail({
      tradeId, now: new Date('2026-11-24T17:00:00Z'), advisoryInstalled: false,
    }, reopened)
    expect(loaded).toMatchObject({ status: 'Ready' })
    if (loaded.status !== 'Ready') return
    expect(loaded.detail.identity.tradeId).toBe(tradeId)
    expect(loaded.detail.timeline.length).toBeGreaterThan(0)
    expect(await snapshot(reopened)).toEqual(afterSeed)
  })

  it('should open a Planned Trade with no executions, lots or positions', async () => {
    const db = await openDb()
    const plannedId = 'trade-d8a-planned'
    await repo.put(db, 'trade', {
      id: plannedId, lifecycle: 'Planned', revision: '1',
      economicTime: '2026-11-20T20:00:00Z', strategyId: 'seed-long-call',
      underlying: 'AAPL', oneR: '400.00', plan: { ...trade.plan },
      realizedToDate: '0.00', agreement: { lifecycle: true, lots: true, findings: [] },
    })
    const loaded = await loadCompleteTradeDetail({
      tradeId: plannedId, now: new Date('2026-11-24T17:00:00Z'), advisoryInstalled: false,
    }, db)
    expect(loaded.status).toBe('Ready')
    if (loaded.status !== 'Ready') return
    expect(loaded.detail.positionAndPlan.executions).toEqual([])
    expect(loaded.detail.positionAndPlan.lots).toEqual([])
    expect(loaded.detail.positionAndPlan.positions).toEqual([])
    expect(loaded.detail.figures.plannedLegFulfillment).toBe('Unfilled')
  })

  it('should resolve the frozen option contract from the Plan for marks and advisory inputs', async () => {
    const db = await openDb()
    const optionId = 'trade-d8a-option'
    const contract = {
      underlying: 'AAPL', kind: 'Call' as const, strike: '190',
      expiration: '2026-12-18', multiplier: 100,
    }
    await repo.put(db, 'trade', {
      id: optionId, lifecycle: 'Planned', revision: '1',
      economicTime: '2026-11-20T20:00:00Z', oneR: '400.00',
      plan: {
        ...trade.plan, strategyId: 'seed-long-call', contract,
        contractInstrument: 'AAPL 190Call 2026-12-18 x100',
      },
      realizedToDate: '0.00',
    })
    const instrument = 'AAPL 190Call 2026-12-18 x100'
    for (const [date, price] of [['2026-11-20', '3.00'], ['2026-11-23', '3.80']]) {
      await repo.put(db, 'market', {
        id: `${instrument}:${date}`, instrument, date, revision: '1',
        marks: [{ revision: '1', price, source: 'Manual', intention: 'RecordManualMark', observedAt: `${date}T20:00:00Z`, savedAt: `${date}T20:30:00Z` }],
        acknowledgments: [],
      })
      await repo.put(db, 'market', {
        id: `AAPL:${date}`, instrument: 'AAPL', date, revision: '1',
        marks: [{ revision: '1', price: date === '2026-11-20' ? '100.00' : '102.00', source: 'Manual', intention: 'RecordManualMark', observedAt: `${date}T20:00:00Z`, savedAt: `${date}T20:30:00Z` }],
        acknowledgments: [],
      })
    }
    const loaded = await loadCompleteTradeDetail({
      tradeId: optionId, now: new Date('2026-11-24T17:00:00Z'), advisoryInstalled: true,
    }, db)
    expect(loaded.status).toBe('Ready')
    if (loaded.status !== 'Ready') return
    expect(loaded.detail.earlierMarks.map(m => m.price)).toEqual([undefined, undefined, '3.00', '3.80'])
    expect(loaded.advisory?.iv?.kind).toBe('Value')
    expect(loaded.advisory?.decomposition?.kind).toBe('Value')
  })

  it('should produce byte-equivalent canonical calculations with advisory explanation on and off', async () => {
    const db = await openDb()
    const off = await loadCompleteTradeDetail({
      tradeId, now: new Date('2026-11-24T17:00:00Z'), advisoryInstalled: false,
    }, db)
    const on = await loadCompleteTradeDetail({
      tradeId, now: new Date('2026-11-24T17:00:00Z'), advisoryInstalled: true,
    }, db)
    expect(off.status).toBe('Ready')
    expect(on.status).toBe('Ready')
    if (off.status !== 'Ready' || on.status !== 'Ready') return
    const strip = (detail: typeof off.detail) => ({
      identity: detail.identity, figures: detail.figures,
      payoff: detail.payoff, journal: detail.journal, timeline: detail.timeline,
    })
    expect(strip(on.detail)).toEqual(strip(off.detail))
    expect(on.advisory).toBeDefined()
    expect(off.advisory).toBeNull()
    expect(JSON.stringify(strip(on.detail))).not.toContain('volatility')
  })
})
