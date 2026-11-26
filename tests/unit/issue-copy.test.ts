import { describe, expect, it } from 'vitest'
import { formatIssues } from '../../src/ui/error-meaning'

describe('user-facing validation copy', () => {
  it('should translate reflection tokens into human-readable prose', () => {
    expect(formatIssues(['Reflection:DecisionMode', 'Reflection:PrimaryEmotion']))
      .toBe('Decision mode is required. Primary emotion is required.')
  })

  it('should translate execution and revision tokens into human-readable prose', () => {
    expect(formatIssues(['InvalidExecution', 'InstrumentMismatch']))
      .toBe('Check the quantity, price and fee for every execution. The instrument must match the planned underlying unless explicitly unplanned.')
    expect(formatIssues(['StaleRevision', 'NotPlanned']))
      .toBe('This Plan changed since you opened it; review it and try again. This Trade is not Planned.')
  })

  it('should translate market-data tokens into human-readable prose', () => {
    expect(formatIssues(['InvalidPrice', 'MissingReason', 'ExactMarkExists']))
      .toBe('Enter a positive numeric price. A reason is required. An exact Mark already exists for this date.')
  })

  it('should never silently swallow an unknown typed token', () => {
    expect(formatIssues(['UnmappedFutureToken'])).toBe('UnmappedFutureToken.')
  })
})
