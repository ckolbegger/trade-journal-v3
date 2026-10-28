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

// The Plan's total quantity at its first Planned Leg's intended entry (D2 plans are one Long Stock leg).
// The one computation of a Planned Trade Summary: the list and Detail read model and the confirmed
// Detail all call it.
export function plannedLongStockSummary(
  legs: readonly { readonly quantity: string; readonly intendedEntry: string }[],
): TradeSummary {
  const decimal = (text: string): Rational => {
    const parsed = parseDecimal(text);
    if (!parsed.ok) throw new Error(`not a decimal: ${text}`);
    return parsed.value;
  };
  return {
    kind: 'Stock',
    direction: 'Long',
    quantity: legs.map((l) => decimal(l.quantity)).reduce((a, b) => a.add(b), Rational.of(0n)),
    price: decimal(legs[0]!.intendedEntry),
  };
}

// The open quantity at the quantity-weighted Open Lot price, fees excluded; none without open quantity.
export function openLongStockSummary(derived: DerivedTradeState): TradeSummary | undefined {
  const sum = (values: readonly Rational[]) => values.reduce((a, b) => a.add(b), Rational.of(0n));
  const lots = derived.positions.flatMap((p) => p.openLots);
  const quantity = sum(lots.map((l) => l.quantity));
  if (quantity.compare(Rational.of(0n)) === 0) return undefined;
  return { kind: 'Stock', direction: 'Long', quantity, price: sum(lots.map((l) => l.quantity.mul(l.price))).div(quantity) };
}
