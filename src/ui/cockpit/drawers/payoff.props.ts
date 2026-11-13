// The adapter from a Trade Detail view to the Payoff drawer's plain props (A216). It is the only file of the drawer that reads the view's
// types; the drawing leaves here as finished numbers (price, value) and the words as finished strings.
import type { ExpirationPayoffView, TradeDetailView } from '../../../app/types.ts';
import type { Rational } from '../../../domain/values/index.ts';
import { notApplicableWords, text } from '../../calculation-words.ts';
import { calculation } from '../../figures.ts';
import { extremumText, rangeText, signedMoney, valueAtCloseTerm, valueAtCloseText, zeroText } from '../../screens/payoff-text.ts';
import type { PayoffDrawerProps, PayoffLineProps } from './payoff.types.ts';

const toNumber = (value: Rational): number => Number(value.numerator) / Number(value.denominator);

// The prices a view puts a tick on: each segment start and each breakeven.
const breakpointsOf = (view: ExpirationPayoffView): number[] =>
  [...view.segments.map((s) => s.from), ...view.zeroSet.flatMap((z) => (z.kind === 'ZeroRange' ? [z.from, ...(z.to ? [z.to] : [])] : [z.price]))].map(toNumber);

// The chart's right edge: 1.5 times the largest breakpoint of either line, so both lines share one price axis (A114); a latest Mark beyond
// the usual span still lands on the chart.
const rightEdgeOf = (views: readonly ExpirationPayoffView[], markerPrice = 0): number => {
  const largest = Math.max(0, ...views.flatMap(breakpointsOf));
  return Math.max(largest > 0 ? 1.5 * largest : 1, 1.05 * markerPrice);
};

function lineOf(kind: 'Planned' | 'Current', symbol: string, view: ExpirationPayoffView, xMax: number): PayoffLineProps {
  const last = view.segments[view.segments.length - 1]!;
  const endValue = toNumber(last.valueAtStart) + toNumber(last.slope) * (xMax - toNumber(last.from));
  return {
    points: [...view.segments.map((s) => ({ price: toNumber(s.from), value: toNumber(s.valueAtStart) })), { price: xMax, value: endValue }],
    tableName: `${kind} Expiration Payoff`,
    caption: `${kind} payoff at expiration by ${symbol} price${kind === 'Current' ? `, including ${signedMoney(view.realizedOffset)} realized to date` : ''}`,
    columns: [`${symbol} at expiration`, 'Payoff at start', `Change per $1 rise in ${symbol}`],
    segments: view.segments.map((s) => [rangeText(s.from, s.to), signedMoney(s.valueAtStart), signedMoney(s.slope)] as const),
    notes: [
      ...(view.zeroSet.length === 0 ? ['No breakeven'] : view.zeroSet.map(zeroText)),
      extremumText('Maximum', view.maximum, symbol),
      extremumText('Minimum', view.minimum, symbol),
    ],
  };
}

// What the shell hands the drawer is a Trade Detail view (the placeholder type leaves it unknown), and an incoherent Detail has no payoff.
export function payoffDrawerProps(shellView: unknown): PayoffDrawerProps | undefined {
  const view = shellView as TradeDetailView;
  if ('recordedPositionChanges' in view) return undefined;
  const symbol = view.plan.underlying;
  const { planned, current } = view.payoff;
  if (planned.kind !== 'Value') return { title: 'Expiration Payoff', symbol, ...(planned.kind === 'NotApplicable' && { stockNote: text(notApplicableWords(planned, 'figure')) }) };
  // The value at expiration at the Underlying's latest Mark (A122): an Open Trade's figure, marked on the chart once it has a number.
  const atMark = 'current' in view ? view.current.evaluation.expirationValueAtUnderlyingClose : undefined;
  const marker = atMark?.kind === 'Value' ? { price: toNumber(atMark.value.underlyingPrice), value: toNumber(atMark.value.value) } : undefined;
  const xMax = rightEdgeOf([planned.value, ...(current.kind === 'Value' ? [current.value] : [])], marker?.price);
  return {
    title: 'Expiration Payoff',
    symbol,
    ...(marker && { marker }),
    ...(atMark?.kind === 'Value' && { valueAtExpiration: { kind: 'Sentence' as const, text: valueAtCloseText(symbol, atMark.value) } }),
    ...(atMark?.kind === 'Unavailable' && { valueAtExpiration: { kind: 'Unavailable' as const, term: valueAtCloseTerm(symbol), value: calculation(atMark, () => '') } }),
    planned: lineOf('Planned', symbol, planned.value, xMax),
    ...(current.kind === 'Value' && { current: { kind: 'Line' as const, line: lineOf('Current', symbol, current.value, xMax) } }),
    ...(current.kind === 'NotApplicable' && { current: { kind: 'NotApplicable' as const, text: text(notApplicableWords(current, 'figure')) } }),
  };
}
