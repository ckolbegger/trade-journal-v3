import { describe, expect, it } from 'vitest'
import { D8_CAPABILITIES, D8_NAVIGATION } from '../../src/domain/capabilities-d8'

describe('D8 Installed Capability Manifest (S1 structural)', () => {
  it('should add only single-leg option capabilities', () => {
    expect([...D8_CAPABILITIES]).toEqual([
      'TradeWorkflows.confirmPlan(OptionLeg)',
      'TradeWorkflows.recordPositionChange(OptionLeg)',
      'TradeAnalysis.assessPlan(OptionLeg)',
      'TradeAnalysis.expirationPayoff',
      'ReferenceCatalog.resolve(StrategyShape)',
      'TradeViewsAndReporting.getTradeDetail(Payoff)',
    ])
  })

  it('should keep option work as plan and detail actions and omit later capabilities', () => {
    expect([...D8_NAVIGATION]).toEqual(['Accounts', 'Status', 'New Plan', 'Trades', 'Review'])
    for (const forbidden of [
      'Provider', 'Report(', 'Backup', 'Restore', 'Spread', 'Settlement', 'Replay', 'ManagementRevision',
    ]) {
      expect(D8_NAVIGATION.some(n => n.includes(forbidden))).toBe(false)
      expect(D8_CAPABILITIES.some(c => c.includes(forbidden))).toBe(false)
    }
  })
})
