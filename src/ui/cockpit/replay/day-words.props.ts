import { Rational } from '../../../domain/values/index.ts';
import type { TradeReplayView } from '../../../app/types.ts';
import type { ReplayFrameSession } from './replay.types.ts';
import { markerWords } from './session-words.props.ts';

// T95.57, A317, W147, W149: what the trader did on each session, from the Actions and fills the view already carries; it works out no figure.
const ZERO = Rational.of(0n);

// W149: the Action row's letters and its key.
const LETTERS: Readonly<Record<string, string>> = { Hold: 'H', Exit: 'E', Roll: 'R', Adjust: 'A' };
export const ACTION_KEY = 'H Hold · E Exit · R Roll · A Adjust · – no Review';

export function dayOf(view: TradeReplayView, index: number): Pick<ReplayFrameSession, 'day' | 'actionMark'> {
  const session = view.sessions[index]!;
  const fills = (session.markers ?? []).map(markerWords);
  const words = fills.length > 0 ? { fills: `${fills.join('. ')}.` } : {};
  const { action } = session;
  // A Settle Later records nothing of the Trade: "Exercised" for a long contract, "Assigned" for a short one, as the Review's own settlement words say it.
  if (action?.action === 'Settle Later') {
    const quantity = session.positions.find((p) => p.instrument.kind === 'Option')?.quantity;
    const chosen = quantity ? `You chose ${quantity.compare(ZERO) > 0 ? 'Exercised' : 'Assigned'}: record later.` : 'You chose to record it later.';
    return { day: { ...words, action: { kind: 'Expired', text: `Expired. ${chosen}` } } };
  }
  if (action) {
    const letter = LETTERS[action.action];
    return {
      day: { ...words, action: { kind: 'Chosen', text: `Action: ${action.action}`, reason: action.intent === undefined ? 'no reason given' : `“${action.intent}”` } },
      ...(letter && { actionMark: { letter, name: action.action } }),
    };
  }
  // A317: a session that held a Position owed a Review, except the last one of a Trade with nothing to come: a contract due for settlement owes no Action (A315).
  // The newest session of an Open Trade is the one still to come.
  const newest = index === view.sessions.length - 1;
  if (!session.heldQuantity.equals(ZERO) && (view.pending !== null || !newest)) {
    const waiting = view.pending !== null && newest;
    return waiting
      ? { day: { ...words, action: { kind: 'Waiting', text: 'Action: not chosen yet.' } } }
      : { day: { ...words, action: { kind: 'Missed', text: 'No Review this session.' } }, actionMark: { letter: '–', name: 'No Review' } };
  }
  return { day: fills.length > 0 ? words : { action: { kind: 'Nothing', text: 'Nothing recorded.' } } };
}
