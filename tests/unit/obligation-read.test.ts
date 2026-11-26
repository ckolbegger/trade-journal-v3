import { describe, expect, it } from 'vitest'
import {
  obligationStatus, resolveObligation, type ObligationRow,
} from '../../src/ui/obligation-read'

const key = 'CloseReview:trade-1'
const base = { obligationKey: key }
const entry = (id = 'entry-1'): ObligationRow => ({
  ...base, id, kind: 'Entry', status: 'Saved', revision: '1',
  source: 'Journal', definitionRevision: 'D1', snapshot: {},
})
const decline = (): ObligationRow => ({
  ...base, id: 'decline-1', kind: 'JournalDecline', status: 'Declined', origin: { kind: 'Trader' },
})
const debt = (status = 'Outstanding', id = 'debt-1'): ObligationRow => ({
  ...base, id, kind: 'Debt', status, snapshot: {}, anchor: { kind: 'Trade', tradeId: 'trade-1' },
  origin: { kind: 'TradeClose', tradeId: 'trade-1' },
  dueSemantics: 'DueAtNextDailyReview', dueAt: '2026-11-25',
  settlementRoute: 'Journal.save(ResolveDebt)',
})

describe('obligation read', () => {
  it('should resolve one effective outcome per obligation key from Entry, JournalDecline and unsettled Debt', () => {
    expect(resolveObligation([debt()], key).effective?.kind).toBe('Debt')
    expect(resolveObligation([debt(), decline()], key).effective?.kind).toBe('JournalDecline')
    expect(resolveObligation([debt(), decline(), entry()], key).effective?.kind).toBe('Entry')
    expect(resolveObligation([debt('Settled'), entry()], key).effective?.kind).toBe('Entry')
    expect(resolveObligation([], key).effective).toBeUndefined()
  })

  it('should keep due-at-next-Review semantics and never expose a storage noun in the result', () => {
    const resolved = resolveObligation([debt()], key)
    expect(resolved.dueSemantics).toBe('DueAtNextDailyReview')
    expect(resolved.dueAt).toBe('2026-11-25')
    expect(resolved.needsTradeWorkflow).toBe(false)
    expect(JSON.stringify(resolved)).not.toContain('settlementRoute')
  })

  it('should flag TradeWorkflow debts without the caller string-matching a storage noun', () => {
    const workflow = resolveObligation([{
      ...debt(), id: 'debt-2',
      settlementRoute: 'TradeWorkflows.recordPositionChange',
    }], key)
    expect(workflow.needsTradeWorkflow).toBe(true)
    const management = resolveObligation([{
      ...debt(), id: 'debt-3', obligationKey: 'ManagementRevision:trade-1',
    }], 'ManagementRevision:trade-1')
    expect(management.needsTradeWorkflow).toBe(true)
  })

  it('should preserve the status mapping used by Closed detail and Daily Review', () => {
    expect(obligationStatus(entry())).toBe('Saved')
    expect(obligationStatus(decline())).toBe('Declined')
    expect(obligationStatus(debt())).toBe('Outstanding Debt')
    expect(obligationStatus(undefined)).toBe('')
  })
})
