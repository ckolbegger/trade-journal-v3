import { PnlChart } from './corridor-pnl.tsx';
import { timeAxis } from './geometry.ts';
import { PriceStrip } from './price-strip.tsx';
import type { ReplayPlotProps } from './replay.types.ts';

const WIDTH = 640;
const WIDTH_COMPACT = 340;

// One hit area per revealed session, over the column both charts share (they use the same time axis): a button named by
// the session's date label. Hover and focus report the session, leave and blur its end, a click or tap selects it.
function SessionHits({ props, width }: { props: ReplayPlotProps; width: number }) {
  const time = timeAxis(width, props.axis.slots);
  return (
    <div className="replay-hits" role="group" aria-label="Sessions">
      {props.sessions.map((s, i) => (
        <button
          key={s.slot}
          type="button"
          className="replay-hit"
          aria-label={s.dateLabel}
          data-hovered={props.hoverIndex === i ? 'true' : undefined}
          style={{ left: `${((time.x(s.slot) / width) * 100).toFixed(3)}%`, width: `${((time.column / width) * 100).toFixed(3)}%` }}
          onPointerEnter={() => props.onHoverSession?.(i)}
          onPointerLeave={() => props.onHoverSession?.(null)}
          onFocus={() => props.onHoverSession?.(i)}
          onBlur={() => props.onHoverSession?.(null)}
          onClick={() => props.onSelectSession?.(i)}
        />
      ))}
    </div>
  );
}

// A255: the one plot, taking ReplayPlotProps so a later Ribbon plot takes the same. The price strip for now.
export function CorridorPlot(props: ReplayPlotProps) {
  const width = props.compact ? WIDTH_COMPACT : WIDTH;
  return (
    <div className="replay-plot-frame">
      <div className="replay-plot" role="img" aria-label={props.accessibleName} aria-describedby={props.describedBy}>
        <PriceStrip props={props} width={width} />
        <PnlChart props={props} width={width} />
      </div>
      <SessionHits props={props} width={width} />
    </div>
  );
}
