import type { TradeReplayView } from '../../../app/types.ts';
import { shortDate } from '../../format.ts';
import { NO_MARK } from './readout.props.ts';
import type { ReadoutGroup, ReadoutValue, SessionCardBody, SessionCardRow, StakeRow } from './replay.types.ts';
import { markerPlanWords } from './session-words.props.ts';

// The session cards (A277, W65): the card selects what the readout already built for the session, so the two never drift apart. It works out
// no figure (ADR 0001, A256).
type ViewSession = TradeReplayView['sessions'][number];

const stakeCardRow = ({ label, term, fromHere, r, pnlIfHit, weight }: StakeRow): SessionCardRow => ({ label, value: fromHere, ...(r?.text && { r }), ...(pnlIfHit?.text && { pnl: pnlIfHit }), term, ...(weight && { weight }) });

// figureParts moved to figure-parts.ts, shared with the readout and the overlay's header; it stays importable from here.
export { figureParts, type FigurePart } from './figure-parts.ts';

export function cardOf(session: ViewSession, readout: readonly ReadoutGroup[]): SessionCardBody {
  const group = (title: string) => readout.find((g) => g.title === title);
  const plain = (rows: readonly { label: string; value: ReadoutValue; term?: string; tag?: string }[] | undefined, only?: readonly string[]): SessionCardRow[] =>
    (rows ?? []).filter((r) => !only || only.includes(r.label)).map(({ label, value, term, tag }) => ({ label, value, ...(term && { term }), ...(tag && { tag }) }));
  // The first group is "How it is going" (or "Final result"); the stake group is the one with a grid.
  const going = readout[0];
  const stake = readout.find((g) => g.grid);
  return {
    heading: shortDate(session.date),
    rows: [
      ...plain(group('Marks')?.rows),
      // The Trade P&L needs the Mark: a session without one reads the dash, not the reason the readout words (A281).
      ...plain(going?.rows).map((row) => (row.label === 'Trade P&L' && session.tradePnl.kind !== 'Value' ? { ...row, value: NO_MARK } : row)),
      ...plain(group('Position')?.rows, ['Held', 'Behaves like']),
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
