import { describe, expect, it } from 'vitest'
import { D7_CAPABILITIES, D7_NAVIGATION } from '../../src/domain/capabilities-d7'

describe('D7 Installed Capability Manifest (S1 structural)', () => {
  it('should add only Close Review journal and narrative capabilities', () => {
    expect([...D7_CAPABILITIES]).toEqual([
      'Journal.save(CloseReview)',
      'Journal.query(CloseReview)',
      'Journal.getDefinitions(CloseReview)',
      'DailyReview.getDebt(CloseReview)',
      'TradeViewsAndReporting.getTradeDetail(JournalNarrative)',
    ])
  })

  it('should keep Close Review as a detail action and omit later capabilities', () => {
    expect([...D7_NAVIGATION]).toEqual(['Accounts', 'Status', 'New Plan', 'Trades', 'Review'])
    for (const forbidden of ['Provider', 'Report(', 'Backup', 'Restore', 'Option', 'Replay', 'Addendum', 'Void(']) {
      expect(D7_NAVIGATION.some(n => n.includes(forbidden))).toBe(false)
      expect(D7_CAPABILITIES.some(c => c.includes(forbidden))).toBe(false)
    }
  })
})
