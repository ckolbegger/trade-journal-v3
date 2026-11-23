import { useId } from 'react';
import { toDecimalString, type Rational } from '../../shared/exact-number';
import type { AvailableLongStockEvaluation } from '../../trade-analysis/evaluate';

interface GaugeMeterProps {
  readonly symbol: string;
  readonly evaluation: AvailableLongStockEvaluation | null;
  readonly big: boolean;
  readonly hasLotMatches?: boolean;
}

function toFloat(r: Rational): number {
  return Number(toDecimalString(r, 4));
}

function formatSignedMoney(val: number): string {
  const abs = Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (val < -0.004) return `-$${abs}`;
  if (val > 0.004) return `+$${abs}`;
  return `$${abs}`;
}

export function GaugeMeter({ symbol, evaluation, big, hasLotMatches = false }: GaugeMeterProps) {
  const patternId = useId().replace(/:/g, '');

  if (!evaluation) {
    return (
      <span style={{ color: 'var(--muted)', fontSize: '0.84rem', whiteSpace: 'nowrap' }}>
        no Mark yet
      </span>
    );
  }

  const re = toFloat(evaluation.realizedPnl);
  const now = toFloat(evaluation.combinedPnl);
  const stopImpact = toFloat(evaluation.stopCondition.impactDollars);
  const targetImpact = toFloat(evaluation.targetCondition.impactDollars);
  const atStop = now + stopImpact;
  const atTarget = now + targetImpact;
  const prior =
    evaluation.dailyChange !== null ? now - toFloat(evaluation.dailyChange) : null;

  const vals = [now, atStop, atTarget, 0, re, ...(prior !== null ? [prior] : [])];
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const pad = (hi - lo) * 0.08 || 1;
  lo -= pad;
  hi += pad;

  const W = big ? 480 : 130;
  const H = big ? 60 : 20;
  const top = big ? 20 : 4;
  const bh = big ? 14 : 11;
  const x = (v: number) => ((v - lo) / (hi - lo)) * W;

  const stopBreached = evaluation.stopCondition.status === 'Breached';
  const targetReached = evaluation.targetCondition.status === 'Reached';
  const hatchBg = stopBreached ? '#f2c6c0' : '#c2e2c9';
  const hatchFg = stopBreached ? '#a3261b' : '#1d6b34';

  const hasRealized = hasLotMatches || Math.abs(re) > 0.004;
  const sentence = `${symbol} P&L ${hasRealized ? evaluation.combinedPnlDisplay : evaluation.openPnlDisplay}${
    hasRealized ? ` (${evaluation.realizedPnlDisplay} realized, ${evaluation.openPnlDisplay} open)` : ''
  }${
    stopBreached
      ? `, past Stop (${formatSignedMoney(atStop)})`
      : targetReached
        ? `, at Target (${formatSignedMoney(atTarget)})`
        : `, between Stop (${formatSignedMoney(atStop)}) and Target (${formatSignedMoney(atTarget)})`
  }.`;

  const renderBar = (a: number, b: number, fill: string) => {
    const xa = x(a);
    const xb = x(b);
    return (
      <rect
        x={Math.min(xa, xb).toFixed(1)}
        y={top}
        width={Math.max(Math.abs(xb - xa), 0).toFixed(1)}
        height={bh}
        fill={fill}
      />
    );
  };

  const renderTick = (v: number, color: string, w: number, extend: number) => (
    <rect
      x={(x(v) - w / 2).toFixed(1)}
      y={top - extend}
      width={w}
      height={bh + 2 * extend}
      fill={color}
    />
  );

  const renderLabel = (v: number, text: string, color: string) => {
    const xx = x(v);
    const anchor = xx < 110 ? 'start' : xx > W - 110 ? 'end' : 'middle';
    return (
      <text
        x={xx.toFixed(1)}
        y={12}
        fontSize="11"
        fontWeight="650"
        fill={color}
        textAnchor={anchor}
      >
        {text}
      </text>
    );
  };

  const renderArrow = (to: number, color: string, y: number) => {
    const a = x(now);
    const b = x(to);
    if (Math.abs(b - a) < 5) return null;
    const dir = b > a ? 1 : -1;
    return (
      <g>
        <path
          d={`M${a.toFixed(1)} ${y}H${(b - dir * 5).toFixed(1)}`}
          stroke={color}
          strokeWidth="2"
          fill="none"
        />
        <path d={`M${b.toFixed(1)} ${y}l${-dir * 7} -4v8z`} fill={color} />
        <circle cx={a.toFixed(1)} cy={y} r="2.5" fill={color} />
      </g>
    );
  };

  const sameSide = Math.sign(atStop - now) === Math.sign(atTarget - now);
  const stopFirst = Math.abs(atStop - now) <= Math.abs(atTarget - now);

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={sentence}
      style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
    >
      <title>{sentence}</title>
      <defs>
        <pattern
          id={patternId}
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="5" height="5" fill={hatchBg} />
          <rect width="2" height="5" fill={hatchFg} />
        </pattern>
      </defs>

      {/* Neutral baseline track */}
      <rect x="0" y={top + bh / 2 - 1.5} width={W} height="3" fill="#ece7da" />

      {/* Solid realized layer from 0 to realized P&L */}
      {hasRealized && renderBar(0, re, re > 0 ? '#1d6b34' : '#a3261b')}

      {/* Open P&L layer from realized P&L to combined P&L (with hatched overrun past Stop/Target) */}
      {now < atStop - 0.004 ? (
        <>
          {re > atStop && renderBar(re, atStop, '#f2c6c0')}
          {renderBar(Math.min(re, atStop), now, `url(#${patternId})`)}
        </>
      ) : now > atTarget + 0.004 ? (
        <>
          {re < atTarget && renderBar(re, atTarget, '#c2e2c9')}
          {renderBar(Math.max(re, atTarget), now, `url(#${patternId})`)}
        </>
      ) : (
        renderBar(re, now, now < re ? '#f2c6c0' : '#c2e2c9')
      )}

      {/* Zero, Stop, Target ticks */}
      {renderTick(0, '#1c1b19', 1.5, 2)}
      {renderTick(atStop, '#a3261b', 3, 3)}
      {renderTick(atTarget, '#1d6b34', 3, 3)}

      {/* Prior session dot */}
      {prior !== null && (
        <circle
          cx={x(prior).toFixed(1)}
          cy={top + bh / 2}
          r={big ? 4 : 3}
          fill="#fff"
          stroke="#55524b"
          strokeWidth="1.5"
        />
      )}

      {/* Current mark hollow box */}
      <rect
        x={(x(now) - (big ? 5 : 4)).toFixed(1)}
        y={top - 2}
        width={big ? 10 : 8}
        height={bh + 4}
        rx="2"
        fill="none"
        stroke="#1c1b19"
        strokeWidth="2.5"
      />

      {/* Big gauge labels & directional arrows */}
      {big && (
        <>
          {renderLabel(atStop, `Stop ${formatSignedMoney(atStop)}`, '#a3261b')}
          {renderLabel(atTarget, `Target ${formatSignedMoney(atTarget)}`, '#1d6b34')}
          {renderArrow(atStop, '#a3261b', sameSide ? (stopFirst ? 44 : 53) : 48)}
          {renderArrow(atTarget, '#1d6b34', sameSide ? (stopFirst ? 53 : 44) : 48)}
        </>
      )}
    </svg>
  );
}
