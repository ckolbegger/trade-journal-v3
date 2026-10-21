// Where the benchmark's cached profile and provenance live (D2 T2.20); `bench:run` (T2.21) reads
// the same paths and serves the production build on the same origin, so IndexedDB carries over.
import path from 'node:path';

// The bench origin: http://localhost:5181. IndexedDB belongs to the origin, so T2.21 must serve
// the production build on this port.
export const BENCH_PORT = 5181;
// The cached Chromium profile (git-ignored through `.cache/`) and its version stamp, written last
// so an interrupted generation never looks reusable.
export const BENCH_PROFILE_DIR = path.resolve('.cache/bench/profile');
export const BENCH_STAMP_FILE = path.join(BENCH_PROFILE_DIR, 'tj-bench.json');
// Provenance (committed): counts, versions, timing, engine.
export const BENCH_DATASET_FILE = path.resolve('bench/dataset.json');
// The expected Open list (committed): the rendered "Open Trades" rows and the facade's items.
export const BENCH_EXPECTED_ROWS_FILE = path.resolve('bench/expected-open-rows.json');
export const BENCH_BUILD_DIR = 'dist-bench';

export interface BenchStamp {
  readonly generatorVersion: number;
  readonly schemaVersion: number;
}

export interface ExpectedOpenRows extends BenchStamp {
  // Column headers and cell text of the "Open Trades" table, in display order.
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
  // `browseTrades({ lifecycle: 'Open' })` items, in order.
  readonly items: readonly unknown[];
}
