import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { drawPnl } from './corridor-pnl.tsx';
import { timeAxis } from './geometry.ts';
import { drawStrip } from './price-strip.tsx';
import type { PlotKeyEntry, PlotSession, ReplayPlotProps } from './replay.types.ts';

const WIDTH = 640;
const WIDTH_COMPACT = 340;
// A box narrower than this is a phone's: scaled from 640 its text would fall under 8 px (the axis already switches its layout at 460).
const WIDTH_PHONE = 460;
// The narrowest drawing: in a box under it the 200-wide drawing is scaled down to fit (the svg is width: 100%), so nothing scrolls sideways.
// The Review card's box at 320 px is about 215 to 226 wide: drawn at 240 its text shrank under 10 px.
const WIDTH_MIN = 200;

// One hit area per revealed session, over the column both charts share (they use the same time axis): a button named by
// the session's date label. Hover and focus report the session, leave and blur its end, a click or tap selects it.
function SessionHits({ props, width }: { props: ReplayPlotProps; width: number }) {
  const time = timeAxis(width, props.axis.slots);
  // Pointer and focus each hold a session; the pointer's wins while it is over one, then the focused one, else none.
  const held = useRef<{ pointer: number | null; focus: number | null }>({ pointer: null, focus: null });
  const tapped = useRef(false);
  const hold = (source: 'pointer' | 'focus', i: number | null) => {
    held.current[source] = i;
    props.onHoverSession?.(held.current.pointer ?? held.current.focus);
  };
  return (
    <div className="replay-hits" role="group" aria-label="Sessions">
      {props.sessions.map((s, i) => (
        <button
          key={s.slot}
          type="button"
          className="replay-hit"
          aria-label={s.dateLabel}
          data-hovered={props.hoverIndex === i ? 'true' : undefined}
          style={{ left: `${(((time.x(s.slot) - time.column / 2) / width) * 100).toFixed(3)}%`, width: `${((time.column / width) * 100).toFixed(3)}%` }}
          // A touch or pen contact is a tap (it selects), not a hover: only a mouse hovers.
          // After a tap that opens the chart under the finger the browser sends the hit under it a mouse pointerenter with no mouse
          // behind it, and no pointermove: a mouse hovers from its first real move, never from the enter alone.
          onPointerEnter={(e) => e.pointerType !== 'touch' && e.pointerType !== 'pen' && e.pointerType !== 'mouse' && hold('pointer', i)}
          onPointerMove={(e) => e.pointerType === 'mouse' && held.current.pointer !== i && hold('pointer', i)}
          onPointerLeave={(e) => e.pointerType !== 'touch' && e.pointerType !== 'pen' && hold('pointer', null)}
          // A tap leaves no hover box, whatever set one before it.
          onPointerDown={(e) => {
            tapped.current = e.pointerType === 'touch' || e.pointerType === 'pen';
            if (tapped.current && held.current.pointer !== null) hold('pointer', null);
          }}
          // A touch's focus comes after its pointerup but before its click: a tap that gave none (the button was focused already,
          // cleared by the click) or became a scroll (pointercancel) must not mark the next keyboard focus as a tap's.
          onPointerCancel={() => {
            tapped.current = false;
          }}
          onKeyDown={() => {
            tapped.current = false;
          }}
          // The focus a tap gives the button is not keyboard focus: it shows no hover box.
          onFocus={() => {
            const viaTap = tapped.current;
            tapped.current = false;
            if (!viaTap) hold('focus', i);
          }}
          onBlur={() => hold('focus', null)}
          onClick={() => {
            tapped.current = false;
            props.onSelectSession?.(i);
          }}
        />
      ))}
    </div>
  );
}

// The box's own width, followed through a resize; 0 until it has a layout.
function useBoxWidth(box: RefObject<HTMLDivElement | null>): number {
  const [measured, setMeasured] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => setMeasured(el.clientWidth);
    read();
    if (typeof ResizeObserver === 'undefined') return;
    // The observer reports between layout and paint: drawn at once (flushSync), the resized frame is never painted at the old width.
    const watch = new ResizeObserver(() => flushSync(read));
    watch.observe(el);
    return () => watch.disconnect();
  }, [box]);
  return measured;
}

// A box with a layout is drawn at its own width at every size (not below WIDTH_MIN), so the text keeps its size (A275);
// before it has one, the compact flag picks a width.
function drawingWidth(measured: number, compact: boolean | undefined): number {
  if (measured > 0) return Math.max(measured, WIDTH_MIN);
  return compact ? WIDTH_COMPACT : WIDTH;
}

// A280: every kind of thing the revealed sessions drew, once each, in the order they first appeared. A Worst case, a Max reward
// and a Strike are named only when their line is on the page, and a first crossing only when its flag is.
const LINE_KINDS: ReadonlySet<PlotKeyEntry['kind']> = new Set(['WorstCase', 'MaxReward', 'Strike', 'FirstCrossing']);
function keyOf(sessions: readonly PlotSession[], drawn: ReadonlySet<PlotKeyEntry['kind']>, crossingLabels: ReadonlySet<string> = new Set()): PlotKeyEntry[] {
  const seen = new Set<string>();
  const listed = sessions
    .flatMap((s) => s.keyEntries ?? [])
    .filter((e) => (!LINE_KINDS.has(e.kind) || drawn.has(e.kind)) && (e.kind !== 'FirstCrossing' || crossingLabels.has(e.label)) && !seen.has(`${e.kind}|${e.label}`) && seen.add(`${e.kind}|${e.label}`));
  return [...listed, ...DRAWN_AREAS.filter((e) => drawn.has(e.kind))];
}

// W66's "Past the Stop", "Past the Target" and "At stake": the plot names them from what it drew (a hatch, the bar at the cursor), so each is
// in the key exactly while it is on the page.
const DRAWN_AREAS: readonly PlotKeyEntry[] = [
  { kind: 'PastStop', label: 'Past the Stop' },
  { kind: 'PastTarget', label: 'Past the Target' },
  { kind: 'Stake', label: 'At stake' },
];

// The swatch of what an area or a band is drawn in: the Target's colour for a gain, the Stop's for a loss.
function swatchOf(e: PlotKeyEntry): string | undefined {
  const loss = e.label === 'Open loss' || e.label === 'Realized loss';
  if (e.kind === 'TradePnl') return loss ? 'area-loss' : 'area-profit';
  if (e.kind === 'Banked') return loss ? 'banked-loss' : 'banked-gain';
  if (e.kind === 'NoMark') return 'no-mark';
  return undefined;
}

function Key({ entries }: { entries: readonly PlotKeyEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <ul className="replay-key">
      {entries.map((e) => (
        <li key={`${e.kind}|${e.label}`} className={`key-${e.kind}`} data-swatch={swatchOf(e)}>
          {e.label}
        </li>
      ))}
    </ul>
  );
}

// A255: the one plot, taking ReplayPlotProps so a later Ribbon plot takes the same. The price strip for now.
// On a phone's width both charts are drawn at the box's real width, so their text keeps its
// size instead of shrinking with a scaled-down drawing, and they use the phone words (W39 to W41).
export function CorridorPlot(props: ReplayPlotProps) {
  const box = useRef<HTMLDivElement>(null);
  const measured = useBoxWidth(box);
  const narrow = measured > 0 && measured < WIDTH_PHONE;
  const width = drawingWidth(measured, props.compact);
  const plot = narrow || props.compact ? { ...props, compact: true } : props;
  const strip = drawStrip(plot, width);
  const pnl = drawPnl(plot, width);
  return (
    <div className="replay-corridor">
      <div className="replay-plot-frame" ref={box}>
        <div className="replay-plot" role="img" aria-label={props.accessibleName} aria-describedby={props.describedBy}>
          {strip.svg}
          {pnl.svg}
        </div>
        <SessionHits props={props} width={width} />
      </div>
      {pnl.strip && pnl.strip.length > 0 && <p className="replay-strip-labels">{pnl.strip.join(' · ')}</p>}
      <Key entries={keyOf(props.sessions, new Set([...strip.drawn, ...pnl.drawn]), pnl.crossingLabels)} />
    </div>
  );
}
