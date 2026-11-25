import { describe, expect, it } from 'vitest'
import { deriveCompletion, rankTrades, type CompletionInput } from '../../src/domain/review-completion'

const resolved = (overrides: Partial<CompletionInput> = {}): CompletionInput => ({
  missingMarks: [], dueDebt: [], settlementDue: [], unreconciledEpisodes: [], integrityBlocked: false,
  trades: [{ tradeId: 'trade-aapl', actionSaved: true, markStatus: 'Available' }],
  ...overrides,
})

describe('Daily Review completion and attention', () => {
  it('should be Incomplete while any Action, current Mark, Debt, settlement or reconciliation is outstanding', () => {
    const result = deriveCompletion(resolved({
      trades: [{ tradeId: 'trade-aapl', actionSaved: false, markStatus: 'Available' }],
      dueDebt: ['Debt:x'],
    }))
    expect(result.state).toBe('Incomplete')
    expect(result.blockers).toContain('ActionMissing')
    expect(result.blockers).toContain('DebtDue')
  })

  it('should be Complete only when every obligation is resolved with exact current Marks', () => {
    expect(deriveCompletion(resolved()).state).toBe('Complete')
  })

  it('should be CompleteWithUnavailableMarks with an acknowledgment, naming Instruments and Trades', () => {
    const result = deriveCompletion(resolved({
      trades: [{ tradeId: 'trade-aapl', actionSaved: true, markStatus: 'AcknowledgedUnavailable', instrument: 'AAPL' }],
    }))
    expect(result.state).toBe('CompleteWithUnavailableMarks')
    expect(result.unavailable).toEqual([{ instrument: 'AAPL', tradeId: 'trade-aapl' }])
  })

  it('should show "Complete, settlement to record" only as a disclosed Incomplete sub-state', () => {
    const result = deriveCompletion(resolved({ settlementDue: [{ instrument: 'AAPL', tradeId: 'trade-aapl' }] }))
    expect(result.state).toBe('Incomplete')
    expect(result.settlementSubState).toEqual({
      text: 'Complete, settlement to record', instruments: ['AAPL'], trades: ['trade-aapl'],
    })
  })

  it('should rank blocker, boundary, evidence-limited, quantified pressure and routine bands with stable reasons', () => {
    const ranked = rankTrades([
      { tradeId: 'routine', markStatus: 'Available', stopCrossed: false, risk: 10, reward: 20, lastActivity: '2026-11-23' },
      { tradeId: 'blocker', markStatus: 'Missing', stopCrossed: false, risk: 10, reward: 20, lastActivity: '2026-11-23' },
      { tradeId: 'boundary', markStatus: 'Available', stopCrossed: true, risk: 0, reward: 20, lastActivity: '2026-11-23' },
      { tradeId: 'evidence', markStatus: 'AcknowledgedUnavailable', stopCrossed: false, risk: 10, reward: 20, lastActivity: '2026-11-23' },
      { tradeId: 'pressure', markStatus: 'Available', stopCrossed: false, risk: 100, reward: 20, lastActivity: '2026-11-23' },
    ])
    expect(ranked.map(r => r.tradeId)).toEqual(['blocker', 'boundary', 'evidence', 'pressure', 'routine'])
    expect(ranked[0].reasons).toContain('CurrentMarkMissing')
    expect(ranked[3].band).toBe('QuantifiedPressure')
  })
})
