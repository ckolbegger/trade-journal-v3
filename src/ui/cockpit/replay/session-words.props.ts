import type { TradeReplayView } from '../../../app/types.ts';
import { formatDecimal, Rational } from '../../../domain/values/index.ts';
import { text, unavailableWords } from '../../calculation-words.ts';
import { calculation, signed } from '../../figures.ts';
import { decimalMoney, money, quantity, rMultiple, shortDate } from '../../format.ts';
import { conditionDirection } from '../../screens/option-words.ts';
import type { ReplayFrameSession, ReplayTone } from './replay.types.ts';
import { ratioWords, stakeOf } from './stake-words.props.ts';

// The session's words: the headline, how it is going, and what is at stake (W36 to W38). The adapter selects and formats finished
// values from the view; it works out no figure (ADR 0001, A256).
type ViewSession = TradeReplayView['sessions'][number];

// The part of `ReplayFrameSession` this module builds: the headline, how it is going, and what is at stake (W36 to W38).
export type SessionWords = Pick<ReplayFrameSession, 'headline' | 'howItIsGoing' | 'stake' | 'stakeSpoken'>;

const ZERO = Rational.of(0n);
const HUNDRED = Rational.of(100n);

const toneOf = (pnl: Rational): ReplayTone => {
  const sign = pnl.compare(ZERO);
  if (sign > 0) return 'Profit';
  if (sign < 0) return 'Loss';
  return 'Even';
};

// A fraction as a whole percent: formatting a finished share, not working one out.
const percent = (share: Rational): string => `${formatDecimal(share.mul(HUNDRED), 0)}%`;

export function headlineOf(session: ViewSession): SessionWords['headline'] {
  const { tradePnl } = session;
  if (tradePnl.kind !== 'Value') return { reason: calculation(tradePnl, money), tone: 'None' };
  const inR = session.figures?.currentMarkedPnlInPlanR;
  const figure = inR?.kind === 'Value' ? `${signed(money)(tradePnl.value)} · ${rMultiple(inR.value)}` : signed(money)(tradePnl.value);
  return { figure, tone: toneOf(tradePnl.value) };
}

// A281: the replay's top line. A missing Mark is the one reason with a line of its own; every other reason keeps its words. (The readout's
// row still reads `headlineOf`, whose reason is the figure-length words, until the readout's own task changes it.)
function topLineOf(session: ViewSession): SessionWords['headline'] {
  const { tradePnl } = session;
  return tradePnl.kind === 'Unavailable' ? { reason: text(unavailableWords(tradePnl, 'line', 'UTC')), tone: 'None' } : headlineOf(session);
}

// "Past the Stop's planned amount by $9.00, though DALE is still above $54.00.": the dollars are passed, the condition's price
// is not. The side the Underlying is still on is the opposite of the side its trigger lies on (conditionDirection).
function plannedAmountWords(role: 'Stop' | 'Target', dollars: Rational, session: ViewSession): string {
  const amount = `Past the ${role}'s planned amount by ${money(dollars)}`;
  const condition = session.figures?.conditions.find((c) => c.role === role && c.kind === 'UnderlyingPrice');
  const position = session.positions[0];
  if (!condition || !position) return `${amount}.`;
  const { instrument } = position;
  const leg = instrument.kind === 'Option' ? { right: instrument.right, side: position.quantity.compare(ZERO) < 0 ? 'Short' : 'Long' } as const : { right: 'Call', side: 'Long' } as const;
  const side = conditionDirection(role, 'UnderlyingPrice', leg) === 'below' ? 'above' : 'below';
  return `${amount}, though ${instrument.symbol} is still ${side} ${decimalMoney(condition.boundary)}.`;
}

type SessionCondition = NonNullable<ViewSession['figures']>['conditions'][number];

// F2: the session's own condition status (T9.4) says whether a line is crossed, whatever the dollars say: the condition's finished reading,
// or its Underlying reading while only the contract's Mark is missing (A110). The role's crossing is Breached for a Stop, Reached for a Target.
export function crossedCondition(session: ViewSession, role: 'Stop' | 'Target'): { readonly condition: SessionCondition; readonly beyond: Rational | null } | undefined {
  for (const condition of session.figures?.conditions ?? []) {
    const reading = condition.result.kind === 'Value' ? condition.result.value : condition.underlyingReading;
    if (condition.role === role && reading && reading.status !== 'Active') return { condition, beyond: reading.trigger?.beyond ?? null };
  }
  return undefined;
}

// "Stop breached: DALE $0.30 past $54.00.": the Underlying, how far past the condition's price it is, and the price.
function stopBreachedWords(crossed: NonNullable<ReturnType<typeof crossedCondition>>, session: ViewSession): string {
  const symbol = session.positions[0]?.instrument.symbol;
  if (!crossed.beyond || !symbol) return 'Stop breached.';
  return `Stop breached: ${symbol} ${money(crossed.beyond)} past ${decimalMoney(crossed.condition.boundary)}.`;
}

function howItIsGoingOf(session: ViewSession): string {
  const { tradePnl, final } = session;
  if (final) {
    const ending = final.kind === 'Sold' ? 'sold out' : `the ${final.contract.right.toLowerCase()} expired`;
    return `Final result: ${ending} ${shortDate(session.date)}.`;
  }
  const standing = session.figures?.standing;
  // A281: with no Mark the headline already says so, once; nothing repeats it.
  if (tradePnl.kind !== 'Value') return '';
  if (standing?.kind !== 'Value') return 'No Mark.';
  const { zone, pastBy, share } = standing.value;
  const stopCrossed = crossedCondition(session, 'Stop');
  if (zone === 'PastStop' && pastBy?.crossed) return `Past the Stop by ${money(pastBy.dollars)} (${rMultiple(pastBy.r)}).`;
  if (stopCrossed) return stopBreachedWords(stopCrossed, session);
  if (zone !== 'PastTarget' && crossedCondition(session, 'Target')) return 'Target reached.';
  if (zone === 'PastStop' && pastBy) return plannedAmountWords('Stop', pastBy.dollars, session);
  if (zone === 'PastTarget' && pastBy) {
    if (!pastBy.crossed) return plannedAmountWords('Target', pastBy.dollars, session);
    return pastBy.dollars.compare(ZERO) === 0 ? 'Target reached.' : `Target reached, ${money(pastBy.dollars)} past it.`;
  }
  if (share === undefined) return '';
  if (tradePnl.value.compare(ZERO) > 0) return `Ahead: ${percent(share)} of the way to the Target.`;
  return `Behind: ${percent(share)} of the way to the Stop.`;
}

export function sessionWords(view: TradeReplayView, index: number): SessionWords {
  const session = view.sessions[index];
  if (!session) throw new Error(`No session at ${index}`);
  const stake = stakeOf(view, index, session);
  return { headline: topLineOf(session), howItIsGoing: howItIsGoingOf(session), stake, ...stakeSpokenOf(view, session, stake) };
}

// A267: the stake sentence with the odds said in full, "about 8% chance of the Target first, 92% of the Stop first", where the sentence holds them.
// The Plan's own odds stay as their visible words: the view gives them no spoken form.
function stakeSpokenOf(view: TradeReplayView, session: ViewSession, stake: string | null): Pick<ReplayFrameSession, 'stakeSpoken'> {
  const words = ratioWords(view, session);
  if (stake === null || !words?.odds || !stake.includes(words.text)) return {};
  const ratio = words.text.slice(0, words.text.indexOf(' · '));
  return { stakeSpoken: stake.replace(words.text, `${ratio} · ${words.odds.spoken}`) };
}

type Marker = NonNullable<ViewSession['markers']>[number];
export const FILL_VERBS = { Buy: 'Bought', Sell: 'Sold', Expire: 'Expired' } as const;

// W41: "Sold 2 at $4.00", "Bought 100 at $50.00", "Expired"; each fill of a Position Change in turn.
export const markerWords = (marker: Marker): string =>
  marker.fills.map((fill) => (fill.price ? `${FILL_VERBS[fill.action]} ${quantity(fill.quantity)} at ${money(fill.price)}` : FILL_VERBS[fill.action])).join(', ');
