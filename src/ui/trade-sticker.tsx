// Trade-list sticker. One rule for Planned, Open and Closed rows: show the
// full underlying, never a two-character abbreviation. Long values are
// marked compact so the view can shrink the type instead of clipping them.
export type TradeSticker = { text: string; compact: boolean }

export function stickerFor(underlying: string): TradeSticker {
  const text = String(underlying ?? '').trim().toUpperCase()
  return { text, compact: text.length > 5 }
}

export function TradeSticker({ underlying }: { underlying: string }) {
  const sticker = stickerFor(underlying)
  return (
    <span
      className={`monogram${sticker.compact ? ' compact' : ''}`}
      aria-hidden="true"
    >{sticker.text}</span>
  )
}
