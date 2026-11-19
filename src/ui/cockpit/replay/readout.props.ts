import type { TradeReplayView } from '../../../app/types.ts';
import type { CalculationResult } from '../../../domain/calculation-result/index.ts';
import { instrumentKey, type Instrument } from '../../../domain/instrument/index.ts';
import { Rational } from '../../../domain/values/index.ts';
import { calculation, signed } from '../../figures.ts';
import { decimalMoney, decimalUnderlyingPrice, money, quantity, rMultiple, ratio, shortDate, underlyingPrice } from '../../format.ts';
import type { ReadoutGroup, ReadoutValue } from './replay.types.ts';
import { crossedCondition, headlineOf, markerWords } from './session-words.props.ts';

// The readout's rows (W43): finished values selected and formatted from the view; no figure is worked out here (ADR 0001, A256).
type ViewSession = TradeReplayView['sessions'][number];

const ZERO = Rational.of(0n);
const signedMoney = signed(money);
// A sign taken off for the words ("down $150.00"): the figure is only shown without its sign, not worked on.
const unsigned = (value: Rational): Rational => (value.numerator < 0n ? Rational.of(-value.numerator, value.denominator) : value);
const figure = (text: string): ReadoutValue => ({ kind: 'Figure', text });

// "up $190.00 since Tue Nov 10": a change the view measured from an earlier session, in the figure's own format.
function changeWords(change: ViewSession['change'] | undefined, format: (value: Rational) => string = money): string | undefined {
  if (!change) return undefined;
  const sign = change.dollars.compare(ZERO);
  return `${sign < 0 ? 'down' : 'up'} ${format(unsigned(change.dollars))} since ${shortDate(change.since)}`;
}

// A Calculation Result as a readout value: its finished figure (with the R beside it when given), or the words for why it has none.
function valueOf(result: CalculationResult<Rational> | undefined, format: (value: Rational) => string, inR?: CalculationResult<Rational>): ReadoutValue {
  if (!result) return { kind: 'NotApplicable', text: '' };
  if (result.kind === 'Value') return figure(inR?.kind === 'Value' ? `${format(result.value)} · ${rMultiple(inR.value)}` : format(result.value));
  return { kind: result.kind, text: calculation(result, format) };
}

type Row = ReadoutGroup['rows'][number];
const row = (label: string, value: ReadoutValue, change?: string, pnl?: ReadoutValue, heading?: string): Row => ({
  label,
  value,
  ...(change !== undefined && { change }),
  ...(pnl !== undefined && { pnl }),
  ...(heading !== undefined && { heading }),
});
// The Max reward row: "No cap above" with no result to show when unbounded, else its amount and the Trade's result there.
function maxRewardRow(f: NonNullable<ViewSession['figures']>, amount: ReadoutValue): Row {
  if (f.maximumIncrementalReward.kind === 'Unbounded') return row('At Max reward', { kind: 'Unbounded', text: 'No cap above' });
  return row('At Max reward', amount, undefined, valueOf(f.outcomes?.atMaxReward, signedMoney));
}

// How it is going (W43): the Trade P&L as the headline words it.
function goingGroup(session: ViewSession): ReadoutGroup {
  const { figure: text, reason } = headlineOf(session);
  const rows = [row('Trade P&L', text !== undefined ? figure(text) : { kind: 'Unavailable', text: reason ?? '' }, changeWords(session.change))];
  if (session.realizedPnl.compare(ZERO) !== 0) {
    rows.push(row('Banked', figure(signedMoney(session.realizedPnl))));
    // Open is the rest of the Trade P&L: shown beside Banked, never on a final session, which holds nothing open.
    const open = session.figures?.openPnl;
    if (open?.kind === 'Value' && !session.final) rows.push(row('Open', figure(signedMoney(open.value))));
  }
  return { title: session.final ? 'Final result' : 'How it is going', rows };
}

// At stake from here (W43): each row is a figure the view finished; the Plan's reward to risk stands beside the session's.
function stakeGroup(view: TradeReplayView, session: ViewSession): ReadoutGroup | undefined {
  const f = session.figures;
  if (!f) return undefined;
  const ratioWords = (v: Rational) => `${ratio(v)} to 1`;
  // Past a line the overrun stands in place of the risk or the reward, which is zero there, and the ratio says so.
  const standing = f.standing?.kind === 'Value' ? f.standing.value : undefined;
  const pastBy = standing?.pastBy;
  const overrun = (past: boolean) => (past && pastBy ? figure(`${money(pastBy.dollars)} · ${rMultiple(pastBy.r)}`) : undefined);
  const stopOverrun = overrun(standing?.zone === 'PastStop');
  const targetOverrun = overrun(standing?.zone === 'PastTarget');
  // Past a line by its planned amount with the condition not triggered is no breach (W37): shorter words say so.
  const triggered = pastBy?.crossed ?? true;
  // The condition status says the same as the headline (F2): a crossed condition ends the ratio whatever the dollars.
  const stopCrossed = crossedCondition(session, 'Stop') !== undefined;
  const targetCrossed = crossedCondition(session, 'Target') !== undefined;
  const stopBreached = triggered || stopCrossed;
  const targetReached = triggered || targetCrossed;
  let ending: string | undefined;
  if (stopCrossed) ending = 'Stop breached';
  else if (stopOverrun) {
    if (stopBreached) ending = 'Stop breached';
    else if (targetCrossed) ending = 'Target reached';
    else ending = 'Not triggered';
  } else if (targetOverrun) ending = targetReached ? 'Target reached' : 'Not triggered';
  else if (targetCrossed) ending = 'Target reached';
  const stopOverrunLabel = triggered ? 'Stop Overrun' : "Past Stop's amount";
  const targetOverrunLabel = triggered ? 'Target Overrun' : "Past Target's amount";
  const rows = [
    stopOverrun
      ? row(stopOverrunLabel, stopOverrun, undefined, valueOf(f.outcomes?.atStop, signedMoney), 'Current Risk')
      : row('At Stop', valueOf(f.ongoingRiskToStop, money, f.ongoingRiskToStopInPlanR), changeWords(session.riskChange), valueOf(f.outcomes?.atStop, signedMoney), 'Current Risk'),
    row('At Worst case', valueOf(f.worstCaseOngoingRisk, money, f.worstCaseOngoingRiskInPlanR), undefined, valueOf(f.outcomes?.atWorstCase, signedMoney)),
    targetOverrun
      ? row(targetOverrunLabel, targetOverrun, undefined, valueOf(f.outcomes?.atTarget, signedMoney), 'Remaining Reward')
      : row('At Target', valueOf(f.incrementalRewardToTarget, money, f.incrementalRewardToTargetInPlanR), changeWords(session.rewardChange), valueOf(f.outcomes?.atTarget, signedMoney), 'Remaining Reward'),
    maxRewardRow(f, valueOf(f.maximumIncrementalReward, money, f.maximumIncrementalRewardInPlanR)),
    ending ? row('Reward to risk', figure(ending)) : row('Reward to risk', valueOf(f.rewardRiskNow, ratioWords), view.planColumn ? `(Plan ${ratioWords(view.planColumn.rewardRisk)})` : undefined),
  ];
  return { title: 'At stake from here, whole Position', rows };
}

// "Call Mark" for a contract, "BREN Mark" for an Underlying or a stock.
const markLabel = (instrument: Instrument): string => `${instrument.kind === 'Option' ? instrument.right : instrument.symbol} Mark`;

// Marks (W43): each Instrument's Mark in the session, "No Mark" where it has none. An Underlying's price has no "$" on an option Trade (C3).
export function marksGroup(view: TradeReplayView, session: ViewSession): ReadoutGroup {
  const optionTrade = view.instruments.some((i) => i.kind === 'Option');
  return {
    title: 'Marks',
    rows: view.instruments.map((instrument) => {
      const found = session.marks.find((m) => instrumentKey(m.instrument) === instrumentKey(instrument));
      if (found?.resolution.kind !== 'Available') return row(markLabel(instrument), { kind: 'Unavailable', text: 'No Mark' });
      const bare = instrument.kind === 'Stock' && optionTrade;
      const { price } = found.resolution.mark;
      return row(markLabel(instrument), figure(bare ? decimalUnderlyingPrice(price) : decimalMoney(price)), changeWords(found.change, bare ? underlyingPrice : money));
    }),
  };
}

// "4 contracts", "short 2 contracts", "100 shares".
function heldWords(session: ViewSession): string {
  const unit = session.positions[0]?.instrument.kind === 'Option' ? 'contract' : 'share';
  const held = unsigned(session.heldQuantity);
  return `${session.heldQuantity.numerator < 0n ? 'short ' : ''}${quantity(held)} ${unit}${held.equals(Rational.of(1n)) ? '' : 's'}`;
}

// The Plan (W43): the results at the Stop and at the Target as planned, which the charts draw in the Plan column. The Plan's reward to risk
// stands in the session's own Reward to risk row.
function planGroup(view: TradeReplayView): ReadoutGroup | undefined {
  const plan = view.planColumn;
  if (!plan) return undefined;
  return { title: 'The Plan', rows: [row('At the Stop', figure(signedMoney(plan.atStop))), row('At the Target', figure(signedMoney(plan.atTarget)))] };
}

// The Position (W43): what is held, and each Execution of the session.
function positionGroup(session: ViewSession): ReadoutGroup {
  const held = session.heldQuantity.compare(ZERO) !== 0 ? [row('Held', figure(heldWords(session)))] : [];
  return { title: 'Position', rows: [...held, ...(session.markers ?? []).map((marker) => row(`Execution, ${shortDate(session.date)}`, figure(markerWords(marker))))] };
}

// A session without a Mark (A248): the results at the Stop and the Target, the Worst case and the Max reward read no Mark, so they stand; what needs the Mark reads "No Mark".
function gapStakeGroup(session: ViewSession): ReadoutGroup | undefined {
  const f = session.figures;
  const outcomes = f?.outcomes;
  if (!f || (outcomes?.atStop.kind !== 'Value' && outcomes?.atTarget.kind !== 'Value')) return undefined;
  const noMark = { kind: 'Unavailable', text: 'No Mark' } as const;
  const standing = (result: CalculationResult<Rational>, inR: CalculationResult<Rational>) => (result.kind === 'Value' ? valueOf(result, money, inR) : noMark);
  const rows = [
    row('At Stop', noMark, undefined, valueOf(outcomes.atStop, signedMoney), 'Current Risk'),
    row('At Worst case', standing(f.worstCaseOngoingRisk, f.worstCaseOngoingRiskInPlanR), undefined, valueOf(outcomes.atWorstCase, signedMoney)),
    row('At Target', noMark, undefined, valueOf(outcomes.atTarget, signedMoney), 'Remaining Reward'),
    maxRewardRow(f, standing(f.maximumIncrementalReward, f.maximumIncrementalRewardInPlanR)),
    row('Reward to risk', noMark),
  ];
  return { title: 'At stake from here, whole Position', rows };
}

export function readoutOf(view: TradeReplayView, session: ViewSession): ReadoutGroup[] {
  // A final session has nothing at stake; a session without a Mark keeps only the figures that need none.
  let staked: ReadoutGroup | undefined;
  if (session.final) staked = undefined;
  else if (session.tradePnl.kind === 'Value') staked = stakeGroup(view, session);
  else staked = gapStakeGroup(session);
  const groups = [goingGroup(session), staked, marksGroup(view, session), positionGroup(session), planGroup(view)];
  return groups.filter((group): group is ReadoutGroup => group !== undefined && group.rows.length > 0);
}
