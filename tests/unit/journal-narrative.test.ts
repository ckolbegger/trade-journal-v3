import { describe, expect, it } from 'vitest'
import { buildTradeNarrative, type NarrativeRow } from '../../src/domain/journal-narrative'

const entry = (id: string, anchor: Record<string, unknown>, overrides: Partial<NarrativeRow> = {}): NarrativeRow => ({
  id, kind: 'Entry', obligationKey: id.replace(/^entry-/, ''), revision: '1', status: 'Saved',
  source: 'Trade Close',
  snapshot: { answers: { TakeAgain: 'No' }, anchor, origin: { kind: 'TradeClose', tradeId: 'trade-x' } },
  ...overrides,
})

describe('Trade Journal narrative', () => {
  it('should include one effective outcome per obligation key anchored to the Trade or its fills', () => {
    const rows = [
      entry('entry-CloseReview:trade-x', { kind: 'Trade', tradeId: 'trade-x' }),
      entry('entry-DailyReview:trade-x:2026-11-23', { kind: 'Trade', tradeId: 'trade-x' }, {
        obligationKey: 'DailyReview:trade-x:2026-11-23', source: 'Daily Review',
      }),
      entry('entry-fill', { kind: 'Execution', executionId: 'exec-2' }, {
        obligationKey: 'PositionChange:pc-2', source: 'Position Change',
      }),
    ]
    const narrative = buildTradeNarrative(rows, 'trade-x', ['exec-1', 'exec-2'])
    expect(narrative.map(n => n.obligationKey)).toEqual([
      'CloseReview:trade-x', 'DailyReview:trade-x:2026-11-23', 'PositionChange:pc-2',
    ])
  })

  it('should exclude Settled Debt rows and superseded versions while preserving declines', () => {
    const rows = [
      entry('entry-CloseReview:trade-x', { kind: 'Trade', tradeId: 'trade-x' }),
      entry('entry-CloseReview:trade-x', { kind: 'Trade', tradeId: 'trade-x' }, {
        revision: '2',
      }),
      { id: 'debt-CloseReview:trade-x', kind: 'Debt', status: 'Settled', obligationKey: 'CloseReview:trade-x' },
      {
        id: 'decline-CloseReview:trade-y', kind: 'JournalDecline', status: 'Declined',
        obligationKey: 'CloseReview:trade-y', reason: 'not useful',
        snapshot: { anchor: { kind: 'Trade', tradeId: 'trade-x' } },
      },
    ]
    const narrative = buildTradeNarrative(rows, 'trade-x', [])
    expect(narrative.filter(n => n.obligationKey === 'CloseReview:trade-x')).toHaveLength(1)
    expect(narrative.find(n => n.obligationKey === 'CloseReview:trade-x')?.revision).toBe('2')
    expect(narrative.some(n => n.kind === 'JournalDecline')).toBe(true)
    expect(narrative.some(n => n.kind === 'Debt')).toBe(false)
  })

  it('should not duplicate an Entry anchored to both a Trade and one of its fills', () => {
    const rows = [
      entry('entry-a', { kind: 'Trade', tradeId: 'trade-x', executionId: 'exec-1' }),
      entry('entry-a', { kind: 'Execution', executionId: 'exec-1' }),
    ]
    const narrative = buildTradeNarrative(rows, 'trade-x', ['exec-1'])
    expect(narrative).toHaveLength(1)
  })

  it('should exclude rows anchored to another Trade', () => {
    const rows = [entry('entry-other', { kind: 'Trade', tradeId: 'trade-y' }, {
      snapshot: { anchor: { kind: 'Trade', tradeId: 'trade-y' }, origin: { kind: 'TradeClose', tradeId: 'trade-y' } },
    })]
    expect(buildTradeNarrative(rows, 'trade-x', [])).toEqual([])
  })
})
