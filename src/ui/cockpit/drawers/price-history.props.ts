import { instrumentKey, type Instrument } from '../../../domain/instrument/index.ts';
import type { Rational } from '../../../domain/values/index.ts';
import { decimalMoney, decimalUnderlyingPrice, localTime, money, shortDate } from '../../format.ts';
import type { PriceHistoryProps } from './price-history.types.ts';

// What this adapter reads of `TradeReplayView` (coordinators/trade-views/replay-view.ts). The UI reaches views only through the
// facade (`ui-only-through-facade`), and the Trade Views index does not export that type yet, so the needed slice is declared here;
// the real view is assignable to it.
export interface ReplaySource {
  readonly instruments: readonly Instrument[];
  readonly sessions: readonly {
    readonly date: string;
    // The Position held at the session's Mark: signed quantity per Instrument. Nothing held means no Mark was due.
    readonly positions: readonly { readonly quantity: Rational }[];
    readonly marks: readonly {
      readonly instrument: Instrument;
      readonly resolution: { readonly kind: 'Available'; readonly mark: { readonly price: string; readonly source: string; readonly savedAt: string; readonly correctionReason?: string } } | { readonly kind: 'Missing' | 'AcknowledgedUnavailable' };
    }[];
    readonly tradePnl: { readonly kind: 'Value'; readonly value: Rational } | { readonly kind: 'Unbounded' | 'NotApplicable' | 'Unavailable' };
  }[];
}
type TradeReplayView = ReplaySource;
type Session = TradeReplayView['sessions'][number];
type Cell = PriceHistoryProps['columns'][number]['cells'][number];

const rowLabel = (instrument: Instrument): string => (instrument.kind === 'Stock' ? `${instrument.symbol} Mark` : `${instrument.right} Mark`);

// An Instrument's Mark in a session, or null for a gap (a gap is never filled, A210).
function markCell(session: Session, instrument: Instrument, optionTrade: boolean, timeZone: string): Cell {
  const mark = session.marks.find((m) => instrumentKey(m.instrument) === instrumentKey(instrument));
  if (mark?.resolution.kind !== 'Available') {
    // Nothing held at the close: no Mark was due, so the cell is not a gap (plain "—", not "No Mark").
    return heldNothing(session) ? { text: '—' } : null;
  }
  const { price, source, savedAt, correctionReason } = mark.resolution.mark;
  // An Underlying's price has no "$" on an option Trade (C3); a stock Trade's Mark is money (C1), as in Today and the Journal.
  const text = instrument.kind === 'Stock' && optionTrade ? decimalUnderlyingPrice(price) : decimalMoney(price);
  const saved = `${source} · saved ${localTime(savedAt, timeZone)}`;
  const provenance = correctionReason === undefined ? saved : `${saved}. Corrected: ${correctionReason}`;
  return { text, provenance, label: `${text}. ${provenance}` };
}

function pnlCell(session: Session): Cell {
  if (session.tradePnl.kind !== 'Value') return null;
  const { value } = session.tradePnl;
  return { text: money(value), ...(value.numerator !== 0n && { tone: value.numerator > 0n ? ('gain' as const) : ('loss' as const) }) };
}

// A session whose close held no Position (a Closed Trade's final session) was owed no Mark (A211's Position held).
const heldNothing = (session: Session): boolean => session.positions.every((p) => p.quantity.numerator === 0n);
const lacksMarks = (session: Session): boolean => !heldNothing(session) && session.marks.some((m) => m.resolution.kind !== 'Available');

// W1: the Price History tab's count, the sessions without Marks (T8P.22 shows it on the tab).
export function priceHistoryTabCount(replay: TradeReplayView): number {
  return replay.sessions.filter(lacksMarks).length;
}

// W9's table: newest session first, one row per Instrument's Mark, then Trade P&L.
export function priceHistoryProps(replay: TradeReplayView, onOpenReview: () => void, timeZone: string): PriceHistoryProps {
  const sessions = [...replay.sessions].reverse();
  const optionTrade = replay.instruments.some((i) => i.kind === 'Option');
  return {
    rowLabels: [...replay.instruments.map(rowLabel), 'Trade P&L'],
    columns: sessions.map((session) => {
      const [weekday = '', ...date] = shortDate(session.date).split(' ');
      return { weekday, date: date.join(' '), cells: [...replay.instruments.map((i) => markCell(session, i, optionTrade, timeZone)), pnlCell(session)] };
    }),
    missingCount: priceHistoryTabCount(replay),
    onOpenReview,
  };
}
