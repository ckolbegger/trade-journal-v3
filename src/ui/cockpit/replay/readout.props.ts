import type { TradeReplayView } from '../../../app/types.ts';
import type { CalculationResult } from '../../../domain/calculation-result/index.ts';
import { instrumentKey, type Instrument } from '../../../domain/instrument/index.ts';
import { Rational } from '../../../domain/values/index.ts';
import { isMarkLacking } from '../../calculation-words.ts';
import { calculation, signed } from '../../figures.ts';
import { decimalMoney, money, quantity, rMultiple, shortDate, summaryStrike } from '../../format.ts';
import { conditionDirection } from '../../screens/option-words.ts';
import type { PlanBlock, ReadoutGroup, ReadoutValue, StakeGrid, StakePastLineRow, StakeRow } from './replay.types.ts';
import { REASONS, shareWords, TAG, volatilityWords, type Estimate } from './chips.props.ts';
import { crossedCondition, headlineOf, markerPlanWords } from './session-words.props.ts';
import { pastLineWords, ratioWords, ratioWordsOf } from './stake-words.props.ts';

// The readout's rows (W43): finished values selected and formatted from the view; no figure is worked out here (ADR 0001, A256).
type ViewSession = TradeReplayView['sessions'][number];

const ZERO = Rational.of(0n);
const signedMoney = signed(money);
// A sign taken off for the words ("down $150.00"): the figure is only shown without its sign, not worked on.
export const unsigned = (value: Rational): Rational => (value.numerator < 0n ? Rational.of(-value.numerator, value.denominator) : value);
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
  // Without a figure the row is the dash named "No Mark" (W61) when the Mark is missing or Acknowledged unavailable; the reason is said once,
  // in the replay's top line (A281). Any other reason keeps its words: the dash's name must be true.
  const { figure: text, reason } = headlineOf(session);
  const { tradePnl } = session;
  const noMark = tradePnl.kind === 'Unavailable' && isMarkLacking(tradePnl);
  function tradePnlValue(): ReadoutValue {
    if (text !== undefined) {
      return figure(text);
    }
    if (noMark) {
      return NO_MARK;
    }
    return { kind: 'Unavailable', text: reason ?? '' };
  }
  const rows = [row('Trade P&L', tradePnlValue(), changeWords(session.change))];
  if (session.realizedPnl.compare(ZERO) !== 0) {
    // W57 (decision 120): what was realized is "Realized", for a gain as for a loss.
    rows.push(row('Realized', figure(signedMoney(session.realizedPnl))));
    // Open is the rest of the Trade P&L: shown beside Realized, never on a final session, which holds nothing open.
    const open = session.figures?.openPnl;
    if (open?.kind === 'Value' && !session.final) rows.push(row('Open', figure(signedMoney(open.value))));
  }
  return { title: session.final ? 'Final result' : 'How it is going', rows };
}

// "Past the Stop by $300.00 (0.50R) · at Stop −$740.00": a Trade past a line, in one row. A planned amount passed with the condition not crossed is no breach (W37).
function pastLineRow(role: 'Stop' | 'Target', pastBy: { dollars: Rational; r: Rational; crossed: boolean }, outcome: CalculationResult<Rational> | undefined): StakePastLineRow {
  const line = pastLineWords(role, pastBy);
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

// "4 contracts", "short 2 contracts", "100 shares": a quantity (without its sign) of an Instrument's units.
function countWords(short: boolean, count: Rational, instrument: Instrument | undefined): string {
  return `${short ? 'short ' : ''}${quantity(count)} ${instrument?.kind === 'Option' ? 'contract' : 'share'}${count.equals(Rational.of(1n)) ? '' : 's'}`;
}

const heldWords = (session: ViewSession): string => countWords(session.heldQuantity.numerator < 0n, unsigned(session.heldQuantity), session.positions[0]?.instrument);

type PlanTerms = NonNullable<NonNullable<TradeReplayView['planColumn']>['terms']>;

// "4 contracts", "short 6 contracts", "200 shares": a Planned Leg's quantity as the Plan confirmed it.
export const legWords = (leg: PlanTerms['legs'][number]): string => countWords(leg.side === 'Short', leg.quantity, leg.instrument);

// "Stop: call at or below $0.80 · P&L if hit −$324.00": what the price is a price of (the option, or the Underlying), its side, and the
// Trade's own result there as the view finished it (A269).
function conditionWords(condition: PlanTerms['conditions'][number], leg: PlanTerms['legs'][number]): string {
  return `${condition.role}: ${conditionClause(condition, leg)} · P&L if hit ${signedMoney(condition.pnlIfHit)}`;
}

// "AXIO at or below $47.00", "call at or above $4.00": what the price is a price of, its side and the price. The Plan block and the Review card's Plan box both say it.
export function conditionClause(condition: PlanTerms['conditions'][number], leg: PlanTerms['legs'][number]): string {
  const right = leg.instrument.kind === 'Option' ? leg.instrument.right : 'Call';
  const direction = conditionDirection(condition.role, condition.priceOf === 'Option' ? 'StructureValue' : 'UnderlyingPrice', { right, side: leg.side });
  const of = condition.priceOf === 'Option' ? right.toLowerCase() : leg.instrument.symbol;
  return `${of} at or ${direction} ${money(condition.price)}`;
}

// The Plan block (decision 5, W62): the Plan's entry, the contract's strike, every Stop and Target, and the Plan's reward to risk.
export function planBlockOf(view: TradeReplayView): PlanBlock | undefined {
  const plan = view.planColumn;
  const leg = plan?.terms.legs[0];
  if (!plan || !leg) return undefined;
  const contract = view.instruments.find((i) => i.kind === 'Option');
  return {
    title: 'The Plan',
    rows: [
      ...plan.terms.legs.map((l) => `Entry: ${legWords(l)} at ${money(l.entryPrice)}`),
      // W40's words, as the price chart's line names it: the chart's figures are all off the chart too.
      ...(contract?.kind === 'Option' ? [`Strike ${summaryStrike(contract.strike)}`] : []),
      ...plan.terms.conditions.map((c) => conditionWords(c, leg)),
      `Reward to risk: ${ratioWordsOf(plan.rewardRisk, plan.odds, plan).plan}`,
    ],
  };
}

// The Position (W43): what is held, and each Execution of the session.
function positionGroup(session: ViewSession): ReadoutGroup {
  const held = session.heldQuantity.compare(ZERO) !== 0 ? [row('Held', figure(heldWords(session)))] : [];
  return { title: 'Position', rows: [...held, ...(session.markers ?? []).map((marker) => row(`${marker.kind}, ${shortDate(session.date)}`, figure(markerPlanWords(marker))))] };
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

// P121, W47: an estimate's row, tagged "estimate" where it holds a figure (a stock's share count is exact and has no tag); where there is none it reads
// "Unavailable" with the reason as its hover text (W49); none at all where the estimate does not apply (stock's implied volatility).
function estimateRow(label: string, estimate: Estimate, words: (found: Estimate) => { readonly text: string; readonly estimate: boolean } | undefined): Row | undefined {
  if (estimate.kind === 'NotApplicable') return undefined;
  const found = words(estimate);
  if (found) return { label, value: figure(found.text), ...(found.estimate && { tag: TAG }) };
  return { label, value: { kind: 'Unavailable', text: 'Unavailable' }, ...(estimate.kind === 'Unavailable' && REASONS[estimate.reason] && { term: REASONS[estimate.reason]! }) };
}

// The implied volatility closes the Marks group and the share equivalent the Position group; a session that holds nothing has no estimates.
function withEstimates(groups: ReadoutGroup[], session: ViewSession): ReadoutGroup[] {
  const estimates = session.estimates;
  if (!estimates) return groups;
  const volatility = estimateRow('Implied volatility', estimates.impliedVolatility, (found) => (found.kind === 'Estimate' ? { text: volatilityWords(found)!, estimate: true } : undefined));
  const shares = estimateRow('Behaves like', estimates.shareEquivalent, shareWords);
  const added: Record<string, Row | undefined> = { Marks: volatility, Position: shares };
  return groups.map((group) => {
    const extra = added[group.title];
    return extra ? { ...group, rows: [...group.rows, extra] } : group;
  });
}

export function readoutOf(view: TradeReplayView, session: ViewSession): ReadoutGroup[] {
  // A final session has nothing at stake; a session without a Mark keeps only the figures that need none.
  let staked: ReadoutGroup | undefined;
  if (session.final) staked = undefined;
  else if (session.tradePnl.kind === 'Value') staked = stakeGroup(view, session);
  else staked = gapStakeGroup(session);
  const groups = withEstimates([goingGroup(session), staked, marksGroup(view, session), positionGroup(session)].filter((group): group is ReadoutGroup => group !== undefined), session);
  return groups.filter((group) => group.rows.length > 0 || group.grid !== undefined);
}
