import { describe, expect, it } from 'vitest'
import { saveSettingsWithCurrent, requestDurability } from '../../src/domain/workspace'

describe('Workspace settings and protection', () => {
  it('should return Saved with a new binding after a valid time-zone change', () => {
    const result = saveSettingsWithCurrent(
      { timeZone: 'America/New_York', revision: '1' },
      { timeZone: 'UTC', revision: '1' },
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.timeZone).toBe('America/New_York')
      expect(result.value.revision).toBe('2')
    }
  })

  it('should return Unchanged for identical settings and Conflict for a stale revision', () => {
    expect(saveSettingsWithCurrent(
      { timeZone: 'America/New_York', revision: '2' },
      { timeZone: 'America/New_York', revision: '2' },
    ).errorKind).toBe('Unchanged')
    expect(saveSettingsWithCurrent(
      { timeZone: 'Europe/London', revision: '1' },
      { timeZone: 'America/New_York', revision: '2' },
    ).errorKind).toBe('Conflict')
  })

  it('should report NotImproved honestly without deleting data when protection cannot be improved', () => {
    const result = requestDurability({ kind: 'Unavailable', reason: 'host does not support' })
    expect(result).toBe('NotImproved')
  })
})
