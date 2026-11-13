import type { OpenTradeDetail, PlannedTradeDetail, TradeDetailView } from '../../../app/types.ts';
import { isMarkLacking } from '../../calculation-words.ts';
import { calculation, dollarsAndR, unavailableLabel } from '../../figures.ts';
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

// Row 2: the full condition on one line, in D7S's W6 words.
function conditionText(plan: Plan, condition: Stated): string {
  const leg = plan.legs[0];
  if (leg?.instrument.kind !== 'Option') return `${plan.underlying} at or ${stockDirection(condition.role, leg?.side)} ${decimalMoney(condition.boundary)}`;
  const word = conditionDirection(condition.role, condition.kind, { right: leg.instrument.right, side: leg.side });
  return condition.kind === 'StructureValue' ? `Option at or ${word} ${decimalMoney(condition.boundary)}` : `${plan.underlying} at or ${word} ${decimalUnderlyingPrice(condition.boundary)}`;
}

// "−" before a Stop's amount, "+" before a Target's: formatting the Measure `evaluate` gave, never arithmetic (A206, ADR 0001).
const glyph = (role: Stated['role']): string => (role === 'Stop' ? '−' : '+');

// Row 3, muted, for a condition not yet crossed: what the Trade P&L changes by if the Mark (or the Underlying at expiration) reaches the condition.
function whyText(plan: Plan, condition: Condition, reading: Reading): string {
  const stock = !isOption(plan);
  const subject = stock
    ? `${plan.underlying}'s Mark is ${decimalMoney(condition.boundary)}`
    : condition.kind === 'StructureValue'
      ? `the option's Mark is ${decimalMoney(condition.boundary)}`
      : `${plan.underlying} is at ${decimalUnderlyingPrice(condition.boundary)} at expiration`;
  return `Change in Trade P&L from the ${shortDate(reading.evidence.date)} ${stock ? 'Mark' : 'Marks'} if ${subject} (${glyph(condition.role)}${rMultiple(reading.distance.planR)}).`;
}

function measuredItem(plan: Plan, condition: Condition): ConditionItem {
  const item: ConditionItem = { id: condition.id, role: condition.role, nearest: condition.nearest === true, text: conditionText(plan, condition) };
  const { result } = condition;
  // A condition whose Mark is lacking says so, in the label's words. One that is Unavailable for another reason (before the first Mark, past
  // the expiration) shows rows 1 and 2 only, as does a Closed Detail's.
  if (result.kind === 'Unavailable' && isMarkLacking(result)) return { ...item, figure: unavailableLabel(result) };
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
  const conditions = evaluation.conditions.map((condition) => measuredItem(plan, condition));
  // Nothing can be measured and no Mark is merely missing: the Trade is waiting for its first session to end.
  const waiting = evaluation.conditions.length > 0 && evaluation.conditions.every((c) => c.result.kind === 'Unavailable' && !isMarkLacking(c.result));
  if (waiting && evaluation.coverage.kind !== 'NotCovered') return { conditions, summary: [{ text: BEFORE_MARKS }] };
  // A Closed Detail has no open Position to measure.
  if ('terminalDisposition' in view) return { conditions, summary: [] };
  const worst = dollarsAndR(evaluation.worstCaseOngoingRisk, evaluation.worstCaseOngoingRiskInPlanR);
  return {
    conditions,
    summary: [
      { label: 'Worst case', text: evaluation.worstCaseOngoingRisk.kind === 'Value' ? `${worst} if ${worstCaseWords(plan)}` : worst },
      { label: 'Max reward', text: calculation(evaluation.maximumIncrementalReward, money) },
    ],
  };
}

export function conditionsProps(view: TradeDetailView): ConditionsCardProps | undefined {
  if ('current' in view) return openProps(view);
  // An incoherent Detail has no replay to measure against, so it has no card.
  if ('recordedPositionChanges' in view) return undefined;
  return { conditions: unmeasured(view.plan), summary: [{ text: PLANNED }] };
}

// The shell hands a card its view as `unknown` (ShellProps), since a component may not name `app/types`.
export const conditionsPropsOf = ({ view }: ShellProps): ConditionsCardProps | undefined => (view === undefined ? undefined : conditionsProps(view as TradeDetailView));
