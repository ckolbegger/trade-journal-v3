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
const HEIGHT = 344;
const MARGIN = { left: 72, right: 32, top: 24, bottom: 80 };

// Labels are laid out at the chart's own size, with a width estimated from the text (digits are about 7px at the chart's 13px font).
const CHAR_WIDTH = 7.5;
const LINE = 16;
type Anchor = 'start' | 'middle' | 'end';
interface Box { readonly left: number; readonly right: number; readonly baseline: number }
const boxOf = (text: string, x: number, baseline: number, anchor: Anchor): Box => {
  const width = text.length * CHAR_WIDTH;
  const left = anchor === 'start' ? x : anchor === 'end' ? x - width : x - width / 2;
  return { left, right: left + width, baseline };
};
const collides = (a: Box, b: Box): boolean => a.left < b.right + 4 && b.left < a.right + 4 && Math.abs(a.baseline - b.baseline) < LINE;
// Where a label goes: its x is pulled in so the box stays inside the SVG, and its baseline is the first, moving by `step` from the wanted
// one and then the other way, that clears every box already placed and keeps the text inside the SVG; the label's box is then placed.
const TEXT_HEIGHT = 13;
function place(text: string, wantX: number, baseline: number, anchor: Anchor, placed: Box[], step: number): { x: number; y: number } {
  const probe = boxOf(text, wantX, baseline, anchor);
  const x = wantX + Math.max(0, -probe.left) - Math.max(0, probe.right - WIDTH);
  const inside = (at: number) => at - TEXT_HEIGHT >= 0 && at <= HEIGHT;
  const fits = (at: number) => inside(at) && !placed.some((box) => collides(boxOf(text, x, at, anchor), box));
  const tries = Array.from({ length: 7 }, (_, k) => baseline + k * step).concat(Array.from({ length: 6 }, (_, k) => baseline - (k + 1) * step));
  const y = tries.find(fits) ?? Math.min(HEIGHT, Math.max(TEXT_HEIGHT, baseline));
  placed.push(boxOf(text, x, y, anchor));
  return { x, y };
}

// SVG draws no stroke by default; currentColor follows the page ink in light and dark alike.
const STROKE = { stroke: 'currentColor', strokeWidth: 1.5 } as const;

const toNumber =(value: Rational): number => Number(value.numerator) / Number(value.denominator);

// The hand-drawn chart (A114): x runs from 0 to 1.5 times the largest breakpoint, and the last ray ends in an arrow.
function Chart({ kind, view, symbol, caption, latestClose }: { readonly kind: PayoffViewProps['kind']; readonly view: ExpirationPayoffView; readonly symbol: string; readonly caption: string; readonly latestClose: PayoffViewProps['latestClose'] }) {
  const { segments, zeroSet } = view;
  const allPrices = [
    ...segments.map((s) => s.from),
    ...zeroSet.flatMap((z) => (z.kind === 'ZeroRange' ? [z.from, ...(z.to ? [z.to] : [])] : [z.price])),
  ];
  // Each price is one tick: a segment start is often also a zero-set end.
  const breakpoints = allPrices.filter((p, i) => allPrices.findIndex((q) => q.numerator === p.numerator && q.denominator === p.denominator) === i);
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
  // Tick labels that would touch drop to a second or third row; the other labels move off whatever they would overprint.
  const ticks = breakpoints.map((price) => ({ price, label: underlyingPrice(price), at: x(toNumber(price)), row: 0 })).sort((a, b) => a.at - b.at);
  const rowEnds: number[] = [];
  for (const tick of ticks) {
    const half = (tick.label.length * CHAR_WIDTH) / 2;
    let row = 0;
    while (rowEnds[row] !== undefined && tick.at - half < rowEnds[row]! + 6) row++;
    tick.row = row;
    rowEnds[row] = tick.at + half;
  }
  const placed: Box[] = [];
  const rayText = lastRayText(last);
  const ray = place(rayText, tipX, tipY - 10, 'end', placed, -LINE);
  const closeText = latestClose ? `Latest close ${underlyingPrice(latestClose.underlyingPrice)}: ${signedMoney(latestClose.value)}` : '';
  const zeroLabels = zeroSet.map((zero) => place(zeroText(zero), x(toNumber(zero.kind === 'ZeroRange' ? zero.from : zero.price)), y(0) - 8, 'start', placed, LINE));
  const close = latestClose ? place(closeText, x(toNumber(latestClose.underlyingPrice)), y(toNumber(latestClose.value)) - 10, 'middle', placed, -LINE) : undefined;
  return (
    <div className="chart-scroll" role="region" aria-label={`${kind} payoff chart`} tabIndex={0}>
    <svg role="img" aria-labelledby={caption} className="payoff-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
      <line className="payoff-axis" {...STROKE} x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y(0)} y2={y(0)} />
      <line className="payoff-axis" {...STROKE} x1={MARGIN.left} x2={MARGIN.left} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} />
      <polyline className="payoff-curve" {...STROKE} strokeWidth={2.5} fill="none" points={points.map(([px, py]) => `${x(px)},${y(py)}`).join(' ')} />
      <path className="payoff-arrow" d={`M${tipX},${tipY} l-10,-5 l0,10 z`} />
      <text x={ray.x} y={ray.y} textAnchor="end">
        {rayText}
      </text>
      {ticks.map((tick) => (
        <text key={tick.price.numerator + '/' + tick.price.denominator} x={tick.at} y={HEIGHT - MARGIN.bottom + 16 + tick.row * LINE} textAnchor="middle">
          {tick.label}
        </text>
      ))}
      {zeroSet.map((zero, i) => {
        const label = zeroLabels[i]!;
        return (
        <g key={zeroText(zero)}>
          {zero.kind === 'ZeroRange' ? (
            <line className="payoff-zero-range" {...STROKE} strokeWidth={4} x1={x(toNumber(zero.from))} x2={x(zero.to ? toNumber(zero.to) : xMax)} y1={y(0)} y2={y(0)} />
          ) : (
            <circle className="payoff-mark" cx={x(toNumber(zero.price))} cy={y(0)} r={4} />
          )}
          <text x={label.x} y={label.y} textAnchor="start">
            {zeroText(zero)}
          </text>
        </g>
        );
      })}
      {latestClose && close && (
        <g>
          <circle className="payoff-mark payoff-latest-close" cx={x(toNumber(latestClose.underlyingPrice))} cy={y(toNumber(latestClose.value))} r={5} />
          <text x={close.x} y={close.y} textAnchor="middle">
            {closeText}
          </text>
        </g>
      )}
      <text x={(MARGIN.left + WIDTH - MARGIN.right) / 2} y={HEIGHT - 6} textAnchor="middle">
        {`${symbol} at expiration`}
      </text>
      <text x={16} y={HEIGHT / 2} textAnchor="middle" transform={`rotate(-90 16 ${HEIGHT / 2})`}>
        Payoff
      </text>
    </svg>
    </div>
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
      <Chart kind={kind} view={view} symbol={symbol} caption={captionId} latestClose={latestClose} />
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
                <td className="nowrap">{signedMoney(segment.valueAtStart)}</td>
                <td className="nowrap">{signedMoney(segment.slope)}</td>
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
