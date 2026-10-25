import { toWorkspaceLocal } from '../domain/time/index.ts';
import { formatDecimal, formatMoney, parseDecimal, type Rational } from '../domain/values/index.ts';

// Presentation only. Values may arrive structurally cloned (navigation state), so only their
// numerator and denominator fields are read.
export const money = (value: Rational): string => formatMoney(value);

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
