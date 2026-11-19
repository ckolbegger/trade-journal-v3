import type { TradeReplayView } from '../../../app/types.ts';
import { Rational } from '../../../domain/values/index.ts';
import { signed } from '../../figures.ts';
import { money, ratioToOne, rMultiple } from '../../format.ts';
import type { StakeOdds } from './replay.types.ts';
// The stake sentence (W38): "From here: $352.00 at risk to the Stop · ...". Finished values only; nothing is worked out here (ADR 0001).
type ViewSession = TradeReplayView['sessions'][number];

const ZERO = Rational.of(0n);

// "Even at the Stop this Trade would end $316.00 ahead.", said only when the result at the Stop is above break-even.
function evenAtStopWords(session: ViewSession): string {
  const atStop = session.figures?.outcomes?.atStop;
  return atStop?.kind === 'Value' && atStop.value.compare(ZERO) > 0 ? ` Even at the Stop this Trade would end ${money(atStop.value)} ahead.` : '';
}

// A final session: nothing is at risk, and what was realized in the sessions before it was banked before the end.
function finalStakeWords(view: TradeReplayView, index: number): string {
  const banked = view.sessions[index - 1]?.realizedPnl;
  const bankedWords = banked && banked.compare(ZERO) !== 0 ? ` ${signed(money)(banked)} of the result was ${banked.compare(ZERO) < 0 ? 'realized' : 'banked'} before the end.` : '';
  return `Nothing is at risk and nothing is left to gain.${bankedWords}`;
}

// A267: the estimated odds as the view's own pair of whole percents, selected and worded here; no percent is worked out (ADR 0001).
type Odds = NonNullable<Extract<NonNullable<NonNullable<ViewSession['figures']>['rewardRiskOdds']>, { kind: 'Value' }>['value']>;
const percentOf = (value: Rational): string => `${value.numerator / value.denominator}%`;

const ONE_PERCENT = Rational.of(1n, 100n);

// "about 8% : 92%"; "under 1% : over 99%" when a side is under one percent, which is no estimate to say "about" before (W60).
function oddsPair(odds: Odds, about: boolean): string {
  if (odds.targetFirst.compare(ONE_PERCENT) < 0) return 'under 1% : over 99%';
  if (odds.stopFirst.compare(ONE_PERCENT) < 0) return 'over 99% : under 1%';
  return `${about ? 'about ' : ''}${percentOf(odds.percent.targetFirst)} : ${percentOf(odds.percent.stopFirst)}`;
}

// "about 8% chance of the Target first, 92% of the Stop first" for a screen reader; the edges follow `oddsPair`.
function oddsSpoken(odds: Odds): string {
  if (odds.targetFirst.compare(ONE_PERCENT) < 0) return 'under 1% chance of the Target first, over 99% of the Stop first';
  if (odds.stopFirst.compare(ONE_PERCENT) < 0) return 'over 99% chance of the Target first, under 1% of the Stop first';
  return `about ${percentOf(odds.percent.targetFirst)} chance of the Target first, ${percentOf(odds.percent.stopFirst)} of the Stop first`;
}

// The ratio with the odds beside it, and the Plan's own: "11.69 to 1 · about 8% : 92%" and "0.29 to 1 · 78% : 22%". A view that carries no odds
// gives the ratio alone. Undefined where the session has no ratio.
export function ratioWords(view: TradeReplayView, session: ViewSession): { text: string; plan?: string; odds?: StakeOdds } | undefined {
  const { rewardRiskNow, rewardRiskOdds } = session.figures ?? {};
  if (rewardRiskNow?.kind !== 'Value') return undefined;
  return ratioWordsOf(rewardRiskNow.value, rewardRiskOdds?.kind === 'Value' ? rewardRiskOdds.value : undefined, view.planColumn);
}

// The same words from the finished figures themselves, for a screen that holds an evaluation and no replay (the Review card).
export function ratioWordsOf(now: Rational, odds: Odds | undefined, planColumn: { rewardRisk: Rational; odds?: Odds } | undefined): { text: string; plan?: string; odds?: StakeOdds } {
  const planPair = odds && planColumn?.odds ? ` · ${oddsPair(planColumn.odds, false)}` : '';
  const plan = planColumn ? `${ratioToOne(planColumn.rewardRisk)}${planPair}` : undefined;
  const text = `${ratioToOne(now)}${odds ? ` · ${oddsPair(odds, true)}` : ''}`;
  const note = 'Odds: Target first : Stop first, estimated with no edge and no time limit.';
  return { text, ...(plan && { plan }), ...(odds && { odds: { text, ...(plan && { planText: `(Plan ${plan})` }), spoken: oddsSpoken(odds), note } }) };
}

// W56: "Past the Stop by $300.00 (0.50R)"; a planned amount passed with the condition not crossed is no breach: "Past the Stop's amount by ...".
export function pastLineWords(role: 'Stop' | 'Target', pastBy: { dollars: Rational; r: Rational; crossed: boolean }): string {
  return `Past the ${role}${pastBy.crossed ? '' : "'s amount"} by ${money(pastBy.dollars)} (${rMultiple(pastBy.r)})`;
}

export function stakeOf(view: TradeReplayView, index: number, session: ViewSession): string | null {
  if (session.final) return finalStakeWords(view, index);
  const sentence = stakeSentence(view, session);
  return sentence === null ? null : `${sentence}${evenAtStopWords(session)}`;
}

function stakeSentence(view: TradeReplayView, session: ViewSession): string | null {
  const figures = session.figures;
  const { standing, ongoingRiskToStop: risk, incrementalRewardToTarget: reward } = figures ?? {};
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
  const words = ratioWords(view, session);
  const rr = words ? ` · ${words.text}${words.plan ? ` (the Plan was ${words.plan})` : ''}` : '';
  return `From here: ${money(risk.value)} at risk to the Stop · ${money(reward.value)} more to the Target${rr}.`;
}
