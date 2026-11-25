import { describe, expect, it } from 'vitest'
import { declaredCapabilities, navigationFor } from '../../src/domain/capability-declaration'

describe('D1 installed capability declaration', () => {
  it('should declare only Institution and Account operations plus workspace lifecycle', () => {
    expect(declaredCapabilities()).toEqual(['Institutions & Accounts', 'Workspace'])
  })

  it('should omit every later capability from navigation', () => {
    expect(navigationFor()).toEqual(['Accounts', 'Status', 'New Plan', 'Trades', 'Review'])
  })

  it('should never return a domain Unavailable result for an undelivered capability', () => {
    for (const label of ['Journal', 'Mark', 'Report', 'Backup', 'Restore', 'Execution', 'Close']) {
      expect(navigationFor()).not.toContain(label)
    }
  })
})
