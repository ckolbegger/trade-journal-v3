import { describe, expect, it } from 'vitest'
import { stickerFor } from '../../src/ui/trade-sticker'

describe('trade-list sticker', () => {
  it('should keep the full underlying for a normal ticker', () => {
    expect(stickerFor('aapl')).toEqual({ text: 'AAPL', compact: false })
    expect(stickerFor('MSFT')).toEqual({ text: 'MSFT', compact: false })
    expect(stickerFor('BRK.B')).toEqual({ text: 'BRK.B', compact: false })
  })

  it('should mark an unusually long underlying compact without truncating it', () => {
    const sticker = stickerFor('brk.b-call-2026')
    expect(sticker.text).toBe('BRK.B-CALL-2026')
    expect(sticker.compact).toBe(true)
    expect(sticker.text.startsWith('BR')).toBe(true)
  })

  it('should tolerate a missing underlying without inventing characters', () => {
    expect(stickerFor('')).toEqual({ text: '', compact: false })
  })
})
