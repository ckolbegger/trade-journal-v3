import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { PnlChart } from './corridor-pnl.tsx';
import { timeAxis } from './geometry.ts';
import { PriceStrip } from './price-strip.tsx';
import type { ReplayPlotProps } from './replay.types.ts';

const WIDTH = 640;
const WIDTH_COMPACT = 340;
// A box narrower than this is a phone's: scaled from 640 its text would fall under 8 px (the axis already switches its layout at 460).
const WIDTH_PHONE = 460;
// The narrowest drawing: in a box under it the 240-wide drawing is scaled down to fit (the svg is width: 100%), so nothing scrolls sideways.
const WIDTH_MIN = 240;

// One hit area per revealed session, over the column both charts share (they use the same time axis): a button named by
// the session's date label. Hover and focus report the session, leave and blur its end, a click or tap selects it.
function SessionHits({ props, width }: { props: ReplayPlotProps; width: number }) {
  const time = timeAxis(width, props.axis.slots);
  // Pointer and focus each hold a session; the pointer's wins while it is over one, then the focused one, else none.
  const held = useRef<{ pointer: number | null; focus: number | null }>({ pointer: null, focus: null });
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
          onPointerEnter={() => hold('pointer', i)}
          onPointerLeave={() => hold('pointer', null)}
          onFocus={() => hold('focus', i)}
          onBlur={() => hold('focus', null)}
          onClick={() => props.onSelectSession?.(i)}
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
    const watch = new ResizeObserver(read);
    watch.observe(el);
    return () => watch.disconnect();
  }, [box]);
  return measured;
}

// A255: the one plot, taking ReplayPlotProps so a later Ribbon plot takes the same. The price strip for now.
// On a phone's width both charts are drawn at the box's real width, so their text keeps its
// size instead of shrinking with a scaled-down drawing, and they use the phone words (W39 to W41).
export function CorridorPlot(props: ReplayPlotProps) {
  const box = useRef<HTMLDivElement>(null);
  const measured = useBoxWidth(box);
  const narrow = measured > 0 && measured < WIDTH_PHONE;
  const width = narrow ? Math.max(measured, WIDTH_MIN) : props.compact ? WIDTH_COMPACT : WIDTH;
  const plot = narrow || props.compact ? { ...props, compact: true } : props;
  return (
    <div className="replay-plot-frame" ref={box}>
      <div className="replay-plot" role="img" aria-label={props.accessibleName} aria-describedby={props.describedBy}>
        <PriceStrip props={plot} width={width} />
        <PnlChart props={plot} width={width} />
      </div>
      <SessionHits props={props} width={width} />
    </div>
  );
}
