import type { HistoryAction } from '../../modules/journal/index.ts';
import type { TradeReplayView } from '../trade-views/index.ts';
import type { LastDecisions } from './types.ts';

const RECENT = 4;

// The consecutive sessions before the Review Date, newest first, that hold a Hold saved while the line was reached; a session with no
// Review, another Action, or no crossing ends the run.
function heldPast(history: readonly HistoryAction[], replay: TradeReplayView | undefined, reviewDate: string, line: 'stop' | 'target'): number {
  const actionOn = new Map(history.map(({ reviewDate: date, action }) => [date, action]));
  let count = 0;
  for (const session of [...(replay?.sessions ?? [])].reverse()) {
    if (session.date >= reviewDate) continue;
    if (actionOn.get(session.date) !== 'Hold' || session.crossings?.[line].since === undefined) break;
    count++;
  }
  return count;
}

// A305: the Trade's last decisions from its Actions before the Review Date (oldest first, as the history read gives them) and its replay.
export function lastDecisionsOf(history: readonly HistoryAction[], replay: TradeReplayView | undefined, reviewDate: string, sessionsWithoutReview: readonly string[]): LastDecisions {
  const pnlOn = new Map((replay?.sessions ?? []).map((session) => [session.date, session.tradePnl]));
  const recent = history.slice(-RECENT).reverse().map(({ reviewDate, action, reason }) => {
    const tradePnl = pnlOn.get(reviewDate);
    return { date: reviewDate, action, ...(reason !== undefined && { reason }), ...(tradePnl && { tradePnl }) };
  });
  const stop = heldPast(history, replay, reviewDate, 'stop');
  const target = heldPast(history, replay, reviewDate, 'target');
  const held = stop >= target ? { line: 'Stop' as const, sessions: stop } : { line: 'Target' as const, sessions: target };
  return { recent, sessionsWithoutReview, earlier: Math.max(0, history.length - RECENT), ...(held.sessions > 0 && { heldPast: held }) };
}
