// A255, A256: geometry is presentation. It turns finished prices and session slots into SVG coordinates and picks the
// vertical range from the Plan's anchors and the revealed sessions; it never works out a figure the screen shows.

export interface TimeAxis {
  readonly width: number;
  // Left edge of the plot area (room for the price labels) and its right edge.
  readonly left: number;
  readonly right: number;
  // The x of a session's slot. The first column is the Plan's, so slot 0 is the second column (A252).
  readonly x: (slot: number) => number;
  readonly column: number;
}

// `slots` trading sessions from the first to the contract's expiration (to the last session for stock): the axis
// always runs the full width, and later sessions are left blank.
export function timeAxis(width: number, slots: number): TimeAxis {
  // On a phone the room is for "−$1,000", the widest axis figure a chart usually draws, minus sign included.
  const left = width < 460 ? 49 : 50;
  const right = width - 8;
  const column = (right - left) / (slots + 1);
  return { width, left, right, column, x: (slot) => left + column * (slot + 1.5) };
}

export interface ValueAxis {
  readonly min: number;
  readonly max: number;
  readonly y: (value: number) => number;
}

export function valueAxis(range: readonly [number, number], top: number, floor: number): ValueAxis {
  const [min, max] = range;
  return { min, max, y: (value) => top + ((max - value) / (max - min)) * (floor - top) };
}

// The price axis: the Plan's anchors (entry, strike, a condition's price) with room around them, stretched only to
// take in the revealed Marks. A later session is never passed, so it can't move the axis.
export function priceRange(anchors: readonly number[], marks: readonly number[]): readonly [number, number] {
  let lo = anchors.length > 0 ? Math.min(...anchors) : Math.min(...marks, 0);
  let hi = anchors.length > 0 ? Math.max(...anchors) : Math.max(...marks, 1);
  if (anchors.length > 0) {
    const pad = Math.max((hi - lo) * 0.3, Math.abs(hi) * 0.025);
    lo -= pad;
    hi += pad;
  }
  if (marks.length > 0) {
    const mlo = Math.min(...marks);
    const mhi = Math.max(...marks);
    const pad = (Math.max(hi, mhi) - Math.min(lo, mlo)) * 0.06;
    if (mlo < lo) lo = mlo - pad;
    if (mhi > hi) hi = mhi + pad;
  }
  return lo === hi ? [lo - 1, hi + 1] : [lo, hi];
}

export interface Spot {
  readonly x: number;
  readonly y: number;
  readonly anchor: 'start' | 'middle' | 'end';
}

// Where each label goes. A label takes the first of its spots that sits inside the chart and clears every label kept
// before it; with none free it is left out. A `must` label (a result) is never left out: with no spot free it takes
// its first spot even when that overlaps. Call in priority order.
export class LabelPlacer {
  private readonly kept: { x0: number; x1: number; y0: number; y1: number }[] = [];
  private readonly width: number;
  private readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  private static box(text: string, s: Spot, charWidth: number) {
    const w = text.length * charWidth + 2;
    let x0 = s.x - w / 2;
    if (s.anchor === 'start') x0 = s.x;
    else if (s.anchor === 'end') x0 = s.x - w;
    return { x0, x1: x0 + w, y0: s.y - 10, y1: s.y + 3 };
  }

  // Holds a text's space (a chart title, drawn bold and wider) so no label is placed over it.
  reserve(text: string, spot: Spot, charWidth = 7): void {
    this.kept.push(LabelPlacer.box(text, spot, charWidth));
  }

  // `charWidth` is the text's estimated width a character: 6 unless it is drawn bold and larger.
  place(text: string, spots: readonly Spot[], must = false, charWidth = 6): Spot | null {
    const box = (s: Spot) => LabelPlacer.box(text, s, charWidth);
    const free = (b: ReturnType<typeof box>) =>
      b.x0 >= 0 && b.x1 <= this.width && b.y0 >= 0 && b.y1 <= this.height && !this.kept.some((k) => b.x0 < k.x1 && k.x0 < b.x1 && b.y0 < k.y1 && k.y0 < b.y1);
    const spot = spots.find((s) => free(box(s))) ?? (must ? spots[0] : undefined);
    if (!spot) return null;
    this.kept.push(box(spot));
    return spot;
  }
}

// The P&L axis: break-even and every finished dollar figure the chart draws (the Plan's results, and each revealed
// session's result, banked and results at the lines), with room around them. A later session is never passed.
export function pnlRange(values: readonly number[]): readonly [number, number] {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const pad = (hi - lo) * 0.1 || 1;
  return [lo - pad, hi + pad];
}

// Round gridline values inside the range.
export function ticks(min: number, max: number, want: number): number[] {
  const raw = (max - min) / want;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

// Whether an axis figure, right-aligned 5 px left of the plot area, lies inside the drawing; one that doesn't is left out, never cut (A256).
export function tickFits(text: string, left: number): boolean {
  return left - 5 - (text.length * 6 + 2) >= 0;
}

// An axis label: "$100", "$54.50".
export function axisMoney(value: number): string {
  const text = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 });
  return `${value < 0 ? '−' : ''}$${text}`;
}
