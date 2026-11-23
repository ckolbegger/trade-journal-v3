// Which length of caption the "Now" box shows (P170): the longest one at which the captions all fit side by side. Widths come in as arguments, so the
// choice needs no layout; the box measures them and calls this again when its own width changes.
export type CaptionLength = 0 | 1 | 2;

// `widths[i][length]` is the width of caption i at that length (0 the full sentence, 1 the first shorter form, 2 the shortest); `gap` stands between two captions.
export function captionLength(widths: readonly (readonly [number, number, number])[], room: number, gap: number): CaptionLength {
  const between = gap * Math.max(0, widths.length - 1);
  for (const length of [0, 1] as const) {
    if (widths.reduce((sum, caption) => sum + caption[length], between) <= room) return length;
  }
  return 2;
}
