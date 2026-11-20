// A216, A260: the meter takes plain props. A number is a finished dollar figure that the meter only turns into a position on the track
// (A215, A256), never one it works out; a string is the screen's own words. No view or domain type is imported here: only a
// `*.props.ts` adapter (T9.33, T9.34, T9.35) knows the meter reading and builds these.

// A finished figure: dollars as drawn, and the same figure formatted ("+$316.00", "−$600.00").
export interface MeterFigure {
  readonly value: number;
  readonly text: string;
}

export type MeterZone = 'Within' | 'PastStop' | 'PastTarget';

export interface MeterNow extends MeterFigure {
  readonly kind: 'Value';
  // standing's zone: past a rail draws a hatch and a square pointer.
  readonly zone: MeterZone;
  // "62% of the way to the Target": the share, finished, and the rail it runs to. Absent where the domain gave none (at break-even).
  readonly share?: { readonly percent: string; readonly toward: 'Stop' | 'Target' };
  // "$180.00": how far past a rail, finished; present when the zone is not Within.
  readonly pastBy?: string;
}

export interface MeterUnavailable {
  readonly kind: 'Unavailable';
  // The reason in words ("No Mark for Fri Nov 13: the P&L cannot be placed.").
  readonly reason: string;
}

// The Trade P&L at the session before. The direction is the domain's reading of now against it; the meter does not compare.
export interface MeterPrevious extends MeterFigure {
  // "Thu Nov 12".
  readonly dateLabel: string;
  readonly direction: 'Up' | 'Down' | 'Level';
}

export type MeterSize = 'card' | 'row' | 'detail';

export interface MeterProps {
  readonly size: MeterSize;
  // The Trade's result at the Stop and at the Target (the rails; they need no Mark).
  readonly stop: MeterFigure;
  readonly target: MeterFigure;
  // The realized P&L to date; absent when none.
  readonly banked?: MeterFigure;
  readonly now: MeterNow | MeterUnavailable;
  // The session before's result; absent when it had none.
  readonly previous?: MeterPrevious;
}
