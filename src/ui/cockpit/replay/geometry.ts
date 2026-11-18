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
  const left = width < 460 ? 40 : 50;
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

// Round gridline values inside the range.
export function ticks(min: number, max: number, want: number): number[] {
  const raw = (max - min) / want;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

// An axis label: "$100", "$54.50".
export function axisMoney(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })}`;
}
