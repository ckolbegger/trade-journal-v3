import { toDecimalString, type Rational } from '../../shared/exact-number';
import cockpitStyles from './Cockpit.module.css';

interface PriceTrackProps {
  readonly symbol: string;
  readonly stopPrice: Rational;
  readonly targetPrice: Rational;
  readonly entryPrice: Rational;
  readonly currentMark: Rational;
  readonly priorMark: Rational | null;
  readonly priorLabel: string | null;
}

function toNum(r: Rational): number {
  return Number(toDecimalString(r, 4));
}

function clampPct(val: number): number {
  return Math.max(0, Math.min(100, val));
}

export function PriceTrack({
  symbol,
  stopPrice,
  targetPrice,
  entryPrice,
  currentMark,
  priorMark,
  priorLabel,
}: PriceTrackProps) {
  const stop = toNum(stopPrice);
  const target = toNum(targetPrice);
  const entry = toNum(entryPrice);
  const now = toNum(currentMark);
  const prev = priorMark ? toNum(priorMark) : null;

  const all = [stop, target, entry, now, ...(prev !== null ? [prev] : [])];
  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  const span = Math.max(rawMax - rawMin, rawMax * 0.01, 0.0001);
  const min = rawMin - span * 0.14;
  const max = rawMax + span * 0.14;
  const pct = (v: number) => clampPct(((v - min) / (max - min)) * 100);

  const stopPct = pct(stop);
  const targetPct = pct(target);
  const entryPct = pct(entry);
  const nowPct = pct(now);
  const prevPct = prev !== null ? pct(prev) : null;
  const entryBelow = Math.abs(nowPct - entryPct) < 12;

  return (
    <div className={cockpitStyles.trackBlock} aria-label={`${symbol} Stop and Target price track`}>
      <h4 className={cockpitStyles.trackTitle}>{symbol}</h4>
      <div className={cockpitStyles.track}>
        <span className={`${cockpitStyles.zone} ${cockpitStyles.zoneStop}`} style={{ width: `${stopPct}%` }} />
        <span
          className={`${cockpitStyles.zone} ${cockpitStyles.zoneTarget}`}
          style={{ width: `${100 - targetPct}%` }}
        />
        <span className={`${cockpitStyles.edge} ${cockpitStyles.edgeStop}`} style={{ left: `${stopPct}%` }} />
        <span
          className={`${cockpitStyles.edge} ${cockpitStyles.edgeTarget}`}
          style={{ left: `${targetPct}%` }}
        />

        <span className={`${cockpitStyles.mk} ${cockpitStyles.mkEntry}`} style={{ left: `${entryPct}%` }}>
          <span className={cockpitStyles.mkDot} />
          <span
            className={cockpitStyles.mkLab}
            style={entryBelow ? { bottom: 'auto', top: '14px' } : undefined}
          >
            Avg ${entry.toFixed(2)}
          </span>
        </span>

        {prevPct !== null && prev !== null && (
          <span className={`${cockpitStyles.mk} ${cockpitStyles.mkPrev}`} style={{ left: `${prevPct}%` }}>
            <span className={cockpitStyles.mkDot} />
            <span className={cockpitStyles.mkLab}>
              {priorLabel ?? 'Prior'} ${prev.toFixed(2)}
            </span>
          </span>
        )}

        <span className={`${cockpitStyles.mk} ${cockpitStyles.mkNow}`} style={{ left: `${nowPct}%` }}>
          <span className={cockpitStyles.mkDot} />
          <span className={cockpitStyles.mkLab}>Now ${now.toFixed(2)}</span>
        </span>
      </div>
      <div className={cockpitStyles.trackEnds}>
        <span>Stop ${stop.toFixed(2)}</span>
        <span>Target ${target.toFixed(2)}</span>
      </div>
    </div>
  );
}
