import { describe, expect, it } from 'vitest'
import { createInstitution, renameInstitution } from '../../src/domain/catalog'

describe('ReferenceCatalog.save Institution', () => {
  it('should create an Institution with a stable identity and return its complete record', () => {
    const result = createInstitution('Charles Schwab', [])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.id).toMatch(/^inst-/)
      expect(result.value.label).toBe('Charles Schwab')
      expect(result.value.revision).toBe('1')
      expect(result.value.history).toEqual([])
    }
  })

  it('should append one administrative history revision and leave earlier history inspectable', () => {
    const first = createInstitution('Schwab', [])
    if (!first.ok) throw new Error('setup failed')
    const renamed = renameInstitution(first.value, 'Schwab LLC', '1')
    expect(renamed.ok).toBe(true)
    if (renamed.ok) {
      expect(renamed.value.history).toHaveLength(1)
      expect(renamed.value.history[0]!.label).toBe('Schwab')
      expect(renamed.value.label).toBe('Schwab LLC')
    }
  })

  it('should reject a duplicate current label with a typed no-write result', () => {
    const first = createInstitution('Schwab', [])
    if (!first.ok) throw new Error('setup failed')
    const duplicate = createInstitution('Schwab', [first.value])
    expect(duplicate.ok).toBe(false)
    if (!duplicate.ok) expect(duplicate.error.kind).toBe('DuplicateLabel')
  })

  it('should require an expected revision for rename', () => {
    const first = createInstitution('Schwab', [])
    if (!first.ok) throw new Error('setup failed')
    const stale = renameInstitution(first.value, 'Schwab LLC', '99')
    expect(stale.ok).toBe(false)
    if (!stale.ok) expect(stale.error.kind).toBe('StaleRevision')
  })
})
