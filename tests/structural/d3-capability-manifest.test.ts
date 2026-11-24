import { describe, expect, it } from 'vitest'
import { D3_CAPABILITIES, D3_NAVIGATION } from '../../src/domain/capabilities-d3'

describe('D3 Installed Capability Manifest (S1 structural)', () => {
  it('should declare exactly the D3 additions on top of D1/D2', () => {
    expect([...D3_CAPABILITIES]).toEqual([
      'TradeWorkflows.recordPositionChange(Open)',
      'TradeAnalysis.derive',
      'TradeRecord.history',
      'TradeViewsAndReporting.browseTrades(Open)',
      'TradeViewsAndReporting.getTradeDetail(Open)',
      'Journal.prepareEffects(PositionChangeReflection)',
      'Journal.applyPreparedEffects(PositionChangeReflection)',
      'Journal.query',
    ])
  })

  it('should add no new navigation entry and no Execution-as-operation or close control', () => {
    expect(D3_NAVIGATION).toEqual(['Institutions & Accounts', 'Workspace', 'New Plan', 'Trades'])
    for (const forbidden of ['Execution', 'Close', 'Mark', 'Review', 'Report', 'Backup', 'Restore']) {
      expect(D3_NAVIGATION.some(n => n.includes(forbidden))).toBe(false)
    }
    for (const forbiddenOperation of ['recordExecution', 'CloseTrade', 'setLifecycle', 'Mark(', 'Review(', 'Report(', 'Backup', 'Restore']) {
      expect(D3_CAPABILITIES.some(c => c.includes(forbiddenOperation))).toBe(false)
    }
  })
})
