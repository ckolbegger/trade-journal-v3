import { toWorkspaceLocal } from '../domain/time/index.ts';
import type { PlannedTradeItem } from '../app/types.ts';
import { formatDecimal, formatMoney, parseDecimal, Rational } from '../domain/values/index.ts';

// Presentation only. Values may arrive structurally cloned (navigation state), so only their
// numerator and denominator fields are read.
// "1 contract", "2 contracts" (convention C1).
export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

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

// An Underlying price: no "$", two decimals, zero included (convention C3, conflicts K6 and K7).
export const underlyingPrice = (value: Rational): string => formatDecimal(value, 2);

// An Underlying price stored as entered (a trigger), in the same two-decimal format.
export const decimalUnderlyingPrice = (text: string): string => {
  const parsed = parseDecimal(text);
  return parsed.ok ? underlyingPrice(parsed.value) : text;
};

// A Quantity to at most six decimals (A9), without trailing zeros (241/2 → "120.5").
export const quantity = (value: Rational): string => formatDecimal(value, 6).replace(/\.?0+$/, '');

// An instant as a Workspace-local date and time.
export const localTime = (instant: string, timeZone: string): string => toWorkspaceLocal(instant, timeZone).replace('T', ' ');

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The calendar year now in the Workspace zone (UTC until a zone is known).
const currentYear = (timeZone = 'UTC'): number => Number(new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone }).format(new Date()));

// "Nov 20", with a two-digit year ("Jan 21 '28") when the expiration is not in the current year (plan section 2a).
const summaryExpiration = (expiration: string, timeZone: string | undefined): string => {
  const [year = '', month = '1', day = '1'] = expiration.split('-');
  const date = `${SHORT_MONTHS[Number(month) - 1]} ${Number(day)}`;
  return Number(year) === currentYear(timeZone) ? date : `${date} '${year.slice(-2)}`;
};

// A strike as whole dollars, or with cents when it has decimals (row 23.16).
const summaryStrike = (strike: string): string => {
  const parsed = parseDecimal(strike);
  if (!parsed.ok) return strike;
  return parsed.value.denominator === 1n ? money(parsed.value).replace(/\.00$/, '') : money(parsed.value);
};

// What a Trade holds as one short text (plan section 2a); the Underlying is its own column, so it is not here.
export const tradeSummary = (summary: PlannedTradeItem['summary'], timeZone?: string): string =>
  summary.kind === 'Option'
    ? `${summary.direction} ${quantity(summary.contracts)} ${summaryExpiration(summary.expiration, timeZone)} ${summaryStrike(summary.strike)} ${summary.right}`
    : `${summary.direction} ${quantity(summary.quantity)} shares @ ${money(summary.price)}`;

// A Trade named in a sentence: its Underlying, then its summary line in parentheses; the Underlying alone without a summary (A150).
export const tradeName = (trade: { readonly underlying: string; readonly summary?: PlannedTradeItem['summary'] }): string =>
  trade.summary ? `${trade.underlying} (${tradeSummary(trade.summary)})` : trade.underlying;

// Signed cost of the open exposure: a debit as Money, a credit (negative) as its magnitude then "credit".
export const netCost = (value: Rational): string =>
  value.numerator < 0n ? `${money(Rational.of(-value.numerator, value.denominator))} credit` : money(value);

// A session date as "Mon Oct 12" (a calendar date has no time zone, so UTC reads it back unchanged).
export const shortDate = (date: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).formatToParts(new Date(`${date}T00:00:00Z`));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('weekday')} ${part('month')} ${part('day')}`;
};
