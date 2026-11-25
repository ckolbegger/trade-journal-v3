import { describe, expect, it } from 'vitest'
import * as optionPlan from '../../src/domain/option-plan'
import * as optionPosition from '../../src/domain/option-position'
import * as payoff from '../../src/domain/expiration-payoff'

describe('D8 public contract (S4 structural)', () => {
  it('should expose pure analysis operations with no lifecycle setter or generic close', () => {
    expect(typeof optionPlan.assessOptionPlan).toBe('function')
    expect(typeof optionPosition.deriveOptionPosition).toBe('function')
    expect(typeof payoff.expirationPayoff).toBe('function')
    for (const forbidden of ['setLifecycle', 'closeTrade', 'theoreticalPrice', 'formula']) {
      expect(Object.keys(optionPlan)).not.toContain(forbidden)
      expect(Object.keys(optionPosition)).not.toContain(forbidden)
      expect(Object.keys(payoff)).not.toContain(forbidden)
    }
  })

  it('should keep the deviation vocabulary closed to four categories', () => {
    expect(Object.values(optionPosition.OPTION_DEVIATION_CATEGORIES).sort()).toEqual([
      'EntrySize', 'PlannedLegTerms', 'StopDiscipline', 'UnplannedExposure',
    ])
  })
})
