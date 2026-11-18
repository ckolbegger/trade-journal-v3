import type { TradeReplayView } from '../../../app/types.ts';
import { formatDecimal, Rational } from '../../../domain/values/index.ts';
import { calculation, signed } from '../../figures.ts';
import { decimalMoney, money, rMultiple, ratio, shortDate } from '../../format.ts';
import { conditionDirection } from '../../screens/option-words.ts';
import type { ReplayFrameSession, ReplayTone } from './replay.types.ts';

// The adapter selects and formats finished values from the view; it works out no figure (ADR 0001, A256).

type ViewSession = TradeReplayView['sessions'][number];

// The part of `ReplayFrameSession` this module builds: the headline, how it is going, and what is at stake (W36 to W38).
export type SessionWords = Pick<ReplayFrameSession, 'headline' | 'howItIsGoing' | 'stake'>;

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

function headlineOf(session: ViewSession): SessionWords['headline'] {
  const { tradePnl } = session;
  if (tradePnl.kind !== 'Value') return { reason: calculation(tradePnl, money), tone: 'None' };
  const inR = session.figures?.currentMarkedPnlInPlanR;
  const figure = inR?.kind === 'Value' ? `${signed(money)(tradePnl.value)} · ${rMultiple(inR.value)}` : signed(money)(tradePnl.value);
  return { figure, tone: toneOf(tradePnl.value) };
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

function howItIsGoingOf(session: ViewSession): string {
  const { tradePnl, final } = session;
  if (final) {
    const ending = final.kind === 'Sold' ? 'sold out' : `the ${final.contract.right.toLowerCase()} expired`;
    return `Final result: ${ending} ${shortDate(session.date)}.`;
  }
  const standing = session.figures?.standing;
  if (tradePnl.kind !== 'Value' || standing?.kind !== 'Value') return 'No Mark.';
  const { zone, pastBy, share } = standing.value;
  if (zone === 'PastStop' && pastBy) return pastBy.crossed ? `Past the Stop by ${money(pastBy.dollars)} (${rMultiple(pastBy.r)}).` : plannedAmountWords('Stop', pastBy.dollars, session);
  if (zone === 'PastTarget' && pastBy) {
    if (!pastBy.crossed) return plannedAmountWords('Target', pastBy.dollars, session);
    return pastBy.dollars.compare(ZERO) === 0 ? 'Target reached.' : `Target reached, ${money(pastBy.dollars)} past it.`;
  }
  if (share === undefined) return '';
  if (tradePnl.value.compare(ZERO) > 0) return `Ahead: ${percent(share)} of the way to the Target.`;
  return `Behind: ${percent(share)} of the way to the Stop.`;
}

// "Even at the Stop this Trade would end $316.00 ahead.", said only when the result at the Stop is above break-even.
function evenAtStopWords(session: ViewSession): string {
  const atStop = session.figures?.outcomes?.atStop;
  return atStop?.kind === 'Value' && atStop.value.compare(ZERO) > 0 ? ` Even at the Stop this Trade would end ${money(atStop.value)} ahead.` : '';
}

// A final session: nothing is at risk, and what was realized in the sessions before it was banked before the end.
function finalStakeWords(view: TradeReplayView, index: number): string {
  const banked = view.sessions[index - 1]?.realizedPnl;
  const bankedWords = banked && banked.compare(ZERO) !== 0 ? ` ${signed(money)(banked)} of the result was banked before the end.` : '';
  return `Nothing is at risk and nothing is left to gain.${bankedWords}`;
}

function stakeOf(view: TradeReplayView, index: number, session: ViewSession): string | null {
  if (session.final) return finalStakeWords(view, index);
  const sentence = stakeSentence(view, session);
  return sentence === null ? null : `${sentence}${evenAtStopWords(session)}`;
}

function stakeSentence(view: TradeReplayView, session: ViewSession): string | null {
  const figures = session.figures;
  const { standing, ongoingRiskToStop: risk, incrementalRewardToTarget: reward, rewardRiskNow } = figures ?? {};
  if (standing?.kind !== 'Value') return null;
  if (standing.value.zone === 'PastStop') {
    const worst = figures?.worstCaseOngoingRisk;
    const parts = [worst?.kind === 'Value' && `Worst case ${money(worst.value)} more`, reward?.kind === 'Value' && `${money(reward.value)} back up to the Target`].filter(Boolean);
    return parts.length === 0 ? null : `From here: ${parts.join(' · ')}.`;
  }
  if (risk?.kind !== 'Value' || reward?.kind !== 'Value') return null;
  if (standing.value.zone === 'PastTarget') {
    const { openProfitAtRisk } = standing.value;
    const max = figures?.maximumIncrementalReward;
    let cap = '';
    if (max?.kind === 'Unbounded') cap = ' · no cap above';
    else if (max?.kind === 'Value') cap = ` · at most ${money(max.value)} more`;
    const open = openProfitAtRisk ? ` (${money(openProfitAtRisk)} of it open profit)` : '';
    return `From here: ${money(risk.value)} at risk back to the Stop${open}${cap}.`;
  }
  const plan = view.planColumn ? ` (the Plan was ${ratio(view.planColumn.rewardRisk)} to 1)` : '';
  const rr = rewardRiskNow?.kind === 'Value' ? ` · ${ratio(rewardRiskNow.value)} to 1${plan}` : '';
  return `From here: ${money(risk.value)} at risk to the Stop · ${money(reward.value)} more to the Target${rr}.`;
}

export function sessionWords(view: TradeReplayView, index: number): SessionWords {
  const session = view.sessions[index];
  if (!session) throw new Error(`No session at ${index}`);
  return { headline: headlineOf(session), howItIsGoing: howItIsGoingOf(session), stake: stakeOf(view, index, session) };
}
