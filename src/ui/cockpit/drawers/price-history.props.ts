import { instrumentKey, type Instrument } from '../../../domain/instrument/index.ts';
import type { Rational } from '../../../domain/values/index.ts';
import { decimalMoney, decimalUnderlyingPrice, money, shortDate } from '../../format.ts';
import type { PriceHistoryProps } from './price-history.types.ts';

// What this adapter reads of `TradeReplayView` (coordinators/trade-views/replay-view.ts). The UI reaches views only through the
// facade (`ui-only-through-facade`), and the Trade Views index does not export that type yet, so the needed slice is declared here;
// the real view is assignable to it.
export interface ReplaySource {
  readonly instruments: readonly Instrument[];
  readonly sessions: readonly {
    readonly date: string;
    readonly marks: readonly {
      readonly instrument: Instrument;
      readonly resolution: { readonly kind: 'Available'; readonly mark: { readonly price: string } } | { readonly kind: 'Missing' | 'AcknowledgedUnavailable' };
    }[];
    readonly tradePnl: { readonly kind: 'Value'; readonly value: Rational } | { readonly kind: 'Unbounded' | 'NotApplicable' | 'Unavailable' };
  }[];
}
type TradeReplayView = ReplaySource;
type Session = TradeReplayView['sessions'][number];
type Cell = PriceHistoryProps['columns'][number]['cells'][number];

const rowLabel = (instrument: Instrument): string => (instrument.kind === 'Stock' ? `${instrument.symbol} Mark` : `${instrument.right} Mark`);

// An Instrument's Mark in a session, or null for a gap (a gap is never filled, A210).
function markCell(session: Session, instrument: Instrument): Cell {
  const mark = session.marks.find((m) => instrumentKey(m.instrument) === instrumentKey(instrument));
  if (mark?.resolution.kind !== 'Available') return null;
  const price = mark.resolution.mark.price;
  return { text: instrument.kind === 'Stock' ? decimalUnderlyingPrice(price) : decimalMoney(price) };
}

function pnlCell(session: Session): Cell {
  if (session.tradePnl.kind !== 'Value') return null;
  const { value } = session.tradePnl;
  return { text: money(value), ...(value.numerator !== 0n && { tone: value.numerator > 0n ? ('gain' as const) : ('loss' as const) }) };
}

const lacksMarks = (session: Session): boolean => session.marks.some((m) => m.resolution.kind !== 'Available');

// W1: the Price History tab's count, the sessions without Marks (T8P.22 shows it on the tab).
export function priceHistoryTabCount(replay: TradeReplayView): number {
  return replay.sessions.filter(lacksMarks).length;
}

// W9's table: newest session first, one row per Instrument's Mark, then Trade P&L.
export function priceHistoryProps(replay: TradeReplayView, onOpenReview: () => void): PriceHistoryProps {
  const sessions = [...replay.sessions].reverse();
  return {
    rowLabels: [...replay.instruments.map(rowLabel), 'Trade P&L'],
    columns: sessions.map((session) => {
      const [weekday = '', ...date] = shortDate(session.date).split(' ');
      return { weekday, date: date.join(' '), cells: [...replay.instruments.map((i) => markCell(session, i)), pnlCell(session)] };
    }),
    missingCount: priceHistoryTabCount(replay),
    onOpenReview,
  };
}
