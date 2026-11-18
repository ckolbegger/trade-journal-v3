import { PnlChart } from './corridor-pnl.tsx';
import { PriceStrip } from './price-strip.tsx';
import type { ReplayPlotProps } from './replay.types.ts';

const WIDTH = 640;
const WIDTH_COMPACT = 340;

// A255: the one plot, taking ReplayPlotProps so a later Ribbon plot takes the same. The price strip for now.
export function CorridorPlot(props: ReplayPlotProps) {
  return (
    <div className="replay-plot" role="img" aria-label={props.accessibleName} aria-describedby={props.describedBy}>
      <PriceStrip props={props} width={props.compact ? WIDTH_COMPACT : WIDTH} />
      <PnlChart props={props} width={props.compact ? WIDTH_COMPACT : WIDTH} />
    </div>
  );
}
