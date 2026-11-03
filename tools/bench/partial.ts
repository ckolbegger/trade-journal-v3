// Pure helpers of `bench:partial` (D6 T6.25-P1): the expectations of a PARTIAL benchmark dataset (a generation stopped before its
// last session) derived from the stored records, not from the generator's model. `tools/bench-partial.ts` reads the records
// raw from a profile copy, projects them to these shapes in the page, and passes them here.

export interface TradeRow {
  readonly tradeId: string;
  readonly underlying: string;
  readonly lifecycle: string;
  readonly exposureStart?: string;
  readonly terminalTime?: string;
  readonly positionChanges: number;
  readonly executions: number;
  readonly closeReason: boolean;
}
export interface EntryRow {
  readonly entryTypeKey: string;
  readonly sourceKey: string;
  readonly anchorTradeId: string;
  readonly momentTime: string;
  readonly authoredTime: string;
  readonly versions: number;
  // Only a Daily Trade Review Action has a Review Date.
  readonly reviewDate?: string;
}
export interface DebtRow {
  readonly anchorTradeId: string;
  readonly entryTypeKey: string;
  // The status of the Debt's latest version.
  readonly status: string;
}
export interface DeclineRow {
  readonly entryTypeKey: string;
}
export interface ObservationRow {
  readonly instrumentKey: string;
  readonly tradingDate: string;
  readonly marks: number;
  readonly corrections: number;
}
export interface StoredRows {
  readonly trades: readonly TradeRow[];
  readonly entries: readonly EntryRow[];
  readonly declines: readonly DeclineRow[];
  readonly debts: readonly DebtRow[];
  readonly observations: readonly ObservationRow[];
}

export interface StoredCounts {
  readonly trades: number;
  readonly openTrades: number;
  readonly plannedTrades: number;
  readonly closedTrades: number;
  readonly positionChanges: number;
  readonly executions: number;
  readonly closeReasons: number;
  readonly sessions: number;
  readonly marks: number;
  readonly markCorrections: number;
  readonly actions: number;
  readonly editedActions: number;
  readonly planReflectionEntries: number;
  readonly positionChangeReflectionEntries: number;
  readonly positionChangeReflectionDeclines: number;
  readonly closeReviewEntries: number;
  readonly closeReviewDeclines: number;
  readonly debts: number;
  readonly debtsSettled: number;
  readonly debtsDeclined: number;
  readonly debtsOutstanding: number;
}

// The refusal for a snapshot or dataset whose stored schema version is not this source's, or undefined when they agree.
export function schemaMismatch(stored: unknown, expected: number): string | undefined {
  if (typeof stored !== 'number') return `the data holds no schema version (found ${JSON.stringify(stored) ?? 'nothing'}), but this source is at ${expected}`;
  return stored === expected ? undefined : `the data is at schema version ${stored}, but this source is at ${expected}`;
}

const AS_OF_AFTER_CLOSE_MS = 35 * 60_000;

export interface LastSession {
  readonly reviewDate: string;
  // The session's close, which is the Review's cutoff.
  readonly cutoff: string;
  readonly asOf: string;
}

// The last session present is the latest Marks date. Its close is the moment of the Review Actions saved on it, and the
// as-of instant is 35 minutes after the close (the generator's rule: the 30-minute completion buffer plus five minutes).
export function lastSessionOf(rows: StoredRows): LastSession {
  const reviewDate = rows.observations.map((o) => o.tradingDate).reduce((latest, date) => (date > latest ? date : latest), '');
  const actions = rows.entries.filter((e) => e.entryTypeKey === 'entry-type.daily-trade-review' && e.reviewDate === reviewDate);
  if (actions.length === 0) throw new Error(`no Daily Trade Review Action is stored for the last session ${reviewDate}, so its close is unknown`);
  const cutoff = actions[0]!.momentTime;
  if (actions.some((a) => a.momentTime !== cutoff)) throw new Error(`the Actions of ${reviewDate} disagree on the session's close`);
  const asOf = new Date(Date.parse(cutoff) + AS_OF_AFTER_CLOSE_MS).toISOString().replace('.000Z', 'Z');
  if (actions.some((a) => a.authoredTime !== asOf)) throw new Error(`an Action of ${reviewDate} was not authored at ${asOf}, the close plus 35 minutes`);
  return { reviewDate, cutoff, asOf };
}

export interface ReviewMembers {
  // The Trades the as-of Review walks (Open at the cutoff) and the Trades of its owed-reflection group (outside the walk
  // with an Outstanding Debt), each sorted by Trade identity: membership only, since the stored data does not fix the order
  // (the walk is attention-ranked, A68).
  readonly walk: readonly string[];
  readonly owed: readonly string[];
  // The Open Trades' Underlyings (sorted, repeating a shared one) and those with no Mark on the Review Date.
  readonly openUnderlyings: readonly string[];
  readonly missingInstruments: readonly string[];
  // The walked Trades that already have a Daily Trade Review Action for the Review Date.
  readonly actionedWalk: readonly string[];
}

// Open at the cutoff: stored Open (or Closed after the cutoff) with exposure that started at or before it.
export function reviewMembersOf(rows: StoredRows, last: LastSession): ReviewMembers {
  const sorted = (values: Iterable<string>) => [...values].sort();
  const walked = rows.trades.filter(
    (t) => (t.lifecycle === 'Open' || (t.lifecycle === 'Closed' && t.terminalTime! > last.cutoff)) && t.exposureStart !== undefined && t.exposureStart <= last.cutoff,
  );
  const walk = new Set(walked.map((t) => t.tradeId));
  const open = rows.trades.filter((t) => t.lifecycle === 'Open');
  const marked = new Set(rows.observations.filter((o) => o.tradingDate === last.reviewDate).map((o) => o.instrumentKey));
  const actioned = new Set(rows.entries.filter((e) => e.entryTypeKey === 'entry-type.daily-trade-review' && e.reviewDate === last.reviewDate).map((e) => e.anchorTradeId));
  return {
    walk: sorted(walk),
    owed: sorted(new Set(rows.debts.filter((d) => d.status === 'Outstanding' && !walk.has(d.anchorTradeId)).map((d) => d.anchorTradeId))),
    openUnderlyings: sorted(open.map((t) => t.underlying)),
    missingInstruments: sorted(new Set(open.map((t) => t.underlying).filter((u) => !marked.has(u)))),
    actionedWalk: sorted([...walk].filter((id) => actioned.has(id))),
  };
}

const sum = <T,>(items: readonly T[], of: (item: T) => number) => items.reduce((total, item) => total + of(item), 0);

// What is stored, counted the way the generator counts after generating (`BenchCounts`).
export function countStored(rows: StoredRows): StoredCounts {
  const lifecycle = (state: string) => rows.trades.filter((t) => t.lifecycle === state).length;
  const entries = (key: string) => rows.entries.filter((e) => e.entryTypeKey === key).length;
  const actions = rows.entries.filter((e) => e.entryTypeKey === 'entry-type.daily-trade-review');
  const debts = (status: string) => rows.debts.filter((d) => d.status === status).length;
  return {
    trades: rows.trades.length,
    openTrades: lifecycle('Open'),
    plannedTrades: lifecycle('Planned'),
    closedTrades: lifecycle('Closed'),
    positionChanges: sum(rows.trades, (t) => t.positionChanges),
    executions: sum(rows.trades, (t) => t.executions),
    closeReasons: rows.trades.filter((t) => t.closeReason).length,
    sessions: new Set(rows.observations.map((o) => o.tradingDate)).size,
    marks: sum(rows.observations, (o) => o.marks),
    markCorrections: sum(rows.observations, (o) => o.corrections),
    actions: actions.length,
    editedActions: actions.filter((e) => e.versions > 1).length,
    planReflectionEntries: entries('entry-type.plan-reflection'),
    positionChangeReflectionEntries: entries('entry-type.position-change-reflection'),
    positionChangeReflectionDeclines: rows.declines.filter((d) => d.entryTypeKey === 'entry-type.position-change-reflection').length,
    closeReviewEntries: entries('entry-type.close-review'),
    closeReviewDeclines: rows.declines.filter((d) => d.entryTypeKey === 'entry-type.close-review').length,
    debts: rows.debts.length,
    debtsSettled: debts('Settled'),
    debtsDeclined: debts('Declined'),
    debtsOutstanding: debts('Outstanding'),
  };
}
