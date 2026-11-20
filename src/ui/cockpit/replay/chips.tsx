import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Words } from './figure-words.tsx';

// One session of the small chart: its date, the finished volatility as a fraction (null where none could be read) and its words.
export interface VolatilityPoint {
  readonly label: string;
  readonly value: number | null;
  readonly text: string;
}

// W47: the chips under the charts. Plain props, already formatted: the component draws what it is given and works out nothing (ADR 0001).
export interface ChipsProps {
  // The tag that sets an estimate apart from a Mark (P121): "estimate".
  readonly tag: string;
  // "Implied volatility 27.7%", or "Implied volatility Unavailable"; absent for stock. `points` are the revealed sessions only, oldest first.
  readonly volatility?: { readonly text: string; readonly reason?: string; readonly chartName: string; readonly points: readonly VolatilityPoint[] };
  // "Behaves like ≈ 183 shares", "Behaves like 200 shares" for stock, whose count is exact and carries no tag; absent when none could be read.
  readonly shares?: { readonly text: string; readonly estimate: boolean };
  // "4 days to expiration", "Expiration session"; and "Long 2 contracts", "Short 3 contracts". Absent for stock.
  readonly days?: string;
  readonly position?: string;
}

const WIDTH = 300;
const HEIGHT = 96;
const PAD = 10;

// Turning finished figures into coordinates is drawing (A256). An estimate is a dashed line with hollow points, unlike a Mark's.
function VolatilityChart({ points }: { readonly points: readonly VolatilityPoint[] }) {
  const values = points.flatMap((p) => (p.value === null ? [] : [p.value]));
  const low = Math.min(...values);
  const high = Math.max(...values);
  const x = (index: number) => (points.length === 1 ? WIDTH / 2 : PAD + (index * (WIDTH - 2 * PAD)) / (points.length - 1));
  const y = (value: number) => (high === low ? HEIGHT / 2 : HEIGHT - PAD - ((value - low) * (HEIGHT - 2 * PAD)) / (high - low));
  // A session with no figure is a gap: the line breaks there and is never drawn across it (AC-MARK-004).
  const runs: { x: number; y: number }[][] = [];
  points.forEach((p, index) => {
    if (p.value === null) {
      runs.push([]);
      return;
    }
    if (runs.length === 0) runs.push([]);
    runs[runs.length - 1]!.push({ x: x(index), y: y(p.value) });
  });
  return (
    <svg className="replay-chip-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
      {runs.map((run, i) => run.length > 1 && <polyline key={i} data-testid="iv-line" points={run.map((d) => `${d.x},${d.y}`).join(' ')} fill="none" strokeDasharray="4 3" />)}
      {runs.flat().map((d, i) => (
        <circle key={i} data-testid="iv-point" cx={d.x} cy={d.y} r={3} fill="none" />
      ))}
    </svg>
  );
}

export function Chips({ tag, volatility, shares, days, position }: ChipsProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const chartId = useId();
  // A click or tap outside closes it (a browser that does not focus a pressed button never blurs it).
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  // The first Escape closes the small chart and stops there; the overlay's own handler leaves a handled key alone.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !open) return;
    event.preventDefault();
    setOpen(false);
  };
  return (
    <div className="replay-chips" data-testid="chips" ref={rootRef} onKeyDown={onKeyDown}>
      {volatility && (
        <div className="replay-chip-item">
          <button type="button" className="replay-chip" aria-expanded={open} aria-controls={chartId} onClick={() => setOpen(true)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
            <Words text={volatility.text} />
            <span className="replay-chip-tag">{tag}</span>
          </button>
          {volatility.reason && <p className="replay-chip-reason">{volatility.reason}</p>}
          {open && (
            <div className="replay-chip-pop" id={chartId} role="group" aria-label={volatility.chartName}>
              <VolatilityChart points={volatility.points} />
              <ul className="visually-hidden">
                {volatility.points.map((p) => (
                  <li key={p.label}>
                    {p.label}: <Words text={p.text} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {shares && (
        <span className="replay-chip replay-chip-static" data-testid="shares-chip">
          {shares.text}
          {shares.estimate && <span className="replay-chip-tag">{tag}</span>}
        </span>
      )}
      {days && (
        <span className="replay-chip replay-chip-static" data-testid="days-chip">
          {days}
        </span>
      )}
      {position && (
        <span className="replay-chip replay-chip-static" data-testid="position-chip">
          {position}
        </span>
      )}
    </div>
  );
}
