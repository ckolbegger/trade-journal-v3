// npm run bench:verify-capacity (D8 T8.19-F1, decision 114): every check of verify:capacity, plus the restored benchmark's three
// limits, from .cache/bench/capacity.json and bench/capacity-baseline.json (both of the dataset's artifact):
//   restored usage <= 1.10 x the projection for the same counts; second Restore peak < 3 x M; restored usage <= 1.50 x the baseline.
// Named bench:, not verify:, because it needs the git-ignored benchmark files and runs alone (A227), so the complete run's
// checks stage (every verify: script) leaves it out.
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { CAPACITY_REQUIREMENT } from '../src/delivery/capacity.ts';
import { BASIS_FILE, largestProjection, project, type EngineMeasurement } from './capacity/profile.ts';
import { BENCH_BASELINE_FILE, BENCH_CAPACITY_FILE, BENCH_DATASET_FILE } from './bench/profile.ts';
import {
  baselineProblems,
  cachedProjectionProblems,
  growthVerdict,
  peakVerdict,
  projectForDataset,
  usageVerdict,
  type BaselineFile,
  type PricedDataset,
} from './bench/restore-checks.ts';
import type { CapacityFile } from './bench/restored-capacity.ts';

// Every check of verify:capacity, run as it runs on its own.
const d7 = spawnSync(process.execPath, ['tools/verify-capacity.ts'], { stdio: 'inherit' });
const problems: string[] = d7.status === 0 ? [] : ['verify:capacity failed (above)'];

const readJson = <T>(file: string) => readFile(file, 'utf8').then((text) => JSON.parse(text) as T, () => undefined);
const basis = JSON.parse(await readFile(BASIS_FILE, 'utf8')) as { engines?: EngineMeasurement[] };
const dataset = JSON.parse(await readFile(BENCH_DATASET_FILE, 'utf8')) as PricedDataset & { artifact: { fileDigest: string } };
const digest = dataset.artifact.fileDigest;
const restored = await readJson<CapacityFile>(BENCH_CAPACITY_FILE);
const baseline = await readJson<BaselineFile>(BENCH_BASELINE_FILE);

if (!restored) problems.push('no restored measurement: run bench:setup, then npm run measure:capacity');
else if (restored.artifactDigest !== digest) problems.push(`the restored measurement is of artifact ${restored.artifactDigest}, not the dataset's ${digest}: rerun bench:setup and npm run measure:capacity`);
problems.push(...baselineProblems(baseline, digest));

if (restored && restored.artifactDigest === digest && basis.engines && basis.engines.length > 0) {
  // Judged against the projection and M computed now, not the figures cached with the measurement.
  const largest = largestProjection(basis.engines);
  const engine = basis.engines.find((e) => project(e).projectedWorkspaceBytes === largest.projectedWorkspaceBytes)!;
  const fresh = { projectedBytes: projectForDataset(engine, dataset), matureProjectedBytes: CAPACITY_REQUIREMENT.projectedWorkspaceBytes };
  problems.push(...cachedProjectionProblems(restored, fresh));
  const usage = usageVerdict(restored.usageBytes, fresh.projectedBytes);
  const peak = peakVerdict(restored.peakBytes, fresh.matureProjectedBytes);
  console.log(`bench:verify-capacity: restored usage ${restored.usageBytes} = ${usage.ratio.toFixed(3)} × the projection ${fresh.projectedBytes} (limit 1.10)`);
  console.log(`bench:verify-capacity: second Restore peak ${restored.peakBytes} = ${peak.ratio.toFixed(3)} × M ${fresh.matureProjectedBytes} (limit below 3)`);
  if (!usage.ok) problems.push(`restored usage ${restored.usageBytes} exceeds the projection ${fresh.projectedBytes} by more than 10%`);
  if (!peak.ok) problems.push(`second Restore peak ${restored.peakBytes} is not below 3 × M (${3 * fresh.matureProjectedBytes})`);
  if (baseline && baseline.artifactDigest === digest) {
    const growth = growthVerdict(restored.usageBytes, baseline.usageBytes);
    console.log(`bench:verify-capacity: restored usage ${restored.usageBytes} = ${growth.ratio.toFixed(3)} × the baseline ${baseline.usageBytes} (limit 1.50)`);
    if (!growth.ok) problems.push(`restored usage ${restored.usageBytes} exceeds the baseline ${baseline.usageBytes} by more than 50%`);
  }
}
if (problems.length > 0) {
  for (const p of problems) console.error(`FAIL ${p}`);
  process.exit(1);
}
console.log('bench:verify-capacity OK');
