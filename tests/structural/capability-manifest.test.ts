import { describe, expect, it } from 'vitest'
import { INSTALLED_CAPABILITIES, NOT_INSTALLED } from '../../src/domain/capabilities'

describe('D1 Installed Capability Manifest (S4 structural)', () => {
  it('should declare exactly Institution and Account operations plus workspace lifecycle', () => {
    expect([...INSTALLED_CAPABILITIES]).toEqual([
      'ReferenceCatalog.save(Institution)',
      'ReferenceCatalog.save(Account)',
      'ReferenceCatalog.query(typed families)',
      'ReferenceCatalog.resolve(typed requirements)',
      'Workspace.initialize',
      'Workspace.getStatus',
      'Workspace.saveSettings',
      'Workspace.requestDurability',
    ])
  })

  it('should omit every later capability', () => {
    for (const capability of NOT_INSTALLED) {
      expect(INSTALLED_CAPABILITIES.some(c => c.includes(capability))).toBe(false)
    }
  })
})
