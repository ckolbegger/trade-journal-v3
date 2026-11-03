// The benchmark dataset's identity (D2 T2.20, plan section 1.3), shared by the bench build's
// generator and by `bench:generate`, which reuses a cached profile only while its generator and
// schema versions both match. Raise the generator version whenever the generated data changes.
// Version 2 (D4 T4.30): the clock starts on 2024-01-02 and the generator adds Marks and Actions.
// Version 3 (D5 T5.21): the Position Change Reflection dispositions of plan section 1.4, with the
// deferred reflections resolved in the Review where they fall due.
// Version 4 (D6 T6.24): the book turns over (plan section 1.4 at D6): 24,700 Trades are planned, entered and
// closed with a Close Reason and a Close Review, 200 stay Open and 100 stay Planned.
export const BENCH_GENERATOR_MARKER = 'tj-bench-generator-v4';
export const BENCH_GENERATOR_VERSION = 4;
export const BENCH_SEED = 20211011;
// The generator's clock starts here and only moves forward with the generated Economic Times.
// Every simulated session is inside session-policy coverage (decision 51).
export const BENCH_CLOCK_START = '2024-01-02T13:00:00Z';
export const BENCH_TIME_ZONE = 'America/New_York';

// Section 1.3 at D2 and D4: 25,000 Trades (200 Open) over the sessions from the clock start through
// the end of session-policy coverage (1,255 real sessions; the plan says about 1,260), 150 distinct
// Instruments among the Open Trades (50 shared by two), 10 of them without the as-of Mark.
export const BENCH_PROFILE = {
  trades: 25_000,
  openTrades: 200,
  instruments: 150,
  missingAsOfInstruments: 10,
  correctedMarkEvery: 100,
  editedActionEvery: 50,
  institutions: 3,
  accountsPerInstitution: 2,
} as const;

// Section 1.4 at D5's scale, of the 400 Position Changes: completed at capture, declined at capture,
// deferred and answered in the Review where they fall due, deferred and declined there, and
// deferred and still Outstanding at the as-of instant (the last two Position Changes).
// At D6 the same split applies to the Position Change Reflections and to the Close Reviews, in tenths of a percent:
// 65%, 15%, 18%, 1.6% and 0.4%. The generator rounds each total to whole counts that sum exactly (largest remainder).
export const BENCH_DISPOSITION_PER_MILLE = { complete: 650, declined: 150, answered: 180, declinedLater: 16, outstanding: 4 } as const;
export type BenchDisposition = keyof typeof BENCH_DISPOSITION_PER_MILLE;

// D6 section 1.4: 6, 7, 3 and 4 of every 20 Closed Trades (30%, 35%, 15%, 20%).
export const BENCH_CLOSE_REASONS = ['Target Reached', 'Stop Triggered', 'Thesis Invalidated', 'Time-Based Exit'] as const;

// The profile at a number of sessions. All the sessions is section 1.4's: 25,000 Trades, 24,700 Closed, 200 Open and
// 100 Planned. Fewer scale every count by their share, for a short smoke run.
export const BENCH_FULL = { trades: 25_000, openTrades: 200, plannedTrades: 100 } as const;
// The last sessions plan nothing: the last Trades have time to enter and close before the as-of session.
export const BENCH_TAIL_SESSIONS = 10;
export function benchScale(sessions: number, fullSessions: number) {
  const share = sessions / fullSessions;
  const full = sessions === fullSessions;
  const trades = full ? BENCH_FULL.trades : Math.round(BENCH_FULL.trades * share);
  const openTrades = full ? BENCH_FULL.openTrades : Math.max(1, Math.round(BENCH_FULL.openTrades * share));
  const plannedTrades = full ? BENCH_FULL.plannedTrades : Math.max(1, Math.round(BENCH_FULL.plannedTrades * share));
  return { sessions, full, trades, openTrades, plannedTrades, closedTrades: trades - openTrades - plannedTrades };
}

// What the generator counts in the stored Workspace after generating.
export interface BenchCounts {
  readonly trades: number;
  readonly openTrades: number;
  readonly plannedTrades: number;
  readonly positionChanges: number;
  readonly executions: number;
  readonly planReflectionEntries: number;
  readonly positionChangeReflectionEntries: number;
  readonly positionChangeReflectionDeclines: number;
  readonly institutions: number;
  readonly accounts: number;
  readonly strategies: number;
  // D4 (T4.30): sessions simulated, Marks (initial Manual revisions), their corrections, the
  // Instruments the Open Trades hold, and the Daily Trade Review Actions with how many were edited.
  readonly sessions: number;
  readonly openInstruments: number;
  readonly sharedInstruments: number;
  readonly marks: number;
  readonly markCorrections: number;
  readonly acknowledgments: number;
  readonly actions: number;
  readonly editedActions: number;
  // D5 (T5.21): the Debts by their last status. Settled are the answered ones, Declined the declined
  // in a Review; Outstanding is still owed at the as-of instant.
  readonly debts: number;
  readonly debtsSettled: number;
  readonly debtsDeclined: number;
  readonly debtsOutstanding: number;
  // D6 (T6.24): Closed Trades, their Close Reasons by label, and the Close Review outcomes. The `debts` above
  // count the Debts of both kinds; `closeReview*Debts*` are the Close Review share of them.
  readonly closedTrades: number;
  readonly closeReasons: Readonly<Record<string, number>>;
  readonly closeReviewEntries: number;
  readonly closeReviewDeclines: number;
  readonly closeReviewDebts: number;
  readonly closeReviewDebtsSettled: number;
  readonly closeReviewDebtsDeclined: number;
  readonly closeReviewDebtsOutstanding: number;
}

// An Outstanding Debt at the as-of instant: the Trade it follows, its kind, the Position Change's number
// (or, for a Close Review, the Close's number) in the generated order, and the UTC calendar day of the
// Position Change's Economic Time (the Debt's `momentTime` in the Journal).
export interface BenchOutstandingDebt {
  readonly debtId: string;
  readonly tradeId: string;
  readonly underlying: string;
  readonly kind: 'PositionChange' | 'CloseReview';
  readonly positionChange: number;
  readonly momentDate: string;
}

// The as-of Review's identities (D6): its walk in order, and its owed-reflection group in order with each
// Trade's Outstanding Debts in due-anchor order.
export interface BenchAsOfReview {
  readonly walk: readonly string[];
  readonly owedGroup: readonly { readonly tradeId: string; readonly underlying: string; readonly debtIds: readonly string[] }[];
}

// What `generate` returns besides the counts: the pinned as-of instant (the last session's
// completion, A52) and the Instruments without a Mark on the as-of date.
export interface BenchAsOf {
  readonly asOf: string;
  readonly reviewDate: string;
  readonly missingInstruments: readonly string[];
  // Actions saved first time, by choice (an edit does not add one).
  readonly actionsByChoice: Readonly<Record<string, number>>;
  // D5 (T5.21): the reflections the as-of Review lists as due, and the Debts still Outstanding.
  readonly asOfDueReflections: number;
  readonly outstandingDebts: readonly BenchOutstandingDebt[];
  // The Position Change Reflection dispositions the generator applied (first-time tallies), and the Close Reviews'.
  readonly dispositions: Readonly<Record<BenchDisposition, number>>;
  readonly closeReviewDispositions: Readonly<Record<BenchDisposition, number>>;
  // D6: the as-of Review's walk and owed-reflection group.
  readonly asOfReview: BenchAsOfReview;
}
