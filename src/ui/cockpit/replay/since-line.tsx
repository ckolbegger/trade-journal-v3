import { Words } from './figure-words.tsx';

// One part of the call's move: its name ("time") and its finished figure as the screen words it.
export interface SincePart {
  readonly name: string;
  readonly text: string;
  // The same figure as a number of dollars a share, for the bar only (drawing, A256).
  readonly value: number;
}

const WIDTH = 160;
const HEIGHT = 10;

// A picture of the parts: side by side from a zero line, a loss to its left and a gain to its right, each as wide as its figure is large (A256: turning
// a finished figure into a coordinate is drawing). It says nothing the sentence does not.
function barOf(parts: readonly SincePart[]): { readonly part: SincePart; readonly x: number; readonly width: number }[] {
  const losses = parts.reduce((total, part) => total + Math.max(0, -part.value), 0);
  const gains = parts.reduce((total, part) => total + Math.max(0, part.value), 0);
  const scale = losses + gains === 0 ? 0 : WIDTH / (losses + gains);
  let left = losses * scale;
  let right = left;
  return parts.map((part) => {
    const width = Math.abs(part.value) * scale;
    if (part.value < 0) {
      left -= width;
      return { part, x: left, width };
    }
    right += width;
    return { part, x: right - width, width };
  });
}

function SplitBar({ parts }: { readonly parts: readonly SincePart[] }) {
  return (
    <svg className="replay-since-bar" data-testid="since-bar" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
      {barOf(parts).map(({ part, x, width }) => (
        <rect key={part.name} data-testid="since-bar-part" data-part={part.name} x={x} y={0} width={width} height={HEIGHT} />
      ))}
    </svg>
  );
}

// W48: the line under the charts. Plain props, already formatted: the component draws what it is given and works out nothing (ADR 0001).
export interface SinceLineProps {
  // "Since Fri Nov 13: Trade P&L −$150.00."
  readonly lead: string;
  // "The call moved −$0.75 a share:", or the whole of what follows when the move is not split, or "AXIO moved +$1.40 a share." for stock.
  readonly move?: string;
  // The parts of the split, in the order shown; absent where the move is whole or not split.
  readonly parts?: readonly SincePart[];
  // The tag that sets the parts apart from a Mark (P121): "estimate"; absent for exact figures.
  readonly tag?: string;
}

export function SinceLine({ lead, move, parts, tag }: SinceLineProps) {
  const sentence = [lead, move, parts?.map((part) => `${part.name} ${part.text}`).join(' · ')].filter((text) => text !== undefined && text !== '').join(' ');
  return (
    <p className="replay-since" data-testid="since">
      <Words text={sentence} />
      {tag && <span className="replay-chip-tag">{tag}</span>}
      {parts && <SplitBar parts={parts} />}
    </p>
  );
}
