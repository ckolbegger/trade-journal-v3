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
  const role = ({ first, since }: Crossings['stop']): ReplayStripRole => {
    const dates = reaches && since ? read.sessionDatesBetween(since.date, reviewDate) : undefined;
    return { ...(first && { first: first.date }), ...(reaches && since && { since: since.date }), ...(dates?.kind === 'Sessions' && { sessions: dates.dates.length }) };
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
    ...(last.crossings && { stop: role(last.crossings.stop), target: role(last.crossings.target) }),
  };
}
