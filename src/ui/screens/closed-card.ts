import type { OwedTradeSummary } from '../../app/types.ts';
import { parseDecimal, Rational } from '../../domain/values/index.ts';
import { calculation, signed } from '../figures.ts';
import { conditionLines } from '../cockpit/drawers/plan-risk.props.ts';
import { decimalMoney as price, localTime, money, quantity, rMultiple, shortDate } from '../format.ts';

export type ClosedSummary = Extract<OwedTradeSummary, { readonly kind: 'Closed' }>;

const ONE = Rational.of(1n);
const ZERO = Rational.of(0n);

// How a Closed Trade's exposure ended, in plain words (W150): "sold all 4 contracts", "bought back all 100 shares", "expired worthless",
// or the contracts sold and the ones that expired. A mechanism's own quantity is named; "all" only when one mechanism ended it.
export function howEnded(summary: ClosedSummary): string {
  const { side, instrument } = summary.plan;
  const [one, many] = instrument.kind === 'Option' ? ['contract', 'contracts'] : ['share', 'shares'];
  const count = (amount: Rational): string => `${quantity(amount)} ${amount.compare(ONE) === 0 ? one : many}`;
  const verb = side === 'Long' ? 'sold' : 'bought back';
  return calculation(summary.terminalDisposition, (mechanisms) => {
    const executed = mechanisms.find(({ mechanism }) => mechanism === 'Executions');
    const expired = mechanisms.find(({ mechanism }) => mechanism === 'Expiration');
    if (executed && expired) return `${verb} ${count(executed.quantity)}, ${quantity(expired.quantity)} expired worthless`;
    if (executed) return `${verb} all ${count(executed.quantity)}`;
    return 'expired worthless';
  });
}

export interface PlanResultRow {
  readonly label: string;
  readonly plan: string;
  // One line for each fill or expiration; a Stop or Target that no Mark was read for has none.
  readonly happened: readonly string[];
}

// The Plan beside what happened (W150): Entry, Stop, Target, Exit and Result, from the Plan's leg and conditions and each fill. Dates are the
// Workspace zone's calendar dates; each fill is a line of its own, never summed.
export function planResultRows(summary: ClosedSummary, timeZone: string): readonly PlanResultRow[] {
  const { plan } = summary;
  const [one, many] = plan.instrument.kind === 'Option' ? ['contract', 'contracts'] : ['share', 'shares'];
  const date = (instant: string): string => shortDate(localTime(instant, timeZone).slice(0, 10));
  const opening = plan.side === 'Long' ? 'Buy' : 'Sell';
  const fillLine = (verb: string, fill: ClosedSummary['fills'][number]): string => `${verb} ${fill.quantity} at ${price(fill.price)}, ${date(fill.economicTime)}`;
  // A short Plan's stored quantity is signed; the Entry cell names the count.
  const parsed = parseDecimal(plan.quantity);
  const signless = (value: Rational): Rational => (value.compare(ZERO) < 0 ? ZERO.sub(value) : value);
  const planned = parsed.ok ? signless(parsed.value) : undefined;
  const units = planned?.compare(ONE) === 0 ? one : many;
  const leg = { instrument: plan.instrument, side: plan.side };
  const exits = [
    ...summary.fills.filter((fill) => fill.action !== opening).map((fill) => fillLine(plan.side === 'Long' ? 'Sold' : 'Bought back', fill)),
    ...summary.expirations.map((expiration) => `${expiration.quantity} expired worthless, ${date(expiration.economicTime)}`),
  ];
  return [
    { label: 'Entry', plan: `${plan.side === 'Short' ? 'Sell ' : ''}${planned ? quantity(planned) : plan.quantity} ${units} at ${price(plan.intendedEntry)}`, happened: summary.fills.filter((fill) => fill.action === opening).map((fill) => fillLine(plan.side === 'Long' ? 'Bought' : 'Sold', fill)) },
    { label: 'Stop', plan: conditionLines('Stop', plan.stops, leg, plan.instrument.symbol).join(', '), happened: [] },
    { label: 'Target', plan: conditionLines('Target', plan.targets, leg, plan.instrument.symbol).join(', '), happened: [] },
    { label: 'Exit', plan: 'All at the Stop or the Target', happened: exits },
    { label: 'Result', plan: `${money(plan.plannedReward)} · ${rMultiple(plan.plannedR)}`, happened: [`${signed(money)(summary.realizedPnl)} · ${calculation(summary.realizedR, signed(rMultiple))}`] },
  ];
}
