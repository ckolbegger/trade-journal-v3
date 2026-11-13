import type { PnlCardProps } from './pnl.types.ts';

// The rail's P&L card (W3, W4): the Trade P&L figure, its change line, how much of the Trade is open, and a Closed Trade's Result rows.
export function PnlCardView({ name, figure, tone, line, lineTone, openLine, result }: PnlCardProps) {
  return (
    <section className="card pnl-card" aria-label={name}>
      <p className="pnl-figure number" data-tone={tone}>
        {figure}
      </p>
      {line && (
        <p className="pnl-line number" data-tone={lineTone}>
          {line}
        </p>
      )}
      {openLine && <p className="pnl-open">{openLine}</p>}
      {result && (
        <dl className="pnl-result">
          {result.map(({ label, value }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
