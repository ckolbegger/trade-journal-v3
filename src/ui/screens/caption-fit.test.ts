import { describe, expect, it } from 'vitest';
import { captionLength } from './caption-fit.ts';

// Two captions at three lengths each.
const widths = [
  [200, 120, 80],
  [180, 110, 70],
] as const;

describe('the caption length (T95.18)', () => {
  it('should choose the full captions when both fit side by side', () => {
    expect(captionLength(widths, 400, 10)).toBe(0);
  });

  it('should choose the first shorter form when the full ones would overlap, and the shortest when those would', () => {
    // 200 + 10 + 180 = 390 overflows 300; 120 + 10 + 110 = 240 fits.
    expect(captionLength(widths, 300, 10)).toBe(1);
    // 240 overflows 200; 80 + 10 + 70 = 160 fits.
    expect(captionLength(widths, 200, 10)).toBe(2);
    // Nothing fits: the shortest still stands.
    expect(captionLength(widths, 100, 10)).toBe(2);
  });

  it('should use one length for both captions', () => {
    // The Stop's caption alone would fit at its first shorter form in 150, the Target's only at its shortest; both take the shortest.
    const uneven = [[300, 100, 60], [300, 200, 70]] as const;
    expect(captionLength(uneven, 250, 10)).toBe(2);
  });
});
