import type { LongStockReplayModel } from '../../trade-analysis/replay';
import { buildSparklineGeometry } from './corridor-geometry';

interface ReplaySparklineProps {
  readonly model: LongStockReplayModel;
  readonly width?: number;
  readonly height?: number;
}

const DOT_COLOR_BY_TONE = {
  up: '#1d6b34',
  down: '#a3261b',
  flat: '#55524b',
} as const;

export function ReplaySparkline({ model, width = 200, height = 48 }: ReplaySparklineProps) {
  const geom = buildSparklineGeometry(model, width, height);

  return (
    <svg
      width={geom.width}
      height={geom.height}
      viewBox={`0 0 ${geom.width} ${geom.height}`}
      aria-hidden="true"
    >
      <line
        x1={0}
        x2={geom.width}
        y1={geom.yZero.toFixed(1)}
        y2={geom.yZero.toFixed(1)}
        stroke="#d9d3c5"
      />
      <path
        d={geom.stopRailPath}
        fill="none"
        stroke="#a3261b"
        strokeWidth="1.3"
        strokeDasharray="4 3"
      />
      <path
        d={geom.targetRailPath}
        fill="none"
        stroke="#1d6b34"
        strokeWidth="1.3"
        strokeDasharray="4 3"
      />
      {geom.pnlLinePaths.map((d, idx) => (
        <path
          key={idx}
          d={d}
          fill="none"
          stroke="#1c1b19"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      ))}
      {geom.lastDot && (
        <circle
          cx={geom.lastDot.cx.toFixed(1)}
          cy={geom.lastDot.cy.toFixed(1)}
          r="3.5"
          fill={DOT_COLOR_BY_TONE[geom.lastDot.tone]}
        />
      )}
    </svg>
  );
}
