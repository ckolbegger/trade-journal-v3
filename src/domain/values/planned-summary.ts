import { parseDecimal } from './decimal.ts';
import { Rational } from './rational.ts';

// The Plan's total quantity at its first Planned Leg's intended entry (D2 plans are one Long Stock leg).
// The one computation of a Planned Trade Summary: the list and Detail read model and the confirmed
// Detail all call it. Structurally a Trade Views `TradeSummary`.
export function plannedLongStockSummary(
  legs: readonly { readonly quantity: string; readonly intendedEntry: string }[],
): { readonly kind: 'Stock'; readonly direction: 'Long'; readonly quantity: Rational; readonly price: Rational } {
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
