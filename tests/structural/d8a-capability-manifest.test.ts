import { describe, expect, it } from 'vitest'
import { D8A_CAPABILITIES, D8A_NAVIGATION } from '../../src/domain/capabilities-d8a'

describe('D8a Installed Capability Manifest (S1 structural)', () => {
  it('should add only complete detail, mark-only replay and advisory explanation capabilities', () => {
    expect([...D8A_CAPABILITIES]).toEqual([
      'TradeViewsAndReporting.getTradeDetail(Complete)',
      'TradeViewsAndReporting.replayTrade(MarkOnly)',
      'MarketData.query(ReadSeries)',
      'Journal.query',
      'ReferenceCatalog.resolve(LabelLens)',
      'TradeAnalysis.advisoryExplanation(IV)',
    ])
  })

  it('should keep navigation read-only and omit future or forbidden capabilities', () => {
    expect([...D8A_NAVIGATION]).toEqual(['Accounts', 'Status', 'New Plan', 'Trades', 'Review'])
    for (const forbidden of [
      'ProviderConfiguration', 'Recovery', 'DailyBar(Required)', 'OHLC', 'CustomRange',
      'PayoffReplay', 'Adherence', 'Report(', 'Backup', 'Restore', 'Prediction', 'Coaching',
    ]) {
      expect(D8A_CAPABILITIES.some(c => c.includes(forbidden))).toBe(false)
      expect(D8A_NAVIGATION.some(n => n.includes(forbidden))).toBe(false)
    }
  })
})
