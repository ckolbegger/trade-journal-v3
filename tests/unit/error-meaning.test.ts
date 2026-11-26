import { describe, expect, it } from 'vitest'
import {
  formatIssues, messageFor, surfaceFor,
} from '../../src/ui/error-meaning'

describe('error meaning', () => {
  it('should map every controller error kind to one canonical prose string', () => {
    expect(messageFor({ kind: 'Validation', issues: ['StaleRevision', 'NotPlanned'] }))
      .toBe('This Plan changed since you opened it; review it and try again. This Trade is not Planned.')
    expect(messageFor({ kind: 'Conflict', issue: 'ObligationAlreadySettled' }))
      .toBe('This Close Review already has an outcome.')
    expect(messageFor({ kind: 'MarkMissing' }))
      .toBe('An exact Mark is required before saving an Action.')
    expect(messageFor({ kind: 'ReviewChanged' }))
      .toBe('Evidence changed; review it and save again.')
    expect(messageFor({ kind: 'NeedsTradeWorkflow' }))
      .toBe('This Debt must be resolved in its Trade Workflow.')
    expect(messageFor({ kind: 'NotFound' })).toBe('Trade not found.')
  })

  it('should select a field alert for expected validation and the global banner for uncaught failures', () => {
    expect(surfaceFor({ kind: 'Validation', issues: ['Thesis'] })).toBe('field')
    expect(surfaceFor({ kind: 'RuntimeNotWritable' })).toBe('field')
    expect(surfaceFor({ kind: 'Conflict' })).toBe('field')
    expect(surfaceFor(new Error('storage unavailable'))).toBe('global')
    expect(surfaceFor('unexpected string')).toBe('global')
  })

  it('should preserve Runtime Readiness and safe-action wording', () => {
    expect(messageFor({ kind: 'RuntimeNotWritable' }))
      .toBe('Writes are disabled until Runtime Readiness is Writable.')
    expect(messageFor(new Error('storage unavailable'))).toBe('storage unavailable')
    expect(messageFor('Create an institution and account first.'))
      .toBe('Create an institution and account first.')
  })

  it('should explain the required expiration format instead of echoing the raw token', () => {
    expect(messageFor({ issues: ['Expiration'] }))
      .toBe('Enter the expiration as YYYY-MM-DD.')
    expect(messageFor({ kind: 'Validation', issues: ['Strike', 'Expiration'] }))
      .toBe('Strike. Enter the expiration as YYYY-MM-DD.')
  })

  it('should read a bare issues-only failure as Validation like pure domain commands return', () => {
    expect(messageFor({ issues: ['Invalidation', 'Strike'] })).toBe('Invalidation is required. Strike.')
    expect(surfaceFor({ issues: ['Thesis'] })).toBe('field')
  })

  it('should keep the old validation-copy contract when migrating from issue-copy', () => {
    expect(formatIssues(['Reflection:DecisionMode', 'Reflection:PrimaryEmotion']))
      .toBe('Decision mode is required. Primary emotion is required.')
    expect(formatIssues(['InvalidExecution', 'InstrumentMismatch']))
      .toBe('Check the quantity, price and fee for every execution. The instrument must match the planned underlying unless explicitly unplanned.')
    expect(formatIssues(['UnmappedFutureToken'])).toBe('UnmappedFutureToken.')
  })
})
