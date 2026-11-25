import { describe, expect, it } from 'vitest'
import { openDb, repo } from '../../src/persistence/db'
import {
  confirmOptionPlan, recordOptionPositionChange, recordOptionClose,
} from '../../src/ui/option-controller'
import { readLifecycleIndex } from '../../src/domain/open-views'
import type { ReadinessEvidence } from '../../src/domain/types'
import type { OptionContract } from '../../src/domain/option-contract'

const writable: ReadinessEvidence = {
  outcome: 'Writable', passed: true, failedChecks: [], protection: { kind: 'BestEffort', reason: 'test' },
}
const blocked: ReadinessEvidence = {
  outcome: 'RecoveryOnly', passed: false, failedChecks: ['service-worker'],
  protection: { kind: 'BestEffort', reason: 'test' },
}
const contract: OptionContract = {
  underlying: 'AAPL', kind: 'Call', strike: '190', expiration: '2026-12-18', multiplier: 100,
}
const account = {
  id: 'acct-option', institutionId: 'inst-1', label: 'Main', active: true, revision: '1', history: [],
}

async function fixture() {
  const db = await openDb()
  await repo.put(db, 'catalog', {
    id: 'catalog-1',
    closeReasons: [{ id: 'seed-target-reached', label: 'Target Reached', origin: 'product' }],
  })
  return db
}

const planRequest = (overrides: Record<string, unknown> = {}) => ({
  account, definitionRevision: 'D1', strategyId: 'seed-long-call', contract,
  quantity: 2, entry: '3.00', stop: '1.00', target: '7.00',
  reflection: { thesis: 'why now', invalidation: 'below trend' },
  economicTime: '2026-11-24T20:00:00Z', readiness: writable,
  ...overrides,
})

async function plannedTrade(db: Awaited<ReturnType<typeof openDb>>) {
  const result = await confirmOptionPlan(planRequest(), db)
  if (!result.ok) throw new Error('fixture')
  return result.value.trade
}

const openRequest = (tradeId: string, revision: string, readiness = writable) => ({
  tradeId, expectedRevision: revision, positionChangeId: `pc-${tradeId}`,
  economicTime: '2026-11-24T20:00:00Z',
  executions: [{ id: `exec-${tradeId}`, contract, action: 'Buy' as const, opening: true, quantity: '2', price: '3.00', fee: '1.00', economicTime: '2026-11-24T20:00:00Z' }],
  reflection: { definitionRevision: 'D1', disposition: { kind: 'Defer' as const } },
  readiness,
})

describe('option workflow integration (mock-free)', () => {
  it('should atomically commit the option Trade, frozen Planned Leg and completed Plan Reflection', async () => {
    const db = await fixture()
    const result = await confirmOptionPlan(planRequest(), db)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const stored = await repo.get<{ lifecycle: string; plan: { strategyId: string; contract: OptionContract; oneR: string } }>(db, 'trade', result.value.trade.id)
    expect(stored).toMatchObject({ lifecycle: 'Planned' })
    expect(stored?.plan).toMatchObject({ strategyId: 'seed-long-call', contract, oneR: '400.00' })
    expect(await repo.get(db, 'journal', `entry-${result.value.trade.id}`)).toBeDefined()
  })

  it('should open a single option leg as one Position Change with the exact contract and one reflection outcome', async () => {
    const db = await fixture()
    const trade = await plannedTrade(db)
    const result = await recordOptionPositionChange(openRequest(trade.id, trade.revision), db)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const stored = await repo.get<{ lifecycle: string; lots: unknown[]; plan: { contractInstrument: string } }>(db, 'trade', trade.id)
    expect(stored).toMatchObject({ lifecycle: 'Open' })
    expect(stored?.lots).toHaveLength(1)
    expect(stored?.plan.contractInstrument).toBe('AAPL 190Call 2026-12-18 x100')
    expect((await readLifecycleIndex(db)).members.Open).toContain(trade.id)
    expect(await repo.get(db, 'journal', `Debt-pc-${trade.id}`)).toBeDefined()
  })

  it('should close the leg with one Close Reason, FIFO Matches, realized P&L and Closed index membership', async () => {
    const db = await fixture()
    const trade = await plannedTrade(db)
    const opened = await recordOptionPositionChange(openRequest(trade.id, trade.revision), db)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    const result = await recordOptionClose({
      tradeId: trade.id, expectedRevision: opened.value.trade.revision,
      positionChangeId: `close-${trade.id}`, economicTime: '2026-11-25T20:00:00Z',
      executions: [{ id: 'close-exec', contract, action: 'Sell', opening: false, quantity: '2', price: '5.00', fee: '1.00', economicTime: '2026-11-25T20:00:00Z' }],
      closeReason: 'Target Reached',
      reflection: { definitionRevision: 'D1', disposition: { kind: 'Defer' } },
      readiness: writable,
    }, db)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const stored = await repo.get<{ lifecycle: string; realizedToDate: string; lotMatches: unknown[]; closeReason: unknown }>(db, 'trade', trade.id)
    expect(stored).toMatchObject({ lifecycle: 'Closed', realizedToDate: '398.00' })
    expect(stored?.lotMatches).toHaveLength(1)
    expect((result.value.trade as { lotMatches?: unknown[] }).lotMatches).toHaveLength(1)
    expect(stored?.closeReason).toEqual({ id: 'seed-target-reached', label: 'Target Reached' })
    const index = await readLifecycleIndex(db)
    expect(index.members.Closed).toContain(trade.id)
    expect(index.members.Open).not.toContain(trade.id)
  })

  it('should write nothing on stale revision, invalid contract or non-Writable readiness', async () => {
    const db = await fixture()
    const trade = await plannedTrade(db)
    expect((await recordOptionPositionChange(openRequest(trade.id, '9'), db)).ok).toBe(false)
    expect((await recordOptionPositionChange(openRequest(trade.id, trade.revision, blocked), db)).ok).toBe(false)
    expect((await confirmOptionPlan(planRequest({ contract: { ...contract, strike: '' } }), db)).ok).toBe(false)
    const stored = await repo.get<{ lifecycle: string }>(db, 'trade', trade.id)
    expect(stored?.lifecycle).toBe('Planned')
  })

  it('should give two identical same-day option Plans distinct Trade ids without overwriting the first', async () => {
    const db = await fixture()
    const first = await confirmOptionPlan(planRequest({
      reflection: { thesis: 'first thesis', invalidation: 'first invalidation' },
    }), db)
    const second = await confirmOptionPlan(planRequest({
      reflection: { thesis: 'second thesis', invalidation: 'second invalidation' },
    }), db)
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(second.value.trade.id).not.toBe(first.value.trade.id)

    const firstEntry = await repo.get<{ snapshot: { answers: Record<string, unknown> } }>(db, 'journal', `entry-${first.value.trade.id}`)
    const secondEntry = await repo.get<{ snapshot: { answers: Record<string, unknown> } }>(db, 'journal', `entry-${second.value.trade.id}`)
    expect(firstEntry?.snapshot.answers.Thesis).toBe('first thesis')
    expect(secondEntry?.snapshot.answers.Thesis).toBe('second thesis')
    const ids = new Set([first.value.trade.id, second.value.trade.id])
    const rows = await repo.all<{ id: string; plan?: { strategyId?: string } }>(db, 'trade')
    expect(rows.filter(r => ids.has(r.id) && r.plan?.strategyId === 'seed-long-call')).toHaveLength(2)
  })

  it('should survive a DB reopen with the same revision, contract and payoff inputs', async () => {
    const db = await fixture()
    const trade = await plannedTrade(db)
    await recordOptionPositionChange(openRequest(trade.id, trade.revision), db)
    const reopened = await openDb()
    const stored = await repo.get<{ lifecycle: string; revision: string; plan: { contract: OptionContract } }>(reopened, 'trade', trade.id)
    expect(stored).toMatchObject({ lifecycle: 'Open', revision: '2' })
    expect(stored?.plan.contract).toEqual(contract)
  })
})
