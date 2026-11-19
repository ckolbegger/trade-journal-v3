import type { TradeReplayView } from '../../../app/types.ts';
import { decimalMoney, decimalUnderlyingPrice, shortDate } from '../../format.ts';
import { NO_MARK } from './readout.props.ts';
import type { ReadoutGroup, ReadoutValue, SessionCardBody, SessionCardRow, StakeRow } from './replay.types.ts';
import { markerWords } from './session-words.props.ts';

// The session cards (A277, W65): the card selects what the readout already built for the session, so the two never drift apart. It works out
// no figure (ADR 0001, A256).
type ViewSession = TradeReplayView['sessions'][number];

// The trigger of a session's Stop or Target; an Underlying's price has no "$" on an option Trade (C3).
function triggerOf(view: TradeReplayView, session: ViewSession, role: 'Stop' | 'Target'): ReadoutValue | undefined {
  const condition = session.figures?.conditions.find((c) => c.role === role);
  if (!condition) return undefined;
  const bare = condition.kind === 'UnderlyingPrice' && view.instruments.some((i) => i.kind === 'Option');
  return { kind: 'Figure', text: bare ? decimalUnderlyingPrice(condition.boundary) : decimalMoney(condition.boundary) };
}

const stakeCardRow = ({ label, term, fromHere, r, pnlIfHit, weight }: StakeRow): SessionCardRow => ({ label, value: fromHere, ...(r && { r }), ...(pnlIfHit && { pnl: pnlIfHit }), term, ...(weight && { weight }) });

export function cardOf(view: TradeReplayView, session: ViewSession, readout: readonly ReadoutGroup[]): SessionCardBody {
  const group = (title: string) => readout.find((g) => g.title === title);
  const plain = (rows: readonly { label: string; value: ReadoutValue }[] | undefined, only?: readonly string[]): SessionCardRow[] => (rows ?? []).filter((r) => !only || only.includes(r.label)).map(({ label, value }) => ({ label, value }));
  // The first group is "How it is going" (or "Final result"); the stake group is the one with a grid.
  const going = readout[0];
  const stake = readout.find((g) => g.grid);
  const stop = triggerOf(view, session, 'Stop');
  const target = triggerOf(view, session, 'Target');
  return {
    heading: shortDate(session.date),
    rows: [
      ...plain(group('Marks')?.rows),
      // The Trade P&L needs the Mark: a session without one reads the dash, not the reason the readout words (A281).
      ...plain(going?.rows).map((row) => (row.label === 'Trade P&L' && session.tradePnl.kind !== 'Value' ? { ...row, value: NO_MARK } : row)),
      ...plain(group('Position')?.rows, ['Held']),
      ...(stake?.grid?.groups.flatMap((g) => g.rows).map(stakeCardRow) ?? []),
      ...plain(stake?.rows).map((row) => (stake?.grid?.odds ? { ...row, spoken: stake.grid.odds.spoken } : row)),
      ...(stop ? [{ label: 'Stop', value: stop }] : []),
      ...(target ? [{ label: 'Target', value: target }] : []),
    ],
    ...(stake?.grid?.pastLine && { pastLine: stake.grid.pastLine }),
    events: (session.markers ?? []).map(markerWords),
  };
}
