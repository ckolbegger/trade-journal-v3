import type { DerivedTradeState } from './trade-analysis/index.ts';
import { parseDecimal, Rational } from './values/index.ts';

// What a Trade holds, structured so the UI formats it as one short text (plan section 2a). D2 has only
// Long Stock; later deliverables add variants without changing this one. Never stored.
export type TradeSummary = {
  readonly kind: 'Stock';
  readonly direction: 'Long';
  readonly quantity: Rational;
  readonly price: Rational;
};

const decimal = (text: string): Rational => {
  const parsed = parseDecimal(text);
  if (!parsed.ok) throw new Error(`not a decimal: ${text}`);
  return parsed.value;
};

// The Plan's total quantity at its first Planned Leg's intended entry (D2 plans are one Long Stock leg).
// The one computation of a Planned Trade Summary: the list and Detail read model and the confirmed
// Detail all call it.
export function plannedLongStockSummary(
  legs: readonly { readonly quantity: string; readonly intendedEntry: string }[],
): TradeSummary {
  return {
    kind: 'Stock',
    direction: 'Long',
    quantity: legs.map((l) => decimal(l.quantity)).reduce((a, b) => a.add(b), Rational.of(0n)),
    price: decimal(legs[0]!.intendedEntry),
  };
}

// The entered quantity (every Buy; Sells are not entered quantity) at its quantity-weighted entry price, fees
// excluded: what a Closed Trade traded, once no Lot is open (decision 48). None without a Buy.
export function closedLongStockSummary(derived: DerivedTradeState): TradeSummary | undefined {
  const buys = derived.facts.filter((fact) => fact.action === 'Buy');
  const sum = (values: readonly Rational[]) => values.reduce((a, b) => a.add(b), Rational.of(0n));
  const quantity = sum(buys.map((fact) => decimal(fact.quantity)));
  if (quantity.compare(Rational.of(0n)) === 0) return undefined;
  return { kind: 'Stock', direction: 'Long', quantity, price: sum(buys.map((fact) => decimal(fact.quantity).mul(decimal(fact.price)))).div(quantity) };
}

// The open quantity at the quantity-weighted Open Lot price, fees excluded; none without open quantity.
export function openLongStockSummary(derived: DerivedTradeState): TradeSummary | undefined {
  const sum = (values: readonly Rational[]) => values.reduce((a, b) => a.add(b), Rational.of(0n));
  const lots = derived.positions.flatMap((p) => p.openLots);
  const quantity = sum(lots.map((l) => l.quantity));
  if (quantity.compare(Rational.of(0n)) === 0) return undefined;
  return { kind: 'Stock', direction: 'Long', quantity, price: sum(lots.map((l) => l.quantity.mul(l.price))).div(quantity) };
}
