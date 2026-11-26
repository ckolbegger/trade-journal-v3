import { describe, expect, it } from 'vitest'
import { openDb, repo } from '../../src/persistence/db'
import { readCloseReviewState, readObligation } from '../../src/ui/obligation-read'
import { resolveReviewDebt } from '../../src/ui/review-controller'
import { evaluateReadiness } from '../../src/domain/readiness'
import { CLOSE_REVIEW_DEFINITION } from '../../src/domain/close-review'

const readiness = evaluateReadiness({
  diagnosticTransaction: true, capacityHeadroom: true, serviceWorkerControl: true,
  offlineInventoryValid: true, protection: { kind: 'BestEffort', reason: 'test' },
  workspaceReadable: true, existingRoot: 'none',
})
const key = 'CloseReview:trade-obl'

async function seed(db: Awaited<ReturnType<typeof openDb>>) {
  await repo.put(db, 'journal', {
    id: `debt-${key}`, kind: 'Debt', obligationKey: key, status: 'Outstanding',
    snapshot: {
      definitionRevision: 'D1',
      prompts: CLOSE_REVIEW_DEFINITION.prompts,
      anchor: { kind: 'Trade', tradeId: 'trade-obl' },
    },
    anchor: { kind: 'Trade', tradeId: 'trade-obl' },
    origin: { kind: 'TradeClose', tradeId: 'trade-obl' },
    dueSemantics: 'DueAtNextDailyReview', dueAt: '2026-11-25',
    settlementRoute: 'Journal.save(ResolveDebt)',
  })
}

// No mocks: real IndexedDB via fake-indexeddb, real domain code.
describe('obligation read (mock-free)', () => {
  it('should agree between Closed detail and Daily Review without reimplementing lookup', async () => {
    const db = await openDb()
    await seed(db)
    const read = await readObligation(db, key)
    expect(read.status).toBe('Outstanding Debt')
    expect(read.effective?.kind).toBe('Debt')
    const state = await readCloseReviewState(db, {
      id: 'trade-obl', executions: [{ id: 'exec-1' }],
    })
    expect(state.status).toBe(read.status)
  })

  it('should settle a Debt from Review and resolve the same effective outcome on both reads', async () => {
    const db = await openDb()
    await seed(db)
    const saved = await resolveReviewDebt({
      debtId: `debt-${key}`,
      form: { answers: { takeAgain: 'Yes, with changes' } },
      definitionRevision: 'D1', authoredAt: '2026-11-25T20:10:00Z',
      readiness,
    }, db)
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    const read = await readObligation(db, key)
    const state = await readCloseReviewState(db, { id: 'trade-obl', executions: [] })
    expect(read.status).toBe('Saved')
    expect(state.status).toBe(read.status)
    const debt = await repo.get(db, 'journal', `debt-${key}`)
    expect(debt?.status).toBe('Settled')
  })

  it('should write nothing on a read', async () => {
    const db = await openDb()
    await seed(db)
    const before = await repo.all(db, 'journal')
    await readObligation(db, key)
    await readCloseReviewState(db, { id: 'trade-obl', executions: [] })
    expect(await repo.all(db, 'journal')).toEqual(before)
  })

  it('should still route management debts to their Trade Workflow', async () => {
    const db = await openDb()
    await repo.put(db, 'journal', {
      id: 'debt-mgmt', kind: 'Debt', obligationKey: 'ManagementRevision:trade-x',
      status: 'Outstanding', settlementRoute: 'TradeWorkflows.recordPositionChange',
      snapshot: {}, anchor: { kind: 'Trade', tradeId: 'trade-x' },
      origin: { kind: 'TradeClose', tradeId: 'trade-x' },
      dueSemantics: 'DueAtNextDailyReview', dueAt: '2026-11-25',
    })
    const result = await resolveReviewDebt({ debtId: 'debt-mgmt', form: { text: 'answer' }, readiness }, db)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('NeedsTradeWorkflow')
  })
})
