// The benchmark dataset's identity (D2 T2.20, plan section 1.3), shared by the bench build's
// generator and by `bench:generate`, which reuses a cached profile only while its generator and
// schema versions both match. Raise the generator version whenever the generated data changes.
export const BENCH_GENERATOR_MARKER = 'tj-bench-generator-v1';
export const BENCH_GENERATOR_VERSION = 1;
export const BENCH_SEED = 20211011;
// The generator's clock starts here and only moves forward with the generated Economic Times.
export const BENCH_CLOCK_START = '2021-10-11T13:00:00Z';
export const BENCH_TIME_ZONE = 'America/New_York';

// Section 1.3 at D2: 25,000 Trades (200 Open), Economic Times over five years of sessions.
export const BENCH_PROFILE = {
  trades: 25_000,
  openTrades: 200,
  sessions: 1_260,
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
}
