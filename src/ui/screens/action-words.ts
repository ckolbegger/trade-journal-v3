import type { DailyTradeReview } from '../../app/types.ts';
import { conditionClause, countWords, unsigned } from '../cockpit/replay/readout.props.ts';
import type { ActionChoice } from '../../app/types.ts';

type PlanCall = NonNullable<DailyTradeReview['planCall']>;
type Replay = DailyTradeReview['replay'];

const capital = (words: string): string => words.charAt(0).toUpperCase() + words.slice(1);

// The Plan's own words for the condition that made the call ("AXIO at or below $47.00"): the call names it by role and position (stop-2 is the
// second Stop), and the replay's Plan terms hold each in that order. Nothing is worked out here (ADR 0001).
function clauseOf(call: PlanCall, replay: Replay): string | undefined {
  const { condition } = call;
  const terms = replay?.planColumn?.terms;
  const leg = terms?.legs[0];
  if (!condition || !terms || !leg) return undefined;
  const ofRole = terms.conditions.filter((c) => c.role === condition.role);
  const position = Number(condition.id.split('-')[1]) - 1;
  const found = ofRole[position] ?? ofRole[0];
  return found && conditionClause(found, leg);
}

// W120: what the Plan says on the Review Date's Marks, and the condition behind it. An Unknown call has no approved words, so it says nothing.
export function planCallLine(call: PlanCall | undefined, replay: Replay): string | undefined {
  if (call?.call === 'Hold') return 'Inside its lines. The Plan says hold.';
  if (call?.call !== 'Out' || !call.condition) return undefined;
  const clause = clauseOf(call, replay);
  return `${call.condition.role === 'Stop' ? 'Past your Stop' : 'At your Target'}${clause ? ` (${capital(clause)})` : ''}. The Plan says out.`;
}

// "200 shares", "4 contracts": what the Position holds now, from the replay's newest session (else the Plan's own leg), with no side.
function heldCount(replay: Replay): string | undefined {
  const last = replay?.sessions.at(-1);
  if (last) return countWords(false, unsigned(last.heldQuantity), last.positions[0]?.instrument);
  const leg = replay?.planColumn?.terms.legs[0];
  return leg && countWords(false, leg.quantity, leg.instrument);
}

// W122: what the chosen Action means for the Plan, in the line under the choices.
export function actionMeaning(action: ActionChoice, call: PlanCall | undefined, replay: Replay): string {
  const role = call?.call === 'Out' ? call.condition?.role : undefined;
  if (action === 'Hold') return role ? `Holding leaves the Plan. Have a new ${role}? Choose Adjust.` : 'Keep it as it is.';
  if (action === 'Exit') {
    if (!role) return 'Exiting now leaves the Plan.';
    const short = replay?.planColumn?.terms.legs[0]?.side === 'Short';
    return `The Plan's exit: ${short ? 'buy back' : 'sell'} all ${heldCount(replay) ?? 'of it'} at the ${role}. No reason needed. Record the ${short ? 'buy-back' : 'sale'} once it is done.`;
  }
  if (action === 'Roll') return 'Close this one and open a later one. Record the roll once it is done.';
  return 'Move the Stop or Target, or change size. Record the change once it is done.';
}
