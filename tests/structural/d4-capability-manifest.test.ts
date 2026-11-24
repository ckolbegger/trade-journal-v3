import { describe, expect, it } from 'vitest'
import { D4_CAPABILITIES, D4_NAVIGATION } from '../../src/domain/capabilities-d4'

describe('D4 Installed Capability Manifest (S1 structural)', () => {
  it('should declare exactly the D4 additions on top of D1-D3', () => {
    expect([...D4_CAPABILITIES]).toEqual([
      'MarketData.save',
      'MarketData.query(ResolveFrames)',
      'TradeAnalysis.evaluate',
      'TradeViewsAndReporting.browseTrades(Evaluated)',
      'TradeViewsAndReporting.getTradeDetail(Evaluated)',
    ])
  })

  it('should keep navigation unchanged and expose no later capability', () => {
    expect(D4_NAVIGATION).toEqual(['Accounts', 'Status', 'New Plan', 'Trades'])
    for (const forbidden of ['Mark(', 'Review(', 'Report(', 'Backup', 'Restore', 'Close(', 'recover', 'replay']) {
      expect(D4_CAPABILITIES.some(c => c.includes(forbidden))).toBe(false)
    }
  })
})
