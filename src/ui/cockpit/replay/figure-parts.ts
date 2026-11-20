// A text as the parts the page draws: its words, and each figure (a signed amount, an R multiple, the odds "11.69 to 1", a percentage pair "8% : 92%") as a part of its own that the page keeps on one
// line (C9AR.2, A278). It splits text the readout already worded; it works out nothing. The session cards, the readout and the overlay's header all draw their text through it.
export interface FigurePart {
  readonly text: string;
  readonly figure?: true;
}
const FIGURE = /[−+]?\$[\d,]+(?:\.\d+)?|[−+]?\d[\d,]*(?:\.\d+)?R\b|\d+(?:\.\d+)? to \d+|under 1% : over 99%|over 99% : under 1%|\d+% : \d+%|\d+(?:\.\d+)?%/g;
export function figureParts(text: string): FigurePart[] {
  const parts: FigurePart[] = [];
  let at = 0;
  for (const m of text.matchAll(FIGURE)) {
    if (m.index > at) parts.push({ text: text.slice(at, m.index) });
    parts.push({ text: m[0], figure: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}
