import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { LongStockReplayModel } from '../../trade-analysis/replay';
import { buildCorridorGeometry } from './corridor-geometry';
import rpStyles from './Replay.module.css';

const NARROW_CHART_PX = 500;

const DOT_FILL_BY_TONE = {
  up: '#1d6b34',
  down: '#a3261b',
  flat: '#55524b',
} as const;

const REF_LINE_STYLE = {
  stop: { stroke: '#a3261b', width: '1.4', dash: '6 3', weight: '650', fill: '#a3261b' },
  target: { stroke: '#1d6b34', width: '1.4', dash: '2 3', weight: '650', fill: '#1d6b34' },
  plan: { stroke: '#1c1b19', width: '1', dash: '4 4', weight: '400', fill: '#55524b' },
} as const;

interface CorridorChartProps {
  readonly model: LongStockReplayModel;
  readonly selectedIndex: number;
  readonly onSelectIndex: (index: number) => void;
}

interface HoverTipState {
  readonly sessionIndex: number;
  readonly clientX: number;
  readonly clientY: number;
}

export function CorridorChart({ model, selectedIndex, onSelectIndex }: CorridorChartProps) {
  const uid = useId().replace(/:/g, '');
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [narrow, setNarrow] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < NARROW_CHART_PX : false,
  );
  const [hoverTip, setHoverTip] = useState<HoverTipState | null>(null);

  useLayoutEffect(() => {
    const updateWidth = () => {
      const clientW = wrapRef.current?.clientWidth ?? 0;
      const w =
        clientW > 0
          ? clientW
          : typeof window !== 'undefined'
            ? window.innerWidth
            : 720;
      setNarrow(w < NARROW_CHART_PX);
    };
    updateWidth();

    if (typeof ResizeObserver !== 'undefined' && wrapRef.current) {
      const observer = new ResizeObserver(() => updateWidth());
      observer.observe(wrapRef.current);
      return () => observer.disconnect();
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
    return undefined;
  }, []);

  const width = narrow ? 340 : 720;
  const geom = useMemo(
    () => buildCorridorGeometry(model, { width, narrow, selectedIndex }),
    [model, width, narrow, selectedIndex],
  );
  const selectedSession = model.sessions[selectedIndex] ?? model.sessions[model.sessions.length - 1]!;
  const hoveredSession =
    hoverTip !== null ? (model.sessions[hoverTip.sessionIndex] ?? null) : null;

  const upClipId = `up-${uid}`;
  const dnClipId = `dn-${uid}`;
  const bsClipId = `bs-${uid}`;
  const atClipId = `at-${uid}`;
  const patOverStopId = `p-over-s-${uid}`;
  const patOverTargetId = `p-over-t-${uid}`;

  return (
    <div ref={wrapRef} className={rpStyles.chartWrap}>
      <svg
        className={rpStyles.plot}
        viewBox={`0 0 ${geom.width} ${geom.height}`}
        role="img"
        aria-label={`${model.symbol} Corridor Replay chart up to ${selectedSession.sessionDateShort}`}
      >
        <defs>
          <pattern id={patOverStopId} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="#f2c6c0" />
            <path d="M0 0L6 6M6 0L0 6" stroke="#a3261b" strokeWidth="1.3" />
          </pattern>
          <pattern
            id={patOverTargetId}
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="7" height="7" fill="#c2e2c9" />
            <rect width="1.6" height="7" fill="#1d6b34" />
          </pattern>
          <clipPath id={upClipId}>
            <rect
              x="0"
              y={geom.pnlTop}
              width={geom.width}
              height={Math.max(0, geom.yZero - geom.pnlTop)}
            />
          </clipPath>
          <clipPath id={dnClipId}>
            <rect
              x="0"
              y={geom.yZero}
              width={geom.width}
              height={Math.max(0, geom.pnlBottom - geom.yZero)}
            />
          </clipPath>
          <clipPath id={bsClipId}>
            {geom.stopClipPolygons.map((pts, i) => (
              <polygon key={`sp-${i}`} points={pts} />
            ))}
          </clipPath>
          <clipPath id={atClipId}>
            {geom.targetClipPolygons.map((pts, i) => (
              <polygon key={`tp-${i}`} points={pts} />
            ))}
          </clipPath>
        </defs>

        {/* Explicit No Mark missing-session bands clipped strictly within Price and P&L panels */}
        {geom.missingBands.map((b) => (
          <g key={`gap-${b.sessionIndex}`}>
            <rect x={b.x} y={b.priceTop} width={b.width} height={b.priceHeight} fill="#f3efe6" />
            <rect x={b.x} y={b.top} width={b.width} height={b.height} fill="#f3efe6" />
            <text
              fontSize="10"
              fill="#55524b"
              transform={`translate(${b.textX.toFixed(1)} ${b.textY.toFixed(1)}) rotate(-90)`}
            >
              No Mark
            </text>
          </g>
        ))}

        {/* Panel headings (rendered after bands so missing-session fills never occlude subtitles) */}
        <text x={geom.left} y={13} fontSize="11.5" fontWeight="650" fill="#1c1b19">
          {model.symbol} price
          {!geom.narrow && (
            <tspan dx="8" fontSize="10.5" fontWeight="400" fill="#55524b">
              one Mark per session
            </tspan>
          )}
        </text>
        <text x={geom.left} y={geom.pnlTop - 8} fontSize="11.5" fontWeight="650" fill="#1c1b19">
          Trade P&amp;L
          {!geom.narrow && (
            <tspan dx="8" fontSize="10.5" fontWeight="400" fill="#55524b">
              dollars for the Position between Stop and Target rails
            </tspan>
          )}
        </text>

        {/* Price strip grid, axes, ref lines, Marks, and execution diamonds */}
        {geom.priceTicks.map((t, idx) => (
          <g key={`pt-${idx}`}>
            <path d={`M${geom.left} ${t.y.toFixed(1)}H${geom.plotRight}`} stroke="#ebe6da" />
            <text
              x={geom.left - 5}
              y={(t.y + 3.5).toFixed(1)}
              textAnchor="end"
              fontSize="10.5"
              fill="#55524b"
            >
              {t.label}
            </text>
          </g>
        ))}
        <path
          d={`M${geom.left} ${geom.priceTop}V${geom.priceBottom}`}
          stroke="#8f8a7e"
          fill="none"
        />
        {geom.priceRefLines.map((line) => {
          const st = REF_LINE_STYLE[line.kind];
          return (
            <g key={line.kind}>
              <path
                d={`M${geom.left} ${line.y.toFixed(1)}H${geom.plotRight}`}
                stroke={st.stroke}
                strokeWidth={st.width}
                strokeDasharray={st.dash}
                fill="none"
              />
              <text
                x={geom.plotRight + 6}
                y={(line.y + 3.5).toFixed(1)}
                fontSize="10.5"
                fontWeight={st.weight}
                fill={st.fill}
              >
                {line.label}
              </text>
            </g>
          );
        })}
        {geom.priceRuns.map((run, idx) => (
          <path
            key={`pr-${idx}`}
            d={run.path}
            fill="none"
            stroke="#8f8a7e"
            strokeWidth="1.4"
          />
        ))}
        {geom.priceDots.map((dot) => (
          <circle
            key={`pd-${dot.sessionIndex}`}
            cx={dot.cx.toFixed(1)}
            cy={dot.cy.toFixed(1)}
            r={dot.r}
            fill="#1c1b19"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        ))}
        {geom.execDiamonds.map((dia, idx) => (
          <path
            key={`dia-${idx}`}
            d={dia.d}
            fill="#ffffff"
            stroke="#1c1b19"
            strokeWidth="2"
          />
        ))}
        {geom.selectedPriceLabel && (
          <text
            x={geom.selectedPriceLabel.x.toFixed(1)}
            y={geom.selectedPriceLabel.y.toFixed(1)}
            textAnchor={geom.selectedPriceLabel.anchor}
            fontSize="11.5"
            fontWeight="700"
            fill="#1c1b19"
            paintOrder="stroke"
            stroke="#ffffff"
            strokeWidth="3"
          >
            {geom.selectedPriceLabel.text}
          </text>
        )}

        {/* X-axis session numbers between panels */}
        {geom.xAxisLabels.map((lbl, idx) => (
          <text
            key={`xl-${idx}`}
            x={lbl.x.toFixed(1)}
            y={(geom.priceBottom + 14).toFixed(1)}
            textAnchor="middle"
            fontSize="10.5"
            fontWeight={lbl.selected ? '700' : '400'}
            fill={lbl.selected ? '#1c1b19' : '#55524b'}
          >
            {lbl.label}
          </text>
        ))}

        {/* Trade P&L Corridor grid, zero axis, area runs, banked layer, overrun hatch, step rails */}
        {geom.pnlTicks.map((t, idx) => (
          <g key={`pnt-${idx}`}>
            <path d={`M${geom.left} ${t.y.toFixed(1)}H${geom.plotRight}`} stroke="#ebe6da" />
            <text
              x={geom.left - 5}
              y={(t.y + 3.5).toFixed(1)}
              textAnchor="end"
              fontSize="10.5"
              fill="#55524b"
            >
              {t.label}
            </text>
          </g>
        ))}
        <path
          d={`M${geom.left} ${geom.pnlTop}V${geom.pnlBottom}`}
          stroke="#8f8a7e"
          fill="none"
        />
        <path
          d={`M${geom.left} ${geom.yZero.toFixed(1)}H${geom.plotRight}`}
          stroke="#8f8a7e"
          strokeWidth="1.2"
        />

        {/* P&L open + banked + overrun clipped regions */}
        {geom.pnlRuns.map((run, idx) => (
          <g key={`pnlrun-${idx}`}>
            <g clipPath={`url(#${upClipId})`}>
              <path d={run.areaPath} fill="#c2e2c9" />
              <path
                d={run.areaPath}
                fill={`url(#${patOverTargetId})`}
                clipPath={`url(#${atClipId})`}
              />
              <path
                d={run.linePath}
                fill="none"
                stroke="#1d6b34"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </g>
            <g clipPath={`url(#${dnClipId})`}>
              <path d={run.areaPath} fill="#f2c6c0" />
              <path
                d={run.areaPath}
                fill={`url(#${patOverStopId})`}
                clipPath={`url(#${bsClipId})`}
              />
              <path
                d={run.linePath}
                fill="none"
                stroke="#a3261b"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </g>
            {run.bankedRuns.map((bk, bIdx) => (
              <path
                key={`bk-${bIdx}`}
                d={bk.areaPath}
                fill={bk.sign === 'up' ? '#1d6b34' : '#a3261b'}
              />
            ))}
          </g>
        ))}

        {/* Realized P&L dotted step level */}
        {geom.realizedStepPath && (
          <path
            d={geom.realizedStepPath}
            fill="none"
            stroke="#1c1b19"
            strokeWidth="1.3"
            strokeDasharray="2 2"
          />
        )}

        {/* Stop & Target step rails */}
        <path
          d={geom.stopRailPath}
          fill="none"
          stroke="#a3261b"
          strokeWidth="1.5"
          strokeDasharray="6 3"
        />
        <path
          d={geom.targetRailPath}
          fill="none"
          stroke="#1d6b34"
          strokeWidth="1.5"
          strokeDasharray="2 3"
        />
        {geom.stopRailEndLabel && (
          <text
            x={geom.plotRight + 6}
            y={geom.stopRailEndY.toFixed(1)}
            fontSize="10.5"
            fontWeight="650"
            fill="#a3261b"
          >
            {geom.stopRailEndLabel}
          </text>
        )}
        {geom.targetRailEndLabel && (
          <text
            x={geom.plotRight + 6}
            y={geom.targetRailEndY.toFixed(1)}
            fontSize="10.5"
            fontWeight="650"
            fill="#1d6b34"
          >
            {geom.targetRailEndLabel}
          </text>
        )}

        {/* P&L dots */}
        {geom.pnlDots.map((dot) => (
          <circle
            key={`pnd-${dot.sessionIndex}`}
            cx={dot.cx.toFixed(1)}
            cy={dot.cy.toFixed(1)}
            r={dot.r}
            fill={DOT_FILL_BY_TONE[dot.tone]}
            stroke="#ffffff"
            strokeWidth="1.2"
          />
        ))}

        {/* Execution triangles & labels */}
        {geom.execMarkers.map((em) => (
          <g key={`em-${em.sessionIndex}`}>
            <path d={em.triangleD} fill="#1c1b19" />
            <text
              x={em.x.toFixed(1)}
              y={em.labelY.toFixed(1)}
              textAnchor={em.anchor}
              fontSize="10"
              fontWeight="650"
              fill="#1c1b19"
            >
              {em.text}
            </text>
          </g>
        ))}

        {/* Daily Review Action row */}
        <text
          x={geom.left - 5}
          y={geom.actionLabels[0]?.y.toFixed(1) ?? (geom.pnlBottom + 46).toFixed(1)}
          textAnchor="end"
          fontSize="10"
          fill="#55524b"
        >
          Action
        </text>
        {geom.actionLabels.map((al) =>
          al.code ? (
            <text
              key={`al-${al.sessionIndex}`}
              x={al.x.toFixed(1)}
              y={al.y.toFixed(1)}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight={al.selected ? '800' : '600'}
              fill={al.highlighted ? '#1f5fbf' : '#55524b'}
            >
              {al.code}
            </text>
          ) : null,
        )}

        {/* Selected session vertical cursor across both strips */}
        <path
          d={`M${geom.cursorX.toFixed(1)} ${geom.priceTop}V${geom.priceBottom}M${geom.cursorX.toFixed(1)} ${geom.pnlTop}V${geom.pnlBottom}`}
          stroke="#1f5fbf"
          strokeWidth="1.5"
          fill="none"
        />

        {/* Interactive session hit targets */}
        {geom.hitTargets.map((ht) => (
          <rect
            key={`ht-${ht.sessionIndex}`}
            data-testid={`corridor-hit-${ht.sessionIndex}`}
            x={ht.x.toFixed(1)}
            y={ht.y}
            width={ht.width.toFixed(1)}
            height={ht.height}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectIndex(ht.sessionIndex)}
            onMouseMove={(e) =>
              setHoverTip({ sessionIndex: ht.sessionIndex, clientX: e.clientX, clientY: e.clientY })
            }
            onMouseLeave={() => setHoverTip(null)}
          />
        ))}
      </svg>

      {hoverTip && hoveredSession && (
        <div
          className={rpStyles.tooltip}
          aria-hidden="true"
          data-testid="corridor-tooltip"
          style={{
            left: Math.max(
              8,
              Math.min(
                hoverTip.clientX + 14,
                (typeof window !== 'undefined' ? window.innerWidth : 900) - 300,
              ),
            ),
            top: Math.max(8, hoverTip.clientY - 40),
          }}
        >
          <div>
            <strong>{hoveredSession.sessionDateShort}</strong>
          </div>
          <div>
            {model.symbol}: {hoveredSession.markDisplay ?? (hoveredSession.inProgress ? 'Market open' : 'No Mark')}
          </div>
          <div>
            Trade P&amp;L:{' '}
            {hoveredSession.totalPnlDisplay
              ? `${hoveredSession.totalPnlDisplay}${hoveredSession.totalPnlRDisplay ? ` (${hoveredSession.totalPnlRDisplay})` : ''}`
              : 'Unavailable'}
          </div>
          <div>
            Realized {hoveredSession.realizedPnlDisplay} · Open{' '}
            {hoveredSession.openPnlDisplay ?? 'n/a'}
          </div>
          {hoveredSession.executionsToday.length > 0 && (
            <div className={rpStyles.tooltipMuted}>
              {hoveredSession.executionsToday
                .map((ex) => `${ex.side} ${ex.quantityDisplay} @ ${ex.fillPriceDisplay}`)
                .join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
