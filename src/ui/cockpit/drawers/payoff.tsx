import { useId } from 'react';
import type { ShellProps } from '../placeholder.ts';
import { payoffDrawerProps } from './payoff.props.ts';
import type { PayoffDrawerProps, PayoffLineProps } from './payoff.types.ts';

// The Payoff drawer (W14, A114): one chart, the Planned line dashed and the Now line solid, each line with its text-equivalent table.
const WIDTH = 640;
const HEIGHT = 344;
const MARGIN = { left: 72, right: 32, top: 24, bottom: 80 };
const LINE = 16;
const CHAR_WIDTH = 7.5;
// SVG draws no stroke by default; currentColor follows the page ink in light and dark alike.
const STROKE = { stroke: 'currentColor', strokeWidth: 2.5, fill: 'none' } as const;

const priceLabel = (price: number): string => price.toFixed(2);

interface ChartProps {
  readonly title: string;
  readonly symbol: string;
  readonly planned: PayoffLineProps;
  readonly current?: PayoffLineProps;
  readonly marker?: PayoffDrawerProps['marker'];
  // The chart is named by its text equivalents' captions (A114), one for each line.
  readonly labelledBy: string;
}

function Chart({ title, symbol, planned, current, marker, labelledBy }: ChartProps) {
  const lines = [planned, ...(current ? [current] : [])];
  const points = lines.flatMap((line) => line.points);
  const xMax = Math.max(...points.map((p) => p.price));
  const values = [0, ...points.map((p) => p.value), ...(marker ? [marker.value] : [])];
  const low = Math.min(...values);
  const high = Math.max(...values);
  const pad = (high - low || 1) * 0.1;
  const x = (price: number) => MARGIN.left + (price / xMax) * (WIDTH - MARGIN.left - MARGIN.right);
  const y = (value: number) => HEIGHT - MARGIN.bottom - ((value - (low - pad)) / (high - low + 2 * pad)) * (HEIGHT - MARGIN.top - MARGIN.bottom);
  // Each price before the right edge is one tick; ticks that would touch drop to the next row.
  const prices = [...new Set(lines.flatMap((line) => line.points.slice(0, -1).map((p) => p.price)))].sort((a, b) => a - b);
  const rowEnds: number[] = [];
  const ticks = prices.map((price) => {
    const label = priceLabel(price);
    const half = (label.length * CHAR_WIDTH) / 2;
    let row = 0;
    while (rowEnds[row] !== undefined && x(price) - half < rowEnds[row]! + 6) row++;
    rowEnds[row] = x(price) + half;
    return { price, label, row };
  });
  const height = HEIGHT + Math.max(0, rowEnds.length - 3) * LINE;
  const legendX = WIDTH - MARGIN.right - 130;
  return (
    <div className="payoff-chart-scroll chart-scroll" role="group" aria-label={title} tabIndex={0}>
      <svg role="img" aria-labelledby={labelledBy} className="payoff-chart" viewBox={`0 0 ${WIDTH} ${height}`}>
        <line className="payoff-axis" stroke="currentColor" strokeWidth={1.5} x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y(0)} y2={y(0)} />
        <line className="payoff-axis" stroke="currentColor" strokeWidth={1.5} x1={MARGIN.left} x2={MARGIN.left} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} />
        <polyline className="payoff-planned" {...STROKE} strokeDasharray="8 5" points={planned.points.map((p) => `${x(p.price)},${y(p.value)}`).join(' ')} />
        {current && <polyline className="payoff-now" {...STROKE} points={current.points.map((p) => `${x(p.price)},${y(p.value)}`).join(' ')} />}
        {lines.map((line) => {
          const tip = line.points[line.points.length - 1]!;
          return <path key={line.tableName} className="payoff-arrow" d={`M${x(tip.price)},${y(tip.value)} l-10,-5 l0,10 z`} />;
        })}
        {marker && <circle className="payoff-marker" cx={x(marker.price)} cy={y(marker.value)} r={5} />}
        {ticks.map((tick) => (
          <text key={tick.price} x={x(tick.price)} y={HEIGHT - MARGIN.bottom + 16 + tick.row * LINE} textAnchor="middle">
            {tick.label}
          </text>
        ))}
        <line className="payoff-planned" {...STROKE} strokeWidth={2} strokeDasharray="8 5" x1={legendX} x2={legendX + 28} y1={MARGIN.top - 6} y2={MARGIN.top - 6} />
        <text x={legendX + 34} y={MARGIN.top - 2}>
          Planned
        </text>
        {current && (
          <>
            <line className="payoff-now" {...STROKE} strokeWidth={2} x1={legendX + 90} x2={legendX + 112} y1={MARGIN.top - 6} y2={MARGIN.top - 6} />
            <text x={legendX + 118} y={MARGIN.top - 2}>
              Now
            </text>
          </>
        )}
        <text x={(MARGIN.left + WIDTH - MARGIN.right) / 2} y={height - 6} textAnchor="middle">
          {`${symbol} at expiration`}
        </text>
        <text x={16} y={height / 2} textAnchor="middle" transform={`rotate(-90 16 ${height / 2})`}>
          Payoff
        </text>
      </svg>
    </div>
  );
}

// A line's text-equivalent table (A114), the chart's other form.
function LineTable({ line, captionId }: { readonly line: PayoffLineProps; readonly captionId: string }) {
  const headingId = useId();
  return (
    <section className="payoff-section" aria-labelledby={headingId}>
      <h3 id={headingId}>{line.tableName}</h3>
      <div className="table-scroll">
        <table className="payoff-table">
          <caption id={captionId}>{line.caption}</caption>
          <thead>
            <tr>
              {line.columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {line.segments.map((segment) => (
              <tr key={segment[0]}>
                <td>{segment[0]}</td>
                <td className="nowrap">{segment[1]}</td>
                <td className="nowrap">{segment[2]}</td>
              </tr>
            ))}
          </tbody>
          <tbody>
            {line.notes.map((note) => (
              <tr key={note}>
                <td colSpan={3}>{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PayoffChartDrawer({ title, symbol, stockNote, planned, current, marker, valueAtExpiration }: PayoffDrawerProps) {
  const now = current?.kind === 'Line' ? current.line : undefined;
  const id = useId();
  const plannedCaption = `${id}-planned`;
  const nowCaption = `${id}-now`;
  if (stockNote) {
    return (
      <section className="payoff-drawer" aria-label={title}>
        <p className="payoff-now-line">
          <span>{title}: </span>
          <span>{stockNote}</span>
        </p>
      </section>
    );
  }
  return (
    <section className="payoff-drawer" aria-label={title}>
      <h2>{title}</h2>
      {planned && <Chart title={title} symbol={symbol} planned={planned} {...(now && { current: now })} {...(marker && { marker })} labelledBy={now ? `${plannedCaption} ${nowCaption}` : plannedCaption} />}
      {current?.kind === 'NotApplicable' && (
        <p className="payoff-now-line">
          <span>Now: </span>
          <span>{current.text}</span>
        </p>
      )}
      {valueAtExpiration?.kind === 'Sentence' && <p>{valueAtExpiration.text}</p>}
      {valueAtExpiration?.kind === 'Unavailable' && (
        <dl>
          <div>
            <dt>{valueAtExpiration.term}</dt>
            <dd>{valueAtExpiration.value}</dd>
          </div>
        </dl>
      )}
      {planned && <LineTable line={planned} captionId={plannedCaption} />}
      {now && <LineTable line={now} captionId={nowCaption} />}
    </section>
  );
}

// What the shell renders for the Payoff tab: the view reaches the drawer through its adapter (A216).
export function PayoffDrawer({ view }: ShellProps) {
  const props = payoffDrawerProps(view);
  return props ? <PayoffChartDrawer {...props} /> : null;
}
