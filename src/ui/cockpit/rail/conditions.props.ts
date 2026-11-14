import type { OpenTradeDetail, PlannedTradeDetail, TradeDetailView } from '../../../app/types.ts';
import { dollarsAndR, unavailableLabel } from '../../figures.ts';
import { decimalMoney, decimalUnderlyingPrice, money, rMultiple, shortDate } from '../../format.ts';
import { conditionDirection } from '../../screens/option-words.ts';
import type { ShellProps } from '../placeholder.ts';
import type { ConditionItem, ConditionsCardProps } from './conditions.types.ts';

// The adapter from a Detail view to the Conditions card's props (A216, W5, W6): the only file of the card that reads `app/types`.
type Plan = PlannedTradeDetail['plan'];
type Condition = OpenTradeDetail['current']['evaluation']['conditions'][number];
type Reading = Extract<Condition['result'], { readonly kind: 'Value' }>['value'];
// A condition as the Plan states it, which is all rows 1 and 2 need.
interface Stated {
  readonly id: string;
  readonly role: 'Stop' | 'Target';
  readonly kind: 'UnderlyingPrice' | 'StructureValue';
  readonly boundary: string;
}

const isOption = (plan: Plan): boolean => plan.legs[0]?.instrument.kind === 'Option';

// A stock Plan's Stop sits below a Long entry and above a Short one; a Target is the other way.
const stockDirection = (role: Stated['role'], side: Plan['legs'][number]['side'] | undefined): 'below' | 'above' => ((side === 'Short') === (role === 'Stop') ? 'above' : 'below');

// What a condition says of its subject, in D7S's W6 words: "at or above $3.60", "at or below 41.00".
export function crossingWords(plan: Plan, condition: Stated): string {
  const leg = plan.legs[0];
  if (leg?.instrument.kind !== 'Option') return `at or ${stockDirection(condition.role, leg?.side)} ${decimalMoney(condition.boundary)}`;
  const word = conditionDirection(condition.role, condition.kind, { right: leg.instrument.right, side: leg.side });
  return `at or ${word} ${condition.kind === 'StructureValue' ? decimalMoney(condition.boundary) : decimalUnderlyingPrice(condition.boundary)}`;
}

// Row 2: the full condition on one line, in D7S's W6 words.
function conditionText(plan: Plan, condition: Stated): string {
  const subject = isOption(plan) && condition.kind === 'StructureValue' ? 'Option' : plan.underlying;
  return `${subject} ${crossingWords(plan, condition)}`;
}

// "−" before a Stop's amount, "+" before a Target's: formatting the Measure `evaluate` gave, never arithmetic (A206, ADR 0001).
const glyph = (role: Stated['role']): string => (role === 'Stop' ? '−' : '+');

// Row 3, muted, for a condition not yet crossed: what the Trade P&L changes by if the Mark (or the Underlying at expiration) reaches the condition.
function whyText(plan: Plan, condition: Condition, reading: Reading): string {
  const stock = !isOption(plan);
  return `Change in Trade P&L from the ${shortDate(reading.evidence.date)} ${stock ? 'Mark' : 'Marks'} if ${subjectText(plan, condition)} (${glyph(condition.role)}${rMultiple(reading.distance.planR)}).`;
}

// What the condition is reached by: a stock's Mark, an option's Mark, or the Underlying at expiration.
function subjectText(plan: Plan, condition: Condition): string {
  if (!isOption(plan)) return `${plan.underlying}'s Mark is ${decimalMoney(condition.boundary)}`;
  if (condition.kind === 'StructureValue') return `the option's Mark is ${decimalMoney(condition.boundary)}`;
  return `${plan.underlying} is at ${decimalUnderlyingPrice(condition.boundary)} at expiration`;
}

function measuredItem(plan: Plan, condition: Condition, waiting: boolean): ConditionItem {
  const item: ConditionItem = { id: condition.id, role: condition.role, nearest: condition.nearest === true, text: conditionText(plan, condition) };
  const { result } = condition;
  // An Unavailable condition says why, in the label's words, except while the Trade waits for its first Mark: then rows 1 and 2 only show, as
  // on a Closed Detail.
  if (result.kind === 'Unavailable' && !waiting) return { ...item, figure: unavailableLabel(result) };
  if (result.kind !== 'Value') return item;
  const reading = result.value;
  const figureTone = condition.role === 'Stop' ? ('loss' as const) : ('gain' as const);
  // A crossed condition says so, and how far past it the Mark is, in dollars and R (the Overrun).
  if (reading.status !== 'Active' && reading.overrun) {
    const past = `The ${shortDate(reading.evidence.date)} Mark is ${money(reading.overrun.dollars)} (${rMultiple(reading.overrun.planR)}) of Trade P&L past this ${condition.role}.`;
    return { ...item, figure: reading.status, figureTone, why: past };
  }
  return { ...item, figure: `${glyph(condition.role)}${money(reading.distance.dollars)}`, figureTone, why: whyText(plan, condition, reading) };
}

// A Plan's conditions in Plan order: Stops, then Targets, with the ids `evaluate` gives them.
const stated = (plan: Plan): Stated[] => [
  ...plan.stops.map((c, i) => ({ id: `stop-${i + 1}`, role: 'Stop' as const, kind: c.kind, boundary: c.price })),
  ...plan.targets.map((c, i) => ({ id: `target-${i + 1}`, role: 'Target' as const, kind: c.kind, boundary: c.price })),
];

const unmeasured = (plan: Plan): ConditionItem[] => stated(plan).map((c) => ({ id: c.id, role: c.role, nearest: false, text: conditionText(plan, c) }));

// W6: what the worst case is, when it can be measured. A long option loses its premium as the contract expires worthless; a Cash-Secured Put and
// a stock Position lose most if the Underlying goes to zero.
function worstCaseWords(plan: Plan): string {
  const leg = plan.legs[0];
  return leg?.instrument.kind === 'Option' && leg.side === 'Long' ? `the ${leg.instrument.right.toLowerCase()} expires worthless` : `${plan.underlying} goes to zero`;
}

const BEFORE_MARKS = 'Distances to each condition and the worst case arrive with the first Marks.';
const PLANNED = 'Distances to each condition arrive with the first Marks after entry.';
const EXPIRED = 'The contract expired, so its conditions are no longer measured.';

function openProps(view: OpenTradeDetail): ConditionsCardProps {
  const { plan } = view;
  const { evaluation } = view.current;
  // Once the contract expired its conditions are no longer measured (W6).
  if (view.settlement.length > 0) return { conditions: unmeasured(plan), summary: [{ text: EXPIRED }] };
  // Trade Views states when no Mark has valued the Trade yet (revision 90); the card infers nothing from the waiting figures.
  const waiting = view.current.firstMarksDue !== undefined;
  const conditions = evaluation.conditions.map((condition) => measuredItem(plan, condition, waiting));
  if (waiting) return { conditions, summary: [{ text: BEFORE_MARKS }] };
  // A Closed Detail has no open Position to measure.
  if ('terminalDisposition' in view) return { conditions, summary: [] };
  const worst = dollarsAndR(evaluation.worstCaseOngoingRisk, evaluation.worstCaseOngoingRiskInPlanR);
  return {
    conditions,
    summary: [
      { label: 'Worst case', text: evaluation.worstCaseOngoingRisk.kind === 'Value' ? `${worst} if ${worstCaseWords(plan)}` : worst },
      { label: 'Max reward', text: dollarsAndR(evaluation.maximumIncrementalReward, evaluation.maximumIncrementalRewardInPlanR) },
    ],
  };
}

export function conditionsProps(view: TradeDetailView): ConditionsCardProps | undefined {
  if ('current' in view) return openProps(view);
  // An incoherent Detail has no replay to measure against, so its card lists the Plan's conditions, rows 1 and 2 only, and says nothing beneath (W5).
  if ('recordedPositionChanges' in view) return { conditions: unmeasured(view.plan), summary: [] };
  return { conditions: unmeasured(view.plan), summary: [{ text: PLANNED }] };
}

// The shell hands a card its view as `unknown` (ShellProps), since a component may not name `app/types`.
export const conditionsPropsOf = ({ view }: ShellProps): ConditionsCardProps | undefined => (view === undefined ? undefined : conditionsProps(view as TradeDetailView));
