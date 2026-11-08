import type { Instrument, OptionInstrument } from './instrument/index.ts';
import type { DerivedTradeState } from './trade-analysis/index.ts';
import { parseDecimal, Rational } from './values/index.ts';

// What a Trade holds, structured so the UI formats it as one short text (plan section 2a). Later
// deliverables add variants without changing these. Never stored.
export type TradeSummary =
  | {
      readonly kind: 'Stock';
      readonly direction: 'Long';
      readonly quantity: Rational;
      readonly price: Rational;
    }
  // One option contract held long or short; the premium is the Trade's net cost, not part of the summary (A119).
  | {
      readonly kind: 'Option';
      readonly direction: 'Long' | 'Short';
      readonly contracts: Rational;
      readonly expiration: string;
      readonly strike: string;
      readonly right: 'Call' | 'Put';
    };

export function optionSummary(instrument: OptionInstrument, direction: 'Long' | 'Short', contracts: Rational): TradeSummary {
  return { kind: 'Option', direction, contracts, expiration: instrument.expiration, strike: instrument.strike, right: instrument.right };
}

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

const magnitude = (value: Rational) => (value.compare(Rational.of(0n)) < 0 ? Rational.of(0n).sub(value) : value);

// A Planned Trade's Summary, by the contract its first Planned Leg names: an option's direction and total contracts,
// otherwise Long Stock. The coordinator and the confirmed Detail both call it.
export function plannedTradeSummary(
  legs: readonly { readonly side: 'Long' | 'Short'; readonly instrument: Instrument; readonly quantity: string; readonly intendedEntry: string }[],
): TradeSummary {
  const first = legs[0]!;
  if (first.instrument.kind !== 'Option') return plannedLongStockSummary(legs);
  return optionSummary(first.instrument, first.side, magnitude(legs.map((l) => decimal(l.quantity)).reduce((a, b) => a.add(b), Rational.of(0n))));
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

// What a Trade holds now, by the contract its first Planned Leg names: an option's open contracts, long or short by
// their sign; otherwise the open Long Stock. None when flat. The one builder for the lists and the Review.
export function openTradeSummary(instrument: Instrument, derived: DerivedTradeState): TradeSummary | undefined {
  if (instrument.kind !== 'Option') return openLongStockSummary(derived);
  const held = derived.positions.flatMap((p) => p.openLots).reduce((a, lot) => a.add(lot.quantity), Rational.of(0n));
  const zero = Rational.of(0n);
  return held.compare(zero) === 0 ? undefined : optionSummary(instrument, held.compare(zero) < 0 ? 'Short' : 'Long', magnitude(held));
}

// The open quantity at the quantity-weighted Open Lot price, fees excluded; none without open quantity.
export function openLongStockSummary(derived: DerivedTradeState): TradeSummary | undefined {
  const sum = (values: readonly Rational[]) => values.reduce((a, b) => a.add(b), Rational.of(0n));
  const lots = derived.positions.flatMap((p) => p.openLots);
  const quantity = sum(lots.map((l) => l.quantity));
  if (quantity.compare(Rational.of(0n)) === 0) return undefined;
  return { kind: 'Stock', direction: 'Long', quantity, price: sum(lots.map((l) => l.quantity.mul(l.price))).div(quantity) };
}
