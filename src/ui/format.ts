import { toWorkspaceLocal } from '../domain/time/index.ts';
import type { PlannedTradeItem } from '../app/types.ts';
import { formatDecimal, formatMoney, parseDecimal, Rational } from '../domain/values/index.ts';

// Presentation only. Values may arrive structurally cloned (navigation state), so only their
// numerator and denominator fields are read.
// Money with comma-grouped thousands; the one money format of the UI.
export const money = (value: Rational): string => formatMoney(value).replace(/\d+(?=\.)/, (whole) => whole.replace(/\B(?=(\d{3})+$)/g, ','));

// A stored finite decimal (a price or fee as entered) as Money.
export const decimalMoney = (text: string): string => {
  const parsed = parseDecimal(text);
  return parsed.ok ? money(parsed.value) : text;
};

// A ratio to at most two decimals, without trailing zeros (12/5 → "2.4").
export const ratio = (value: Rational): string => formatDecimal(value, 2).replace(/\.?0+$/, '');

// An R multiple with exactly two decimals, so 1.30R and 1.08R line up (12/5 → "2.40R").
export const rMultiple = (value: Rational): string => `${formatDecimal(value, 2)}R`;

// A Quantity to at most six decimals (A9), without trailing zeros (241/2 → "120.5").
export const quantity = (value: Rational): string => formatDecimal(value, 6).replace(/\.?0+$/, '');

// An instant as a Workspace-local date and time.
export const localTime = (instant: string, timeZone: string): string => toWorkspaceLocal(instant, timeZone).replace('T', ' ');

// What a Trade holds as one short text (plan section 2a); the Underlying is its own column, so it is not here.
export const tradeSummary = (summary: PlannedTradeItem['summary']): string =>
  `${summary.direction} ${quantity(summary.quantity)} shares @ ${money(summary.price)}`;

// Signed cost of the open exposure: a debit as Money, a credit (negative) as its magnitude then "credit".
export const netCost = (value: Rational): string =>
  value.numerator < 0n ? `${money(Rational.of(-value.numerator, value.denominator))} credit` : money(value);
