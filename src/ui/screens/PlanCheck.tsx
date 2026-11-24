import type { ReactNode } from 'react';
import type { OpenTradeDetail, TradeDetailView } from '../../app/types.ts';
import { measurePlanExit, type PlanExitInput, type PlanExitMeasure, type PlanExitReason } from '../../domain/plan-exit/index.ts';
import { parseDecimal } from '../../domain/values/index.ts';
import { decimalMoney, quantity, shortDate } from '../format.ts';
import { conditionDirection } from './option-words.ts';

export type PlanExit = NonNullable<OpenTradeDetail['planExit']>;
type Leg = TradeDetailView['plan']['legs'][number];

// "200", "1": a held quantity as a count, the sign and trailing zeros left off.
const countOf = (signed: string): string => {
  const parsed = parseDecimal(signed.replace('-', ''));
  return parsed.ok ? quantity(parsed.value) : signed;
};
const noun = (count: string, leg: Leg): string => `${count} ${leg.instrument.kind === 'Option' ? 'contract' : 'share'}${count === '1' ? '' : 's'}`;

// "XYZ at or below $47.50", "call at or above $4.00": what the price is a price of, its side and the price (the Plan block's words).
function clauseOf(condition: PlanExit['positions'][number]['conditions'][number], leg: Leg): string {
  const option = leg.instrument.kind === 'Option' ? leg.instrument : undefined;
  const priceOf = option && condition.pricedInTradedInstrument ? 'StructureValue' : 'UnderlyingPrice';
  const direction = conditionDirection(condition.role, priceOf, { right: option?.right ?? 'Call', side: leg.side });
  const of = priceOf === 'StructureValue' ? option!.right.toLowerCase() : leg.instrument.symbol;
  return `${of} at or ${direction} ${decimalMoney(condition.boundary)}`;
}

// W132: one sentence for each way the sale leaves the Plan.
function reasonWords(reason: PlanExitReason, roles: readonly string[], leg: Leg): string {
  switch (reason.kind) {
    case 'BeforeCondition':
      return roles.length === 1 ? `The ${roles[0]} is not reached.` : 'Neither the Stop nor the Target is reached.';
    case 'HeldPast':
      return `The ${reason.line} was reached ${shortDate(reason.since)}. You held ${reason.sessions} ${reason.sessions === 1 ? 'session' : 'sessions'} past it.`;
    case 'PartOnly':
      return `The Plan's exit is all ${noun(countOf(reason.held), leg)}. This sells ${countOf(reason.sold)}.`;
  }
}

export interface SaleCheck {
  readonly position: PlanExit['positions'][number];
  // The measure of the sale as typed; none until the quantity is one the sale can have.
  readonly measure: PlanExitMeasure | undefined;
  // The lines the sale follows, when it follows the Plan.
  readonly at: readonly string[] | undefined;
  // A310: a sale of the whole Position carries the reason of the Trade's most recent Action when that is an Exit with one.
  readonly carried: { readonly reviewDate: string; readonly reason: string } | undefined;
}

// The save's own reading of a sale (A309): one measure per Execution's price, and the sale follows the Plan when any of them does, else the first.
// `total` is the quantities entered added up as a decimal.
export function checkSale(planExit: PlanExit, action: 'Buy' | 'Sell', total: string, prices: readonly string[]): SaleCheck | undefined {
  const position = planExit.positions[0];
  if (!position) return undefined;
  const inputOf = (price: string, conditions = position.conditions): PlanExitInput => ({ held: position.quantity, change: { side: action, quantity: total, price: price.trim() }, conditions, heldPast: planExit.heldPast });
  const measures = prices.map((price) => ({ price, measure: measurePlanExit(inputOf(price)) }));
  const followed = measures.find((m) => m.measure?.kind === 'Follows');
  const at = followed && position.conditions.filter((c) => measurePlanExit(inputOf(followed.price, [c]))?.kind === 'Follows').map((c) => `the ${c.role}`);
  const measure = followed?.measure ?? measures[0]?.measure;
  const reason = planExit.exit?.reason;
  const carried = measure?.kind === 'Leaves' && !measure.reasons.some((r) => r.kind === 'PartOnly') && reason !== undefined ? { reviewDate: planExit.exit!.reviewDate, reason } : undefined;
  return { position, measure, at, carried };
}

export interface PlanCheckProps {
  readonly check: SaleCheck;
  readonly leg: Leg;
  // The questions the sale asks of the trader, under what the Plan says.
  readonly children?: ReactNode;
}

// What the Plan says about leaving, and how the sale being typed measures up to it (W130 to W134). The facts come from the view; nothing is worked out here.
export function PlanCheck({ check: { position, measure, at, carried }, leg, children }: PlanCheckProps) {
  const roles = [...new Set(position.conditions.map((c) => c.role))];
  const count = noun(countOf(position.quantity), leg);
  const lines = (['Stop', 'Target'] as const).flatMap((role) => position.conditions.filter((c) => c.role === role).map((c) => `the ${role} (${clauseOf(c, leg)})`));
  return (
    <section className="card" aria-labelledby="plan-check-heading">
      <h2 id="plan-check-heading">Against the Plan</h2>
      <p>{`The Plan's exit: all ${count}${lines.length > 0 ? ` at ${lines.join(' or ')}` : ''}.`}</p>
      {measure?.kind === 'Leaves' && (
        <>
          <p>Leaves the Plan:</p>
          <ul>
            {measure.reasons.map((reason, i) => (
              <li key={i}>{reasonWords(reason, roles, leg)}</li>
            ))}
          </ul>
        </>
      )}
      {at && <p>{`Follows the Plan: all ${count}${at.length > 0 ? `, at ${at.join(' and ')}` : ''}. Nothing more to ask.`}</p>}
      {carried && <p>{`Your reason, ${shortDate(carried.reviewDate)}: "${carried.reason}" Nothing more to ask.`}</p>}
      {children}
    </section>
  );
}
