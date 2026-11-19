import type { TradeReplayView } from '../../../app/types.ts';
import { Rational } from '../../../domain/values/index.ts';
import { signed } from '../../figures.ts';
import { money, ratioToOne } from '../../format.ts';

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

export function stakeOf(view: TradeReplayView, index: number, session: ViewSession): string | null {
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
  const plan = view.planColumn ? ` (the Plan was ${ratioToOne(view.planColumn.rewardRisk)})` : '';
  const rr = rewardRiskNow?.kind === 'Value' ? ` · ${ratioToOne(rewardRiskNow.value)}${plan}` : '';
  return `From here: ${money(risk.value)} at risk to the Stop · ${money(reward.value)} more to the Target${rr}.`;
}
