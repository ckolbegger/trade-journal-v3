import { useId, type Ref } from 'react';
import type { ReplayStripFigures, TradeReplayView } from '../../app/types.ts';
import { pastLine, stripChart, stripWords } from './replay-strip.props.ts';

export interface ReplayStripProps {
  readonly replay: TradeReplayView;
  readonly strip?: ReplayStripFigures;
  // A Trade that has ended: its words give the sessions and the low, to be walked before the Close Review is written.
  readonly closed?: boolean;
  // An Exit chosen on an earlier Review Date is not carried out (the card says it first elsewhere).
  readonly exitNotCarriedOut?: boolean;
  readonly onOpen: () => void;
  readonly buttonRef?: Ref<HTMLButtonElement>;
}

// The Replay strip on a card (W146): a small chart of the Trade P&L with the Stop and Target lines, one line of words, and the Replay button.
export function ReplayStrip({ replay, strip, closed = false, exitNotCarriedOut = false, onOpen, buttonRef }: ReplayStripProps) {
  const words = useId();
  const chart = stripChart(replay);
  const strong = pastLine(strip) || exitNotCarriedOut;
  return (
    <section aria-label="Replay strip" className={`replay-strip${strong ? ' replay-strip-strong' : ''}`}>
      <svg role="img" aria-label="Trade P&L by session" className="replay-strip-chart" viewBox={`0 0 ${chart.width} ${chart.height}`}>
        <line className="replay-strip-zero" x1={chart.left} x2={chart.right} y1={chart.zeroY} y2={chart.zeroY} />
        {chart.targetY !== undefined && <line className="replay-strip-target" x1={chart.left} x2={chart.right} y1={chart.targetY} y2={chart.targetY} />}
        {chart.stopY !== undefined && <line className="replay-strip-stop" x1={chart.left} x2={chart.right} y1={chart.stopY} y2={chart.stopY} />}
        <path className="replay-strip-pnl" d={chart.path} fill="none" />
        {chart.dots.map((dot) => (
          <circle key={dot.x} className="replay-strip-dot" cx={dot.x} cy={dot.y} r={2.5} />
        ))}
      </svg>
      <p id={words}>{strip && stripWords(strip, closed)}</p>
      <button ref={buttonRef} type="button" className="pill secondary review-card-replay" aria-describedby={words} onClick={onOpen}>
        Replay
      </button>
    </section>
  );
}
