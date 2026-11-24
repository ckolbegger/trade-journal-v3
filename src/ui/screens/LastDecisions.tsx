import { useEffect, useState } from 'react';
import type { DailyTradeReview } from '../../app/types.ts';
import { calculation, signed } from '../figures.ts';
import { money, shortDate } from '../format.ts';
import { useRuntime } from '../runtime.tsx';
import { Figures } from './Figures.tsx';

type Decisions = NonNullable<DailyTradeReview['decisions']>;

export interface LastDecisionsProps {
  readonly decisions: Decisions;
}

// The width below which the page is a phone's (A324).
const PHONE = '(max-width: 959.98px)';
function usePhone(): boolean {
  const [phone, setPhone] = useState(() => window.matchMedia?.(PHONE).matches ?? false);
  useEffect(() => {
    const query = window.matchMedia?.(PHONE);
    if (!query) return;
    const change = () => setPhone(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  return phone;
}

// The card's top line (W114): the last decision and the sessions with no Review since, for a card that shows no list (U6).
export function LastDecisionLine({ decisions }: LastDecisionsProps) {
  const last = decisions.recent[0];
  if (!last) return null;
  const { sessionsWithoutReview: missed } = decisions;
  return (
    <p className="review-card-last">
      {`${shortDate(last.date)} you chose ${last.action}${last.reason === undefined ? ', no reason given.' : `: “${last.reason}”`}`}
      {missed.length > 0 && <span className="last-decisions-missed"> No Review {missed.map(shortDate).join(', ')}.</span>}
    </p>
  );
}

// "Your last decisions" (W115): the Trade's most recent saved Actions, each with that session's Trade P&L and its reason. On a phone the newest
// shows and the rest fold behind "3 earlier decisions" (A324, W117).
export function LastDecisions({ decisions }: LastDecisionsProps) {
  const { timeZone } = useRuntime();
  const phone = usePhone();
  if (decisions.recent.length === 0) return null;
  const item = (decision: Decisions['recent'][number]) => (
    <li key={decision.date}>
      <span className="last-decisions-when">{shortDate(decision.date)}</span> · {decision.action}
      {decision.tradePnl && (
        <>
          {' '}
          · <Figures text={calculation(decision.tradePnl, signed(money), timeZone)} />
        </>
      )}
      <span className="last-decisions-reason">{decision.reason === undefined ? 'no reason given' : `“${decision.reason}”`}</span>
    </li>
  );
  const [newest, ...rest] = decisions.recent;
  return (
    <section aria-labelledby="last-decisions-title" className="last-decisions">
      <h4 id="last-decisions-title">Your last decisions</h4>
      {decisions.heldPast && (
        <p className="last-decisions-held" data-line={decisions.heldPast.line.toLowerCase()}>
          Held past the {decisions.heldPast.line} {decisions.heldPast.sessions > 1 ? `${decisions.heldPast.sessions} sessions running` : 'last session'}.
        </p>
      )}
      {decisions.sessionsWithoutReview.length > 0 && <p className="last-decisions-missed">No Review {decisions.sessionsWithoutReview.map(shortDate).join(', ')}.</p>}
      {phone && rest.length > 0 ? (
        <>
          <ol>{item(newest!)}</ol>
          <details className="last-decisions-more">
            <summary>
              {rest.length} earlier decision{rest.length > 1 && 's'}
            </summary>
            <ol>{rest.map(item)}</ol>
          </details>
        </>
      ) : (
        <ol>{decisions.recent.map(item)}</ol>
      )}
    </section>
  );
}
