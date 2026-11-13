import type { PriceTrackProps } from './track.types.ts';

// Each marker's label has a lane of its own, so labels never overlap when two markers sit at one price (styles/today.css).
const LANES = { now: 'above', entry: 'higher', earlier: 'below' } as const;

// A price track (A215): a horizontal bar with its Stop and Target zones and its markers, placed by percentage. The markers carry no prices; the
// accessible name and the comparison table do.
export function PriceTrack({ title, accessibleName, min, max, zones, markers, conditionLines }: PriceTrackProps) {
  const pct = (price: number) => Number((((price - min) / (max - min)) * 100).toFixed(2));
  return (
    <div className="track-block">
      <h3>{title}</h3>
      <div className="track" role="img" aria-label={accessibleName}>
        {zones.map((zone, index) => (
          <span key={index} className={`zone z-${zone.role.toLowerCase()}`} data-role={zone.role} style={{ left: `${pct(zone.from)}%`, width: `${Number((pct(zone.to) - pct(zone.from)).toFixed(2))}%` }} />
        ))}
        {markers.map((marker) => (
          <span key={marker.kind} className={`mk ${marker.kind}`} data-kind={marker.kind} style={{ left: `${pct(marker.price)}%` }}>
            <span className="dot" />
            <span className="lab" data-lane={LANES[marker.kind]}>
              {marker.label}
            </span>
          </span>
        ))}
      </div>
      {conditionLines.length > 0 && (
        <ul className="conds" aria-label="Conditions">
          {conditionLines.map((line) => (
            <li key={line.label}>
              <span className="what">{line.label}</span>
              <dl className="figure-grid">
                {line.figures.map((figure) => (
                  <div key={figure.term}>
                    <dt>{figure.term}</dt>
                    <dd className="number">{figure.value}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
