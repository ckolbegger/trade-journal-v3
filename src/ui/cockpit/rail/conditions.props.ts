import type { MeterReading, OpenTradeDetail, PlannedTradeDetail, TradeDetailView } from '../../../app/types.ts';
import type { Rational } from '../../../domain/values/index.ts';
import { calculation, signed, unavailableLabel } from '../../figures.ts';
import { decimalMoney, decimalUnderlyingPrice, money, shortDate, underlyingPrice } from '../../format.ts';
import { conditionDirection } from '../../screens/option-words.ts';
import type { MeterFigure, MeterProps } from '../meter/meter.types.ts';
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
export function conditionText(plan: Plan, condition: Stated): string {
  const subject = isOption(plan) && condition.kind === 'StructureValue' ? 'Option' : plan.underlying;
  return `${subject} ${crossingWords(plan, condition)}`;
}

// Row 1's distance (W21), formatted from the reading's trigger in the condition's own price (A230, ADR 0001): "$1.80 away", or "3.00 away" for an
// option Trade's Underlying condition, which is measured in the Underlying's price.
function distanceText(plan: Plan, condition: Condition, reading: Pick<Reading, 'status' | 'trigger'>): string | undefined {
  const { trigger } = reading;
  if (!trigger) return undefined;
  const price = isOption(plan) && condition.kind === 'UnderlyingPrice' ? underlyingPrice : money;
  // A crossed condition says so, and how far past it the Mark is (W21).
  if (trigger.beyond !== null) return `${reading.status} · ${price(trigger.beyond)} past`;
  return `${price(trigger.distance)} away`;
}

// A231: with no reading today, the same condition at the last session with Marks, from the view's dated line, with its date: "2.50 away · Mon Oct 12
// Marks" ("Mark" for a stock Trade). A condition the dated Marks could not measure either shows nothing.
function datedDistance(plan: Plan, condition: Condition, dated: OpenTradeDetail['current']['datedLine']): string | undefined {
  const result = dated?.evaluation.conditions.find((c) => c.id === condition.id)?.result;
  if (!dated || result?.kind !== 'Value') return undefined;
  const distance = distanceText(plan, condition, result.value);
  return distance && `${distance} · ${shortDate(dated.tradingDate)} ${isOption(plan) ? 'Marks' : 'Mark'}`;
}

function measuredItem(plan: Plan, condition: Condition, waiting: boolean, dated: OpenTradeDetail['current']['datedLine']): ConditionItem {
  const item: ConditionItem = { id: condition.id, role: condition.role, text: conditionText(plan, condition) };
  const { result } = condition;
  const figureTone = condition.role === 'Stop' ? ('loss' as const) : ('gain' as const);
  // An Unavailable condition shows its dated distance, else says why in the label's words, except while the Trade waits for its first Mark: then
  // rows 1 and 2 only show, as on a Closed Detail.
  if (result.kind === 'Unavailable' && !waiting) {
    // A110: an Underlying condition whose own Mark is in reads it today, undated, even while the contract's Mark is missing.
    const current = condition.underlyingReading && distanceText(plan, condition, condition.underlyingReading);
    if (current !== undefined) return { ...item, figure: current, figureTone };
    const figure = datedDistance(plan, condition, dated);
    return figure === undefined ? { ...item, figure: unavailableLabel(result) } : { ...item, figure, figureTone };
  }
  if (result.kind !== 'Value') return item;
  const figure = distanceText(plan, condition, result.value);
  return figure === undefined ? item : { ...item, figure, figureTone };
}

// A Plan's conditions in Plan order: Stops, then Targets, with the ids `evaluate` gives them.
const stated = (plan: Plan): Stated[] => [
  ...plan.stops.map((c, i) => ({ id: `stop-${i + 1}`, role: 'Stop' as const, kind: c.kind, boundary: c.price })),
  ...plan.targets.map((c, i) => ({ id: `target-${i + 1}`, role: 'Target' as const, kind: c.kind, boundary: c.price })),
];

const unmeasured = (plan: Plan): ConditionItem[] => stated(plan).map((c) => ({ id: c.id, role: c.role, text: conditionText(plan, c) }));

const BEFORE_MARKS = 'Distances to each condition arrive with the first Marks.';
const PLANNED = 'Distances to each condition arrive with the first Marks after entry.';
const EXPIRED = 'The contract expired, so its conditions are no longer measured.';

// The slice of the replay this card reads (P130): the finished meter reading Trade Views holds with it. Declared here because a UI file may not
// import the coordinator's type; `TradeReplayView` is assignable to it.
export interface MeterReplay {
  readonly meter?: MeterReading;
}

// A finished dollar figure, as drawn and as worded. Turning a Rational into a position is drawing (A215), not working out a figure.
const figure = (value: Rational): MeterFigure => ({ value: Number(value.numerator) / Number(value.denominator), text: signed(money)(value) });

// The meter's props from a finished reading (A260): mapping and formatting only; the zone, the share, the amount past a rail and the
// direction against the session before are the domain's.
function meterProps(reading: MeterReading, timeZone: string | undefined): MeterProps | undefined {
  const { stop, target, banked, now, previous } = reading;
  if (stop.kind !== 'Value' || target.kind !== 'Value') return undefined;
  const nowProps: MeterProps['now'] =
    now.kind === 'Value'
      ? {
          kind: 'Value',
          ...figure(now.value.pnl),
          zone: now.value.zone === 'Between' ? 'Within' : now.value.zone,
          ...(now.value.share && { share: { percent: `${now.value.share.percent.numerator}%`, toward: now.value.share.toward } }),
          ...(now.value.pastBy && { pastBy: money(now.value.pastBy.dollars) }),
        }
      : // With no Mark the reason stands in the result's place, in the same words as the P&L card's figure.
        { kind: 'Unavailable', reason: calculation(now, money, timeZone) };
  return {
    size: 'detail',
    stop: figure(stop.value),
    target: figure(target.value),
    ...(banked.kind === 'Value' && { banked: figure(banked.value) }),
    now: nowProps,
    ...(previous && { previous: { ...figure(previous.pnl), dateLabel: shortDate(previous.tradingDate), ...(previous.direction && { direction: previous.direction }) } }),
  };
}

function openProps(view: OpenTradeDetail, replay: MeterReplay | undefined, timeZone: string | undefined): ConditionsCardProps {
  const { plan } = view;
  const { evaluation } = view.current;
  // Once the contract expired its conditions are no longer measured (W6).
  if (view.settlement.length > 0) return { conditions: unmeasured(plan), summary: [{ text: EXPIRED }] };
  // Trade Views states when no Mark has valued the Trade yet (revision 90); the card infers nothing from the waiting figures.
  const waiting = view.current.firstMarksDue !== undefined;
  const conditions = evaluation.conditions.map((condition) => measuredItem(plan, condition, waiting, view.current.datedLine));
  if (waiting) return { conditions, summary: [{ text: BEFORE_MARKS }] };
  // Nothing beneath the conditions: the worst case and the maximum reward live in Plan and Risk (W31).
  const meter = replay?.meter && meterProps(replay.meter, timeZone);
  return { ...(meter && { meter }), conditions, summary: [] };
}

export function conditionsProps(view: TradeDetailView, replay?: MeterReplay, timeZone?: string): ConditionsCardProps | undefined {
  // A Closed Detail reads no Marks, so it has no meter (P130).
  if ('current' in view) return openProps(view, 'terminalDisposition' in view ? undefined : replay, timeZone);
  // An incoherent Detail has no replay to measure against, so its card lists the Plan's conditions, rows 1 and 2 only, and says nothing beneath (W5).
  if ('recordedPositionChanges' in view) return { conditions: unmeasured(view.plan), summary: [] };
  return { conditions: unmeasured(view.plan), summary: [{ text: PLANNED }] };
}

// The shell hands a card its view as `unknown` (ShellProps), since a component may not name `app/types`.
export const conditionsPropsOf = ({ view, replay, timeZone }: ShellProps & { readonly replay?: unknown }): ConditionsCardProps | undefined =>
  view === undefined ? undefined : conditionsProps(view as TradeDetailView, replay as MeterReplay | undefined, timeZone);
