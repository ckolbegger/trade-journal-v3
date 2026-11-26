import type { MarketDataReadSession } from '../../modules/market-data/index.ts';
import type { TradeReplayView } from '../trade-views/index.ts';
import type { ReplayStripFigures, ReplayStripRole } from './types.ts';

type Crossings = NonNullable<TradeReplayView['sessions'][number]['crossings']>;

// T95.56, decision 131: what a card's Replay strip says, counted from the replay the card already holds. The run past a line is counted as the
// day summary counts it (the read session's sessions from the run's first through the Review Date), and only while the replay reaches the Review Date.
export function replayStripOf(replay: TradeReplayView, read: MarketDataReadSession, reviewDate: string): ReplayStripFigures | undefined {
  const last = replay.sessions.at(-1);
  if (!last) return undefined;
  const reaches = last.date === reviewDate;
  // A sale measured at its own price (trade-workflows, "measured against the Plan Exit"): a Stop or Target a closing sale's price reached counts as reached
  // on the sale's session, when no Mark reached it earlier. A long Trade's Target is reached at or above it, a short Trade's at or below.
  const long = replay.planColumn?.terms.legs[0]?.side !== 'Short';
  const soldAt = (line: 'Stop' | 'Target'): string | undefined =>
    replay.sessions.find((s) => s.markers?.some((m) => m.fills.some((f) => f.againstPlan?.line === line && (line === 'Stop' || f.againstPlan.side === 'At' || f.againstPlan.side === (long ? 'Above' : 'Below')))))?.date;
  const role = ({ first, since }: Crossings['stop'], sale: string | undefined): ReplayStripRole => {
    const dates = reaches && since ? read.sessionDatesBetween(since.date, reviewDate) : undefined;
    const firstDate = [first?.date, sale].filter((d): d is string => d !== undefined).sort()[0];
    return { ...(firstDate && { first: firstDate }), ...(reaches && since && { since: since.date }), ...(dates?.kind === 'Sessions' && { sessions: dates.dates.length }) };
  };
  const moment = (kind: 'Low' | 'High') => {
    const date = replay.keyMoments?.find((m) => m.kinds.includes(kind))?.date;
    const pnl = replay.sessions.find((s) => s.date === date)?.tradePnl;
    return date !== undefined && pnl?.kind === 'Value' ? { date, value: pnl.value } : undefined;
  };
  const low = moment('Low');
  const high = moment('High');
  return {
    sessions: replay.sessions.length,
    ...(low && { low }),
    ...(high && { high }),
    ...(last.crossings && { stop: role(last.crossings.stop, soldAt('Stop')), target: role(last.crossings.target, soldAt('Target')) }),
  };
}
