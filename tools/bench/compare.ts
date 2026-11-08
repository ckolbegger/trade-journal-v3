// Pure helpers of `bench:run`'s identity comparisons (D6 T6.25): the Closed page, the as-of Review's walk and its
// owed-reflection group are each compared as an ordered list of identity strings.

import { Rational } from '../../src/domain/values/index.ts';
import { instrumentLabel } from '../../src/ui/calculation-words.ts';
import { shortDate } from '../../src/ui/format.ts';
import { signedContracts } from '../../src/ui/screens/option-words.ts';

// Describes the first place two ordered lists differ, or undefined when they are equal.
export function firstDifference(expected: readonly string[], actual: readonly string[]): string | undefined {
  const shared = Math.min(expected.length, actual.length);
  for (let n = 0; n < shared; n++) {
    if (expected[n] !== actual[n]) return `position ${n + 1}: expected "${expected[n]}", rendered "${actual[n]}"`;
  }
  if (expected.length !== actual.length) return `${expected.length} expected, ${actual.length} rendered (they agree on the first ${shared})`;
  return undefined;
}

// A Closed row's Close date as the Closed list shows it: the terminal time's calendar day in the Workspace's time zone.
export function closeDate(terminalTime: string, timeZone: string): string {
  return new Date(terminalTime).toLocaleDateString('en-CA', { timeZone });
}

export interface ExpectedClosedRow {
  readonly tradeId: string;
  readonly underlying: string;
  readonly terminalTime: string;
}

// One identity per Closed row: the Trade, its Underlying and its Close date.
export const closedIdentity = (row: ExpectedClosedRow, timeZone: string) => `${row.tradeId} ${row.underlying} ${closeDate(row.terminalTime, timeZone)}`;

// One identity per card of the walk or the owed group: the Trade and the Underlying its card names.
export const cardIdentity = (tradeId: string, underlying: string) => `${tradeId} ${underlying}`;

// The Trade of a Closed row's link ("/trades/<id>").
export const tradeIdOfHref = (href: string) => decodeURIComponent(href.slice(href.lastIndexOf('/') + 1));

// The cards (in the Review's card order) of walked Trades that owe no reflection and whose Underlying is not Missing, up to `limit`.
// The Action save is timed on a card chosen and opened by its Trade: every Underlying has an owing walked Trade, so no Underlying is free.
export function walkedTradesOwingNothing(
  cards: readonly { tradeId: string; underlying: string }[],
  walk: readonly string[],
  debts: readonly { tradeId: string }[],
  missing: readonly string[],
  limit: number,
): { tradeId: string; underlying: string }[] {
  const walked = new Set(walk);
  const owing = new Set(debts.map((d) => d.tradeId));
  return cards.filter((c) => walked.has(c.tradeId) && !owing.has(c.tradeId) && !missing.includes(c.underlying)).slice(0, limit);
}

// ---- The as-of Review's settlement family (D7, T7.29) ---------------------------------------------------------

export interface ExpectedSettlementItem {
  readonly tradeId: string;
  readonly contract: string;
  readonly expiration: string;
  readonly quantity: string;
}

// The contract as the UI labels it ("NVDA 20 Nov 2026 107 Call"), from the generator's OCC-style key ("NVDA261120C00107000").
export function contractLabel(key: string): string {
  const found = /^(.+?)(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/.exec(key);
  if (!found) throw new Error(`not an option contract key: ${key}`);
  const [, symbol = '', yy, mm, dd, right, strike] = found;
  return instrumentLabel({ kind: 'Option', symbol, root: symbol, expiration: `20${yy}-${mm}-${dd}`, strike: String(Number(strike) / 1000), right: right === 'C' ? 'Call' : 'Put', multiplier: 100 });
}

// A signed open quantity as the Settlement panel words it: "Long 20 contracts" or "Short 1 contract".
export const signedContractsText = (quantity: string): string => signedContracts(Rational.of(BigInt(quantity)));

// "Fri Nov 20", the Review's short date.
export const reviewShortDate = shortDate;

// One identity per settlement item: its Trade, contract, direction and open count, and the expiration date its blocker names.
export const settlementIdentity = (tradeId: string, label: string, quantityText: string, expiredText: string) => `${tradeId} ${label} ${quantityText} expired ${expiredText}`;
export const expectedSettlementIdentity = (item: ExpectedSettlementItem) =>
  settlementIdentity(item.tradeId, contractLabel(item.contract), signedContractsText(item.quantity), reviewShortDate(item.expiration));

// The settlement expectations to compare, or none when the profile expects no Settlement Due contract.
export function settlementExpectations(settlement: readonly ExpectedSettlementItem[] | undefined, expectedDue: number): readonly ExpectedSettlementItem[] | undefined {
  if (expectedDue > 0 && (!settlement || settlement.length === 0)) {
    throw new Error(`asOfReview.settlement is ${settlement ? 'empty' : 'missing'} in bench/dataset.json, but the profile expects ${expectedDue} Settlement Due contracts at the as-of Review; regenerate the profile`);
  }
  return settlement;
}
