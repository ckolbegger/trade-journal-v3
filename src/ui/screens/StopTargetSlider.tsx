import type { RangePosition } from '../../app/types.ts';
import type { Rational } from '../../domain/values/index.ts';
import { shortDate } from '../format.ts';

// The figures the description speaks, already formatted by the caller.
export interface SliderFigures {
  readonly riskToStop: string;
  readonly pnl: string;
  readonly rewardToRisk: string;
}

// A share as a CSS percentage, exactly: the rational is scaled before it becomes a number.
const cssPercent = (share: Rational): string => `${Number((share.numerator * 100_000_000n) / share.denominator) / 1_000_000}%`;

// A whole percent from the exact rational, rounded half up: floor((200 n + d) / (2 d)) for n/d.
const wholePercent = (share: Rational): string => `${(200n * share.numerator + share.denominator) / (2n * share.denominator)}%`;

// The missing input in the words figures.ts uses.
function notPlaced(position: Extract<RangePosition, { kind: 'NotPlaced' }>): string {
  if (position.reason === 'MissingInput') return `Mark missing: ${position.instrumentKey}, ${shortDate(position.date)}`;
  return position.reason === 'AwaitingClose' ? 'Awaiting the next close' : 'Not available';
}

function describe(position: Extract<RangePosition, { kind: 'Placed' }>, figures: SliderFigures): string {
  const where = position.pinned ? `Past the ${position.pinned}` : `${wholePercent(position.now)} of the way from the Stop to the Target`;
  return `${where}, entry at ${wholePercent(position.atEntry)}. Risk to stop ${figures.riskToStop}, P&L ${figures.pnl}, Reward : risk ${figures.rewardToRisk}.`;
}

// Stop-to-Target slider (P39): red at the Stop, green at the Target, a dot at the Mark and a tick at entry.
// It shows no text; its meaning is the accessible description (UI contract: colour never carries meaning alone).
export function StopTargetSlider({ position, figures }: { readonly position: RangePosition; readonly figures: SliderFigures }) {
  if (position.kind === 'NotPlaced') {
    return (
      <span className="slider slider-none" role="img" aria-label={notPlaced(position)}>
        <span className="slider-track" />
      </span>
    );
  }
  return (
    <span className="slider" role="img" aria-label={describe(position, figures)}>
      <span className="slider-track" />
      <span className="slider-entry" style={{ left: cssPercent(position.atEntry) }} />
      <span className={position.pinned ? 'slider-now slider-pinned' : 'slider-now'} style={{ left: cssPercent(position.now) }} />
    </span>
  );
}
