// npm run measure:capacity:reset-baseline (D8 T8.19-F1, decision 114): measures the restored benchmark Workspace, as
// measure:capacity does, and records its usage as the new growth baseline in bench/capacity-baseline.json, and nothing else
// stored. Runs only when the user says so; the deliverable's evidence records the user's reason.
import { writeFile } from 'node:fs/promises';
import { BENCH_BASELINE_FILE } from './bench/profile.ts';
import { measureRestored, reportRestored } from './bench/restored-capacity.ts';
import type { BaselineFile } from './bench/restore-checks.ts';

const record = await measureRestored();
const baseline: BaselineFile = {
  artifactDigest: record.artifactDigest,
  engine: record.engine,
  usageBytes: record.usageBytes,
  date: new Date().toISOString().slice(0, 10),
};
await writeFile(BENCH_BASELINE_FILE, `${JSON.stringify(baseline, null, 2)}\n`);
reportRestored('measure:capacity:reset-baseline', record);
console.log(`measure:capacity:reset-baseline OK: baseline ${baseline.usageBytes} bytes of artifact ${baseline.artifactDigest} written to bench/capacity-baseline.json`);
process.exit(0);
