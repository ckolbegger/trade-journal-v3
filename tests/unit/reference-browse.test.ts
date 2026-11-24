import { describe, expect, it } from 'vitest'
import { browseFamily, resolveRetained } from '../../src/domain/browse'
import type { Institution } from '../../src/domain/types'

const inst = (id: string, label: string, active: boolean): Institution => ({
  id, label, active, revision: '1', history: [],
})

describe('ReferenceCatalog typed browse', () => {
  it('should list one typed family with deterministic label order', () => {
    const rows = browseFamily([inst('i-2', 'Zebra', true), inst('i-1', 'Alpha', true)])
    expect(rows.map(r => r.label)).toEqual(['Alpha', 'Zebra'])
  })

  it('should show current and historical labels for an inactive reference', () => {
    const retired = inst('i-1', 'Schwab LLC', false)
    retired.history.push({ label: 'Schwab', active: true, recordedAt: '2026-01-01' })
    const retained = resolveRetained(retired)
    expect(retained.currentLabel).toBe('Schwab LLC')
    expect(retained.historicalLabels).toContain('Schwab')
  })

  it('should exhaust every page before returning a complete set', () => {
    const items = Array.from({ length: 25 }, (_, i) => inst(`i-${i}`, `Inst ${i}`, true))
    const page = browseFamily(items, 10)
    expect(page.length).toBe(25)
  })
})
