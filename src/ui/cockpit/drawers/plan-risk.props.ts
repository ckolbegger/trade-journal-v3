// The Plan and Risk drawer's adapter (A216): a Trade Detail's view to the drawer's finished display values. The only file of the drawer that
// reads `app/types`. The words are the moved sections' own (P96).
import type { OpenTradeDetail, TradeDetailView } from '../../../app/types.ts';
import { Rational } from '../../../domain/values/index.ts';
import { calculation, dollarsAndR, settlementDueFigure } from '../../figures.ts';
import { decimalMoney as price, decimalUnderlyingPrice, localTime, money, quantity, ratio, rMultiple, shortDate, tradeSummary, underlyingPrice } from '../../format.ts';
import { instrumentLabel } from '../../calculation-words.ts';
import { conditionDirection, contractCount, exerciseIntentText } from '../../screens/option-words.ts';
import { abs, changeTime, legText, measureText } from '../../screens/trade-detail/words.ts';
import type { PlanRiskDrawerProps, PlanRiskGroup, PlanRiskRow } from './plan-risk.types.ts';

// What the shell hands the drawer: the Detail's view and the Workspace zone.
export interface PlanRiskSource {
  readonly view: TradeDetailView;
  readonly timeZone: string;
}

type Condition = TradeDetailView['plan']['stops'][number];
type Leg = TradeDetailView['plan']['legs'][number];
type Evaluation = OpenTradeDetail['current']['evaluation'];
type Reading = Extract<Evaluation['conditions'][number]['result'], { readonly kind: 'Value' }>['value'];

// A Plan's Stops or Targets, one line per condition in Plan order (W6): a stock's is its price in dollars; an option's reads "MNO at or below
// 41.00" for an Underlying price (C3) and "Option at or above $3.60" for an option price.
function conditionLines(role: 'Stop' | 'Target', conditions: readonly Condition[], leg: Leg | undefined, symbol: string): readonly string[] {
  const option = leg?.instrument.kind === 'Option' ? { right: leg.instrument.right, side: leg.side } : undefined;
  return conditions.map((condition) => {
    if (!option) return price(condition.price);
    const direction = conditionDirection(role, condition.kind, option);
    return condition.kind === 'StructureValue' ? `Option at or ${direction} ${price(condition.price)}` : `${symbol} at or ${direction} ${decimalUnderlyingPrice(condition.price)}`;
  });
}

function planGroup(view: TradeDetailView, timeZone: string): PlanRiskGroup {
  const leg = view.plan.legs[0];
  const rows: PlanRiskRow[] = [];
  if (leg?.instrument.kind === 'Option') rows.push({ label: 'Contract', value: instrumentLabel(leg.instrument, timeZone), plain: true });
  rows.push({ label: 'Leg', value: leg ? legText(leg, timeZone) : '', plain: true });
  if (view.plan.exerciseIntent) rows.push({ label: 'Exercise Intent', value: exerciseIntentText(view.plan.exerciseIntent), plain: true });
  rows.push(
    { label: 'Intended entry', value: leg ? price(leg.intendedEntry) : '' },
    { label: 'Stop', value: conditionLines('Stop', view.plan.stops, leg, view.plan.underlying) },
    { label: 'Target', value: conditionLines('Target', view.plan.targets, leg, view.plan.underlying) },
    { label: 'Plan time', value: localTime(view.plan.planTime, timeZone), plain: true },
    { label: 'Account', value: `${view.labels.institution} — ${view.labels.account}`, plain: true },
  );
  return { id: 'plan', heading: 'Plan', rows };
}

// W6: what the worst case is. A long option loses its premium as the contract expires worthless; a Cash-Secured Put and a stock Position lose
// most if the Underlying goes to zero.
function worstCaseWords(view: TradeDetailView): string {
  const leg = view.plan.legs[0];
  return leg?.instrument.kind === 'Option' && leg.side === 'Long' ? `the ${leg.instrument.right.toLowerCase()} expires worthless` : `${view.plan.underlying} goes to zero`;
}

// Worst case and Max reward beneath the rows, in W6's words (W31).
function notesOf(view: OpenTradeDetail, evaluation: Evaluation, datedLabel: string, timeZone: string): PlanRiskGroup['notes'] {
  // Once the contract is due for settlement its conditions are no longer measured (W6).
  if (view.settlement.length > 0) return [{ text: 'The contract expired, so its conditions are no longer measured.' }];
  const worst = dollarsAndR(evaluation.worstCaseOngoingRisk, evaluation.worstCaseOngoingRiskInPlanR, undefined, timeZone);
  return [
    { label: 'Worst case', text: `${evaluation.worstCaseOngoingRisk.kind === 'Value' ? `${worst} if ${worstCaseWords(view)}` : worst}${datedLabel}` },
    { label: 'Max reward', text: `${dollarsAndR(evaluation.maximumIncrementalReward, evaluation.maximumIncrementalRewardInPlanR, undefined, timeZone)}${datedLabel}` },
  ];
}

// The Conditions group (W31, W32): each condition in Plan order with its trigger, its distance in its own price (A230, the figure Trade
// Analysis gave) and its Risk to stop or Reward to target. A crossed condition shows how far past it is, in the price and in dollars and R.
function conditionsGroup(view: TradeDetailView, timeZone: string): PlanRiskGroup | undefined {
  if (!('current' in view) || 'terminalDisposition' in view) return undefined;
  const leg = view.plan.legs[0];
  const option = leg?.instrument.kind === 'Option';
  // Without today's Mark (every condition Unavailable) the last Marks' figures stand in, labelled with their date (W31, as W21).
  const { datedLine } = view.current;
  // A contract due for settlement is not measured (W6), so no dated figures stand in for it.
  const dated = datedLine && !('settlement' in view && view.settlement.length > 0) && view.current.evaluation.conditions.every((c) => c.result.kind === 'Unavailable') ? datedLine : undefined;
  const evaluation = dated?.evaluation ?? view.current.evaluation;
  const { conditions } = evaluation;
  const datedLabel = dated ? ` · ${shortDate(dated.tradingDate)} ${option ? 'Marks' : 'Mark'}` : '';
  const triggers = {
    Stop: conditionLines('Stop', view.plan.stops, leg, view.plan.underlying),
    Target: conditionLines('Target', view.plan.targets, leg, view.plan.underlying),
  };
  // A figure with no reading says why at the figure length, where it lives (A222).
  // A contract due for settlement is not measured (W6), whichever reason its result carries on the expiration day.
  const due = 'settlement' in view ? view.settlement[0] : undefined;
  const figureOf = (c: (typeof conditions)[number], format: (reading: Reading) => string) =>
    due && c.result.kind === 'Unavailable' ? settlementDueFigure(due, timeZone) : calculation(c.result, format, timeZone);
  const rows = conditions.map((c) => {
    // An option's Underlying condition is measured in the Underlying's price (C3); every other condition in dollars.
    const priced = (value: Rational) => (option && c.kind === 'UnderlyingPrice' ? underlyingPrice(value) : money(value));
    const distanceText = ({ status, trigger }: Reading): string => {
      if (!trigger) return '';
      if (status === 'Active') return `${priced(trigger.distance)} away${datedLabel}`;
      return `${status} · ${priced(trigger.beyond ?? trigger.distance)} past${datedLabel}`;
    };
    const distance = figureOf(c, distanceText);
    const label = c.role === 'Stop' ? 'Risk to stop' : 'Reward to target';
    const risk = figureOf(c, ({ status, distance: toward, overrun }) => `${label} ${status === 'Active' || !overrun ? measureText(toward) : `${measureText(overrun)} past`}`);
    const at = Number(c.id.split('-')[1]) - 1;
    // Only an option's Underlying condition has one: the contract's value if the Underlying sits at the boundary at expiration.
    const basis = (c.role === 'Stop' ? view.baseline.stopBasis : view.baseline.targetBasis)[at];
    const atExpiration = option && c.kind === 'UnderlyingPrice' && basis?.valueAtExpiration ? money(basis.valueAtExpiration) : '';
    return [triggers[c.role][at] ?? '', distance, risk, atExpiration];
  });
  if (rows.length === 0) return undefined;
  return {
    id: 'conditions',
    heading: 'Conditions',
    rows: [],
    table: { columns: ['Condition', 'Distance', 'Risk or reward', 'Value at expiration'], rows },
    notes: notesOf(view, evaluation, datedLabel, timeZone),
  };
}

// Since the last Marks (W23): the lots bought after the latest Marks, measured from their own prices, as Trade Analysis gave them (`atEntry`,
// A54). Absent when no lot is newer than the Marks.
function sinceLastMarksGroup(view: TradeDetailView): PlanRiskGroup | undefined {
  if (!('current' in view) || 'terminalDisposition' in view) return undefined;
  const { atEntry } = view.current.evaluation;
  // Before the first Marks every lot is newer than them, and Entry Quality covers the entry (`firstMarksDue`, revision 90).
  if (!atEntry || view.current.firstMarksDue !== undefined) return undefined;
  const optionTrade = view.plan.legs[0]?.instrument.kind === 'Option';
  const inR = (dollars: Rational, planR: Rational) => `${money(dollars)} · ${rMultiple(planR)}`;
  return {
    id: 'since-last-marks',
    heading: 'Since the last Marks',
    rows: [
      { label: 'New lots', value: optionTrade ? contractCount(quantity(abs(atEntry.quantity))) : `${quantity(atEntry.quantity)} shares`, plain: true },
      { label: 'Average price of new lots', value: money(atEntry.averageEntry) },
      { label: 'Risk from that price', value: inR(atEntry.riskFromEntry, atEntry.riskFromEntryInPlanR) },
      { label: 'Reward from that price', value: inR(atEntry.rewardFromEntry, atEntry.rewardFromEntryInPlanR) },
    ],
  };
}

function baselineGroup(baseline: { readonly oneR: Rational; readonly originalPlannedReward: Rational; readonly rewardRiskRatio: Rational }): PlanRiskGroup {
  return {
    id: 'baseline',
    heading: 'Plan Baseline',
    rows: [
      { label: '1R (original risk)', value: money(baseline.oneR) },
      { label: 'Original reward', value: money(baseline.originalPlannedReward) },
      { label: 'Reward : risk', value: ratio(baseline.rewardRiskRatio) },
    ],
  };
}

// Entry Quality once the Entry Resolution Point is reached, and progress toward it before (A24). A Planned Detail has entered nothing.
function entryQualityGroup(view: TradeDetailView, timeZone: string): PlanRiskGroup {
  const base = { id: 'entry-quality', heading: 'Entry Quality' };
  const planned = view.plan.legs[0]?.quantity ?? '';
  if (!('positionChanges' in view)) return { ...base, rows: [], note: `Entry not yet resolved: ${quantity(Rational.of(0n))} of ${planned} entered` };
  const quality = view.entryQuality;
  // The Summary card's Entry status, "Entering" or "Resolved" (revision 96).
  const entry: PlanRiskRow = { label: 'Entry', value: view.entryStatus, plain: true };
  if (quality.kind !== 'Value') return { ...base, rows: [entry], note: `Entry not yet resolved: ${quantity(view.heldQuantity)} of ${planned} entered` };
  const resolution = view.entryResolution;
  const resolvedAt = resolution.kind === 'Resolved' ? view.positionChanges.find((c) => c.factId === resolution.positionChangeId) : undefined;
  const value = quality.value;
  return {
    ...base,
    rows: [
      entry,
      { label: 'Resolved at', value: resolvedAt ? `Position Change at ${localTime(resolvedAt.economicTime, timeZone)}` : '', plain: true },
      { label: 'Average entry', value: calculation(value.averageEntry, money) },
      { label: 'Actual initial risk', value: calculation(value.actualInitialRisk, money), second: calculation(value.riskInPlanR, rMultiple) },
      { label: 'Actual initial reward', value: calculation(value.actualInitialReward, money) },
      { label: 'Reward : risk', value: calculation(value.actualRewardRisk, ratio), second: `planned ${calculation(value.plannedRewardRisk, ratio)}` },
      { label: 'Slippage', value: calculation(value.slippage, money) },
      { label: 'Size', value: `${calculation(value.sizeRatio, ratio)}× planned quantity` },
    ],
  };
}

const FULFILLMENT: Record<string, string> = {
  Unfilled: 'Unfilled',
  PartiallyFilled: 'Partially filled',
  FilledAsPlanned: 'Filled as planned',
  FilledWithDeviation: 'Filled with Deviation',
};

// Each Planned Leg's fulfillment under the frozen Plan (A25), then each recorded Deviation occurrence in its current version with the Position
// Change that caused it. Deviations is absent when none were recorded; a Planned or incoherent Detail has neither group.
function fulfillmentGroups(view: TradeDetailView, timeZone: string): PlanRiskGroup[] {
  if (!('positionChanges' in view)) return [];
  const optionLeg = view.plan.legs[0]?.instrument.kind === 'Option';
  const items = view.deviations.map((occurrence) => {
    const current = occurrence.versions.at(-1)!;
    const unit = optionLeg ? contractCount(current.quantityAbovePlan ?? 0) : `${current.quantityAbovePlan} shares`;
    return {
      text: `Entry Size (Excess): ${unit} above plan, caused by the Position Change at ${changeTime(view, current.causingPositionChangeId, timeZone)}.`,
      superseded: current.status !== 'Active',
    };
  });
  return [
    {
      id: 'fulfillment',
      heading: 'Planned-Leg Fulfillment',
      rows: view.legFulfillment.map((f) => {
        const leg = view.plan.legs.find((l) => l.factId === f.plannedLegId);
        return { label: leg ? legText(leg, timeZone) : f.plannedLegId, value: FULFILLMENT[f.fulfillment]!, plain: true };
      }),
    },
    ...(items.length > 0 ? [{ id: 'deviations', heading: 'Deviations', rows: [], items }] : []),
  ];
}

export function planRiskProps({ view, timeZone }: PlanRiskSource): PlanRiskDrawerProps {
  const figures = conditionsGroup(view, timeZone);
  const since = sinceLastMarksGroup(view);
  return {
    // Only a Planned Detail: the others have it in Position.
    ...(!('positionChanges' in view) && 'summary' in view && view.summary && { tradeSummary: tradeSummary(view.summary, timeZone) }),
    groups: [
      planGroup(view, timeZone),
      ...(figures ? [figures] : []),
      ...(since ? [since] : []),
      ...('baseline' in view ? [baselineGroup(view.baseline)] : []),
      // An incoherent Detail has no derived figures, so no Entry Quality.
      ...('baseline' in view ? [entryQualityGroup(view, timeZone)] : []),
      ...fulfillmentGroups(view, timeZone),
    ],
  };
}
