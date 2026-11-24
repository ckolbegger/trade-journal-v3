import { describe, expect, it } from 'vitest'
import { D2_CAPABILITIES, D2_NAVIGATION } from '../../src/domain/capabilities-d2'

describe('D2 Installed Capability Manifest (S1 structural)', () => {
  it('should declare exactly the D2 additions on top of D1', () => {
    expect([...D2_CAPABILITIES]).toEqual([
      'ConfirmPlan',
      'TradeAnalysis.assessPlan',
      'TradeRecord.prepareChange',
      'TradeRecord.applyPreparedChange',
      'TradeRecord.getRecord',
      'TradeRecord.queryRecords',
      'TradeViewsAndReporting.browseTrades(Planned)',
      'TradeViewsAndReporting.getTradeDetail(Planned)',
      'Journal.prepareEffects(PlanReflection)',
      'Journal.applyPreparedEffects(PlanReflection)',
      'Journal.getDefinitions',
    ])
  })

  it('should add New Plan and Trades to navigation and no later capability', () => {
    expect(D2_NAVIGATION).toEqual(['Institutions & Accounts', 'Workspace', 'New Plan', 'Trades'])
    for (const forbidden of ['Execution', 'Mark', 'Review', 'Report', 'Backup', 'Restore']) {
      expect(D2_NAVIGATION.some(n => n.includes(forbidden))).toBe(false)
    }
  })
})
