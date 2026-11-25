import { describe, expect, it, vi } from 'vitest'
import { tradeIdToken } from '../../src/ui/option-controller'

describe('option Trade id uniqueness without platform crypto', () => {
  it('should still produce a non-empty unique token when crypto.randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {})
    try {
      const first = tradeIdToken()
      const second = tradeIdToken()
      expect(first.length).toBeGreaterThan(0)
      expect(second.length).toBeGreaterThan(0)
      expect(first).not.toBe(second)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('should use crypto.randomUUID when it is available', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'aaaaaaaa-bbbb' })
    try {
      expect(tradeIdToken()).toBe('aaaaaaaa')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
