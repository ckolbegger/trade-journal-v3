// The benchmark dataset's identity (D2 T2.20, plan section 1.3), shared by the bench build's
// generator and by `bench:generate`, which reuses a cached profile only while its generator and
// schema versions both match. Raise the generator version whenever the generated data changes.
// Version 2 (D4 T4.30): the clock starts on 2024-01-02 and the generator adds Marks and Actions.
export const BENCH_GENERATOR_MARKER = 'tj-bench-generator-v2';
export const BENCH_GENERATOR_VERSION = 2;
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
}

// What `generate` returns besides the counts: the pinned as-of instant (the last session's
// completion, A52) and the Instruments without a Mark on the as-of date.
export interface BenchAsOf {
  readonly asOf: string;
  readonly reviewDate: string;
  readonly missingInstruments: readonly string[];
  // Actions saved first time, by choice (an edit does not add one).
  readonly actionsByChoice: Readonly<Record<string, number>>;
}
