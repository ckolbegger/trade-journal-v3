// Pure helpers of `bench:run`'s identity comparisons (D6 T6.25): the Closed page, the as-of Review's walk and its
// owed-reflection group are each compared as an ordered list of identity strings.

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

// The Underlyings whose card in the Review's walk is of a Trade that owes a reflection. A Debt of a Trade outside the walk
// (an owed-group or Closed Trade) does not bar the walked card of its Underlying from a timed Action save.
export function owingUnderlyings(debts: readonly { tradeId: string; underlying: string }[], walk: readonly string[]): Set<string> {
  const walked = new Set(walk);
  return new Set(debts.filter((d) => walked.has(d.tradeId)).map((d) => d.underlying));
}
