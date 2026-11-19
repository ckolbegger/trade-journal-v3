import type { TradeReplayView } from '../../../app/types.ts';
import { shortDate } from '../../format.ts';
import { NO_MARK } from './readout.props.ts';
import type { ReadoutGroup, ReadoutValue, SessionCardBody, SessionCardRow, StakeRow } from './replay.types.ts';
import { markerPlanWords } from './session-words.props.ts';

// The session cards (A277, W65): the card selects what the readout already built for the session, so the two never drift apart. It works out
// no figure (ADR 0001, A256).
type ViewSession = TradeReplayView['sessions'][number];

const stakeCardRow = ({ label, term, fromHere, r, pnlIfHit, weight }: StakeRow): SessionCardRow => ({ label, value: fromHere, ...(r?.text && { r }), ...(pnlIfHit?.text && { pnl: pnlIfHit }), term, ...(weight && { weight }) });

// A card text as the parts the page draws: its words, and each figure (a signed amount, an R multiple, the odds "11.69 to 1", a percentage pair "8% : 92%") as a part of its own that the page keeps on one
// line (C9AR.2, A278). It splits text the readout already worded; it works out nothing.
export interface FigurePart {
  readonly text: string;
  readonly figure?: true;
}
const FIGURE = /[−+]?\$[\d,]+(?:\.\d+)?|[−+]?\d[\d,]*(?:\.\d+)?R\b|\d+(?:\.\d+)? to \d+|under 1% : over 99%|over 99% : under 1%|\d+% : \d+%/g;
export function figureParts(text: string): FigurePart[] {
  const parts: FigurePart[] = [];
  let at = 0;
  for (const m of text.matchAll(FIGURE)) {
    if (m.index > at) parts.push({ text: text.slice(at, m.index) });
    parts.push({ text: m[0], figure: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}

export function cardOf(session: ViewSession, readout: readonly ReadoutGroup[]): SessionCardBody {
  const group = (title: string) => readout.find((g) => g.title === title);
  const plain = (rows: readonly { label: string; value: ReadoutValue }[] | undefined, only?: readonly string[]): SessionCardRow[] => (rows ?? []).filter((r) => !only || only.includes(r.label)).map(({ label, value }) => ({ label, value }));
  // The first group is "How it is going" (or "Final result"); the stake group is the one with a grid.
  const going = readout[0];
  const stake = readout.find((g) => g.grid);
  return {
    heading: shortDate(session.date),
    rows: [
      ...plain(group('Marks')?.rows),
      // The Trade P&L needs the Mark: a session without one reads the dash, not the reason the readout words (A281).
      ...plain(going?.rows).map((row) => (row.label === 'Trade P&L' && session.tradePnl.kind !== 'Value' ? { ...row, value: NO_MARK } : row)),
      ...plain(group('Position')?.rows, ['Held']),
      ...(stake?.grid?.groups.flatMap((g) => g.rows).map(stakeCardRow) ?? []),
      ...plain(stake?.rows).map((row) => (stake?.grid?.odds ? { ...row, spoken: stake.grid.odds.spoken } : row)),
    ],
    ...(stake?.grid?.pastLine && { pastLine: stake.grid.pastLine }),
    // The session's Executions, then a Stop or Target first crossed in it (W64).
    events: [
      ...(session.markers ?? []).map(markerPlanWords),
      ...(session.crossings?.stop.first?.date === session.date ? ['Stop first breached'] : []),
      ...(session.crossings?.target.first?.date === session.date ? ['Target first reached'] : []),
    ],
  };
}
