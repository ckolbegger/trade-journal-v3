import { describe, expect, it } from 'vitest'
import { D6_CAPABILITIES, D6_NAVIGATION } from '../../src/domain/capabilities-d6'

describe('D6 Installed Capability Manifest (S1 structural)', () => {
  it('should add only terminal Long Stock close capabilities', () => {
    expect([...D6_CAPABILITIES]).toEqual([
      'TradeWorkflows.recordPositionChange(Closed)',
      'TradeAnalysis.derive(FIFO)',
      'TradeRecord.lotMatches',
      'ReferenceCatalog.resolve(CloseReason)',
      'TradeViewsAndReporting.getTradeDetail(Closed)',
    ])
  })

  it('should keep Close as a detail action and omit later capabilities', () => {
    expect([...D6_NAVIGATION]).toEqual(['Accounts', 'Status', 'New Plan', 'Trades', 'Review'])
    for (const forbidden of ['Provider', 'Report(', 'Backup', 'Restore', 'Close Review', 'Option', 'Replay']) {
      expect(D6_NAVIGATION.some(n => n.includes(forbidden))).toBe(false)
      expect(D6_CAPABILITIES.some(c => c.includes(forbidden))).toBe(false)
    }
  })
})
