import { useId } from 'react';
import type { NotApplicableReason } from '../../domain/calculation-result/index.ts';
import type { CalculationResult, ExpirationPayoffView } from '../../app/types.ts';
import type { Rational } from '../../domain/values/index.ts';
import { notApplicableWords, text } from '../calculation-words.ts';
import { underlyingPrice } from '../format.ts';
import { extremumText, lastRayText, rangeText, signedMoney, zeroText } from './payoff-text.ts';

export interface PayoffViewProps {
  // Which of the two views this is: they are separate sections and never merged.
  readonly kind: 'Planned' | 'Current';
  readonly symbol: string;
  readonly result: CalculationResult<ExpirationPayoffView, never, NotApplicableReason>;
  // The Current view's value at expiration at the Underlying's latest close (A122).
  readonly latestClose?: { readonly underlyingPrice: Rational; readonly value: Rational };
}

const WIDTH = 640;
const HEIGHT = 320;
const MARGIN = { left: 72, right: 32, top: 24, bottom: 56 };

const toNumber = (value: Rational): number => Number(value.numerator) / Number(value.denominator);

// The hand-drawn chart (A114): x runs from 0 to 1.5 times the largest breakpoint, and the last ray ends in an arrow.
function Chart({ view, symbol, caption, latestClose }: { readonly view: ExpirationPayoffView; readonly symbol: string; readonly caption: string; readonly latestClose: PayoffViewProps['latestClose'] }) {
  const { segments, zeroSet } = view;
  const breakpoints = [
    ...segments.map((s) => s.from),
    ...zeroSet.flatMap((z) => (z.kind === 'ZeroRange' ? [z.from, ...(z.to ? [z.to] : [])] : [z.price])),
  ];
  const largest = Math.max(...breakpoints.map(toNumber));
  // A latest close beyond the usual span still lands on the chart.
  const xMax = Math.max(largest > 0 ? 1.5 * largest : 1, latestClose ? 1.05 * toNumber(latestClose.underlyingPrice) : 0);
  const last = segments[segments.length - 1]!;
  const endValue = toNumber(last.valueAtStart) + toNumber(last.slope) * (xMax - toNumber(last.from));
  const values = [...segments.map((s) => toNumber(s.valueAtStart)), endValue, 0, ...(latestClose ? [toNumber(latestClose.value)] : [])];
  const low = Math.min(...values);
  const high = Math.max(...values);
  const pad = (high - low || 1) * 0.1;
  const x = (price: number) => MARGIN.left + (price / xMax) * (WIDTH - MARGIN.left - MARGIN.right);
  const y = (value: number) => HEIGHT - MARGIN.bottom - ((value - (low - pad)) / (high - low + 2 * pad)) * (HEIGHT - MARGIN.top - MARGIN.bottom);
  const points = [...segments.map((s) => [toNumber(s.from), toNumber(s.valueAtStart)] as const), [xMax, endValue] as const];
  const tipX = x(xMax);
  const tipY = y(endValue);
  return (
    <svg role="img" aria-labelledby={caption} className="payoff-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
      <line className="payoff-axis" x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y(0)} y2={y(0)} />
      <line className="payoff-axis" x1={MARGIN.left} x2={MARGIN.left} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} />
      <polyline className="payoff-curve" fill="none" points={points.map(([px, py]) => `${x(px)},${y(py)}`).join(' ')} />
      <path className="payoff-arrow" d={`M${tipX},${tipY} l-10,-5 l0,10 z`} />
      <text x={tipX} y={tipY - 10} textAnchor="end">
        {lastRayText(last)}
      </text>
      {breakpoints.map((price) => (
        <text key={price.numerator + '/' + price.denominator} x={x(toNumber(price))} y={HEIGHT - MARGIN.bottom + 16} textAnchor="middle">
          {underlyingPrice(price)}
        </text>
      ))}
      {zeroSet.map((zero) => (
        <g key={zeroText(zero)}>
          {zero.kind === 'ZeroRange' ? (
            <line className="payoff-zero-range" x1={x(toNumber(zero.from))} x2={x(zero.to ? toNumber(zero.to) : xMax)} y1={y(0)} y2={y(0)} />
          ) : (
            <circle className="payoff-mark" cx={x(toNumber(zero.price))} cy={y(0)} r={4} />
          )}
          <text x={x(toNumber(zero.kind === 'ZeroRange' ? zero.from : zero.price))} y={y(0) - 8} textAnchor="start">
            {zeroText(zero)}
          </text>
        </g>
      ))}
      {latestClose && (
        <g>
          <circle className="payoff-mark payoff-latest-close" cx={x(toNumber(latestClose.underlyingPrice))} cy={y(toNumber(latestClose.value))} r={5} />
          <text x={x(toNumber(latestClose.underlyingPrice))} y={y(toNumber(latestClose.value)) - 10} textAnchor="middle">
            {`Latest close ${underlyingPrice(latestClose.underlyingPrice)}: ${signedMoney(latestClose.value)}`}
          </text>
        </g>
      )}
      <text x={(MARGIN.left + WIDTH - MARGIN.right) / 2} y={HEIGHT - 8} textAnchor="middle">
        {`${symbol} at expiration`}
      </text>
      <text x={16} y={HEIGHT / 2} textAnchor="middle" transform={`rotate(-90 16 ${HEIGHT / 2})`}>
        Payoff
      </text>
    </svg>
  );
}

// A Planned or Current Expiration Payoff: the chart and, beneath it, its textual equivalent (A114). A view
// that is not applicable is text naming the reason, with no chart.
export function PayoffView({ kind, symbol, result, latestClose }: PayoffViewProps) {
  const id = useId();
  const headingId = `${id}-heading`;
  const captionId = `${id}-caption`;
  if (result.kind !== 'Value') {
    return (
      <section className="card" aria-labelledby={headingId}>
        <h2 id={headingId}>{kind} Expiration Payoff</h2>
        <p>{result.kind === 'NotApplicable' ? text(notApplicableWords(result, 'figure')) : null}</p>
      </section>
    );
  }
  const view = result.value;
  return (
    <section className="card" aria-labelledby={headingId}>
      <h2 id={headingId}>{kind} Expiration Payoff</h2>
      <Chart view={view} symbol={symbol} caption={captionId} latestClose={latestClose} />
      {latestClose && <p>{`If ${symbol} is at ${underlyingPrice(latestClose.underlyingPrice)} at expiration: ${signedMoney(latestClose.value)}`}</p>}
      <div className="table-scroll">
        <table className="payoff-table">
          <caption id={captionId}>
            {`${kind} payoff at expiration by ${symbol} price`}
            {kind === 'Current' && `, including ${signedMoney(view.realizedOffset)} realized to date`}
          </caption>
          <thead>
            <tr>
              <th scope="col">{symbol} at expiration</th>
              <th scope="col">Payoff at start</th>
              <th scope="col">Change per $1 rise in {symbol}</th>
            </tr>
          </thead>
          <tbody>
            {view.segments.map((segment) => (
              <tr key={segment.from.numerator + '/' + segment.from.denominator}>
                <td>{rangeText(segment.from, segment.to)}</td>
                <td>{signedMoney(segment.valueAtStart)}</td>
                <td>{signedMoney(segment.slope)}</td>
              </tr>
            ))}
          </tbody>
          <tbody>
            {view.zeroSet.map((zero) => (
              <tr key={zeroText(zero)}>
                <td colSpan={3}>{zeroText(zero)}</td>
              </tr>
            ))}
            {view.zeroSet.length === 0 && (
              <tr>
                <td colSpan={3}>No breakeven</td>
              </tr>
            )}
            <tr>
              <td colSpan={3}>{extremumText('Maximum', view.maximum, symbol)}</td>
            </tr>
            <tr>
              <td colSpan={3}>{extremumText('Minimum', view.minimum, symbol)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
