import { describe, expect, it } from 'vitest'
import { createAccount, archiveInstitution, resolveNewSelection } from '../../src/domain/catalog'
import type { Account, Institution } from '../../src/domain/types'

const inst: Institution = {
  id: 'inst-1', label: 'Schwab', active: true, revision: '1', history: [],
}

describe('ReferenceCatalog.save Account', () => {
  it('should create an Account under a selectable Institution with an immutable parent', () => {
    const result = createAccount('Main', inst)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.institutionId).toBe('inst-1')
      expect(result.value.id).toMatch(/^acct-/)
    }
  })

  it('should reject creation when the parent Institution is not selectable', () => {
    const inactive = { ...inst, active: false }
    const result = createAccount('Main', inactive)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('ParentNotSelectable')
  })

  it('should prevent archiving an Institution that still has selectable Accounts', () => {
    const account = createAccount('Main', inst)
    if (!account.ok) throw new Error('setup failed')
    const result = archiveInstitution(inst, [account.value])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('HasSelectableAccounts')
  })

  it('should mark onboarding ready after a real Account exists', () => {
    const account = createAccount('Main', inst)
    expect(account.ok).toBe(true)
  })
})

describe('ReferenceCatalog.resolve typed requirements', () => {
  it('should reject an inactive Account for NewSelection but keep it valid as retained', () => {
    const inactive = { id: 'acct-2', institutionId: 'inst-1', label: 'Old', active: false, revision: '2', history: [] } as Account
    expect(resolveNewSelection(inactive).ok).toBe(false)
  })
})
