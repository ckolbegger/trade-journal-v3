import { describe, expect, it } from 'vitest'
import { D5_CAPABILITIES, D5_NAVIGATION } from '../../src/domain/capabilities-d5'

describe('D5 Installed Capability Manifest (S1 structural)', () => {
  it('should declare exactly the D5 additions on top of D1-D4', () => {
    expect([...D5_CAPABILITIES]).toEqual([
      'DailyReview.open',
      'DailyReview.getTrade',
      'DailyReview.getDebt',
      'DailyReview.save',
      'Journal.save(DailyTradeReview)',
      'TradeAnalysis.replay',
      'TradeRecord.reconcileStopDiscipline',
    ])
  })

  it('should add Review navigation and no later capability', () => {
    expect(D5_NAVIGATION).toEqual(['Accounts', 'Status', 'New Plan', 'Trades', 'Review'])
    for (const forbidden of ['Recover(', 'ReplayView(', 'Report(', 'Backup', 'Restore', 'CloseTrade', 'Mark(']) {
      expect(D5_CAPABILITIES.some(c => c.includes(forbidden))).toBe(false)
    }
  })
})
