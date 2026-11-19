import type { TradeReplayView } from '../../../app/types.ts';
import type { CalculationResult } from '../../../domain/calculation-result/index.ts';
import { instrumentKey, type Instrument } from '../../../domain/instrument/index.ts';
import { Rational } from '../../../domain/values/index.ts';
import { calculation, signed } from '../../figures.ts';
import { decimalMoney, money, quantity, rMultiple, shortDate } from '../../format.ts';
import type { ReadoutGroup, ReadoutValue, StakeGrid, StakePastLineRow, StakeRow } from './replay.types.ts';
import { crossedCondition, headlineOf, markerWords } from './session-words.props.ts';
import { ratioWords } from './stake-words.props.ts';

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

// A Calculation Result as a readout value: its finished figure, or the words for why it has none.
function valueOf(result: CalculationResult<Rational> | undefined, format: (value: Rational) => string): ReadoutValue {
  if (!result) return { kind: 'NotApplicable', text: '' };
  if (result.kind === 'Value') return figure(format(result.value));
  return { kind: result.kind, text: calculation(result, format) };
}

type Row = ReadoutGroup['rows'][number];
const row = (label: string, value: ReadoutValue, change?: string): Row => ({ label, value, ...(change !== undefined && { change }) });
type Figures = NonNullable<ViewSession['figures']>;
// A dash named "No Mark" stands in a cell that needs the Mark (W61).
export const NO_MARK: ReadoutValue = { kind: 'Unavailable', text: 'No Mark' };
const EMPTY: ReadoutValue = { kind: 'NotApplicable', text: '' };

// One grid row (A278): the amount from here, its R and the Trade's result there, one figure to a cell. A figure without a value says why in its
// amount's cell and leaves the R cell empty; `noMark` puts the dash in both cells and keeps the result, which needs no Mark.
function stakeRow(label: string, term: string, amount: CalculationResult<Rational> | undefined, inR: CalculationResult<Rational> | undefined, outcome: CalculationResult<Rational> | undefined, noMark = false): StakeRow {
  const rCell = amount?.kind === 'Value' && inR?.kind === 'Value' ? figure(rMultiple(inR.value)) : EMPTY;
  return { label, term, fromHere: noMark ? NO_MARK : valueOf(amount, money), r: noMark ? NO_MARK : rCell, pnlIfHit: valueOf(outcome, signedMoney) };
}

// The Max reward row: "No cap above" across its row when unbounded, with no R and no result; else its amount, R and the Trade's result there.
// Both extremes carry the Plan's weight (decision 6, A268): a view without it is Main, so nothing is dimmed by mistake.
function maxRewardRow(f: Figures, noMark = false): StakeRow {
  const term = 'Maximum Incremental Reward';
  const weight = f.extremes ?? 'Main';
  if (f.maximumIncrementalReward.kind === 'Unbounded') return { label: 'At Max reward', term, fromHere: { kind: 'Unbounded', text: 'No cap above' }, weight };
  return { ...stakeRow('At Max reward', term, f.maximumIncrementalReward, f.maximumIncrementalRewardInPlanR, f.outcomes?.atMaxReward, noMark), weight };
}

function worstCaseRow(f: Figures, outcome: CalculationResult<Rational> | undefined, noMark = false): StakeRow {
  return { ...stakeRow('At Worst case', 'Worst-Case Ongoing Risk', f.worstCaseOngoingRisk, f.worstCaseOngoingRiskInPlanR, outcome, noMark), weight: f.extremes ?? 'Main' };
}

// How it is going (W43): the Trade P&L as the headline words it.
function goingGroup(session: ViewSession): ReadoutGroup {
  const { figure: text, reason } = headlineOf(session);
  const rows = [row('Trade P&L', text !== undefined ? figure(text) : { kind: 'Unavailable', text: reason ?? '' }, changeWords(session.change))];
  if (session.realizedPnl.compare(ZERO) !== 0) {
    // W57: a loss that was realized is "Realized"; a gain keeps "Banked".
    rows.push(row(session.realizedPnl.compare(ZERO) < 0 ? 'Realized' : 'Banked', figure(signedMoney(session.realizedPnl))));
    // Open is the rest of the Trade P&L: shown beside Banked, never on a final session, which holds nothing open.
    const open = session.figures?.openPnl;
    if (open?.kind === 'Value' && !session.final) rows.push(row('Open', figure(signedMoney(open.value))));
  }
  return { title: session.final ? 'Final result' : 'How it is going', rows };
}

// "Past the Stop by $300.00 (0.50R) · at Stop −$740.00": a Trade past a line, in one row. A planned amount passed with the condition not crossed is no breach (W37).
function pastLineRow(role: 'Stop' | 'Target', pastBy: { dollars: Rational; r: Rational; crossed: boolean }, outcome: CalculationResult<Rational> | undefined): StakePastLineRow {
  const line = `Past the ${role}${pastBy.crossed ? '' : "'s amount"} by ${money(pastBy.dollars)} (${rMultiple(pastBy.r)})`;
  return { text: `${line} · at ${role} ${valueOf(outcome, signedMoney).text}`, term: `${role} Overrun` };
}

// At stake from here (W43): each row is a figure the view finished; the Plan's reward to risk stands beside the session's.
function stakeGroup(view: TradeReplayView, session: ViewSession): ReadoutGroup | undefined {
  const f = session.figures;
  if (!f) return undefined;
  // Past a line one row says by how much, in place of the risk or the reward, which is zero there.
  const standing = f.standing?.kind === 'Value' ? f.standing.value : undefined;
  const pastBy = standing?.pastBy;
  const pastStop = standing?.zone === 'PastStop' && pastBy;
  const pastTarget = standing?.zone === 'PastTarget' && pastBy;
  const pastLine = pastStop || pastTarget;
  // No ratio, no row: past a line, or with a condition crossed (the headline says so, F2), or where the view has none.
  const crossed = crossedCondition(session, 'Stop') !== undefined || crossedCondition(session, 'Target') !== undefined;
  const noRatio = pastLine || crossed || f.rewardRiskNow.kind !== 'Value';
  const ratio = ratioWords(view, session);
  const rows = noRatio || !ratio ? [] : [row('Reward to risk', figure(ratio.text), ratio.plan ? `(Plan ${ratio.plan})` : undefined)];
  const atStop = stakeRow('At Stop', 'Ongoing Risk to Stop', f.ongoingRiskToStop, f.ongoingRiskToStopInPlanR, f.outcomes?.atStop);
  const atWorst = worstCaseRow(f, f.outcomes?.atWorstCase);
  const atTarget = stakeRow('At Target', 'Incremental Reward to Target', f.incrementalRewardToTarget, f.incrementalRewardToTargetInPlanR, f.outcomes?.atTarget);
  const grid: StakeGrid = {
    columns: ['From here', 'R', 'P&L if hit'],
    ...(!noRatio && ratio?.odds && { odds: ratio.odds }),
    ...(pastLine && { pastLine: pastLineRow(pastStop ? 'Stop' : 'Target', pastLine, pastStop ? f.outcomes?.atStop : f.outcomes?.atTarget) }),
    groups: [{ heading: 'Current Risk', rows: pastStop ? [atWorst] : [atStop, atWorst] }, { heading: 'Remaining Reward', rows: pastTarget ? [maxRewardRow(f)] : [atTarget, maxRewardRow(f)] }],
  };
  return { title: 'At stake from here, whole Position', rows, grid };
}

// "Call Mark" for a contract, "BREN Mark" for an Underlying or a stock.
const markLabel = (instrument: Instrument): string => `${instrument.kind === 'Option' ? instrument.right : instrument.symbol} Mark`;

// Marks (W43): each Instrument's Mark in the session, "No Mark" where it has none. Every price carries its "$" in the replay (W58).
export function marksGroup(view: TradeReplayView, session: ViewSession): ReadoutGroup {
  return {
    title: 'Marks',
    rows: view.instruments.map((instrument) => {
      const found = session.marks.find((m) => instrumentKey(m.instrument) === instrumentKey(instrument));
      if (found?.resolution.kind !== 'Available') return row(markLabel(instrument), NO_MARK);
      return row(markLabel(instrument), figure(decimalMoney(found.resolution.mark.price)), changeWords(found.change));
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
  const atStop = stakeRow('At Stop', 'Ongoing Risk to Stop', f.ongoingRiskToStop, f.ongoingRiskToStopInPlanR, outcomes.atStop, true);
  const atWorst = worstCaseRow(f, outcomes.atWorstCase, f.worstCaseOngoingRisk.kind !== 'Value');
  const atTarget = stakeRow('At Target', 'Incremental Reward to Target', f.incrementalRewardToTarget, f.incrementalRewardToTargetInPlanR, outcomes.atTarget, true);
  const grid: StakeGrid = {
    columns: ['From here', 'R', 'P&L if hit'],
    groups: [{ heading: 'Current Risk', rows: [atStop, atWorst] }, { heading: 'Remaining Reward', rows: [atTarget, maxRewardRow(f, f.maximumIncrementalReward.kind !== 'Value')] }],
  };
  return { title: 'At stake from here, whole Position', rows: [row('Reward to risk', NO_MARK)], grid };
}

export function readoutOf(view: TradeReplayView, session: ViewSession): ReadoutGroup[] {
  // A final session has nothing at stake; a session without a Mark keeps only the figures that need none.
  let staked: ReadoutGroup | undefined;
  if (session.final) staked = undefined;
  else if (session.tradePnl.kind === 'Value') staked = stakeGroup(view, session);
  else staked = gapStakeGroup(session);
  const groups = [goingGroup(session), staked, marksGroup(view, session), positionGroup(session), planGroup(view)];
  return groups.filter((group): group is ReadoutGroup => group !== undefined && (group.rows.length > 0 || group.grid !== undefined));
}
