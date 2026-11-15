// npm run verify:capacity: the embedded capacity requirement equals 3 × M recomputed from the
// measured basis and the mature profile, and the basis was measured at the current schema
// version, so a schema change fails until the basis is recomputed (D1 T1.19).
import { readFile } from 'node:fs/promises';
import { CAPACITY_REQUIREMENT } from '../src/delivery/capacity.ts';
import { SCHEMA_VERSION } from '../src/persistence/schema.ts';
import { BASIS_FILE, largestProjection, project, type EngineMeasurement } from './capacity/profile.ts';
import { BENCH_CAPACITY_FILE, BENCH_DATASET_FILE } from './bench/profile.ts';
import { cachedProjectionProblems, peakVerdict, projectForDataset, usageVerdict, type PricedDataset } from './bench/restore-checks.ts';
import type { CapacityFile } from './bench/restored-capacity.ts';

const basis = JSON.parse(await readFile(BASIS_FILE, 'utf8')) as {
  schemaVersion: number;
  engines?: EngineMeasurement[];
  projectedWorkspaceBytes: number;
  requiredQuotaBytes: number;
};
const problems: string[] = [];
if (basis.schemaVersion !== SCHEMA_VERSION) {
  problems.push(`basis measured at schema version ${basis.schemaVersion}, current is ${SCHEMA_VERSION}: run measure:capacity`);
}
if (!basis.engines || basis.engines.length === 0) {
  problems.push('basis has no engine measurement: run measure:capacity');
} else {
  const expected = largestProjection(basis.engines);
  if (basis.projectedWorkspaceBytes !== expected.projectedWorkspaceBytes) {
    problems.push(`projectedWorkspaceBytes ${basis.projectedWorkspaceBytes} is not the recomputed ${expected.projectedWorkspaceBytes}`);
  }
  if (CAPACITY_REQUIREMENT.requiredQuotaBytes !== 3 * expected.projectedWorkspaceBytes) {
    problems.push(`embedded requiredQuotaBytes ${CAPACITY_REQUIREMENT.requiredQuotaBytes} is not 3 × ${expected.projectedWorkspaceBytes}`);
  }
  if (CAPACITY_REQUIREMENT.projectedWorkspaceBytes !== expected.projectedWorkspaceBytes) {
    problems.push(`embedded projectedWorkspaceBytes ${CAPACITY_REQUIREMENT.projectedWorkspaceBytes} is not ${expected.projectedWorkspaceBytes}`);
  }
}
// D8 T8.19: the restored Workspace's usage is within 10% of the projection for the same counts, and a second Restore's peak
// stays below 3 × M. Checked when `measure:capacity -- --restored` has recorded them (required by `--restored`).
const restored = (await readFile(BENCH_CAPACITY_FILE, 'utf8').then(JSON.parse, () => undefined)) as CapacityFile | undefined;
if (process.argv.includes('--restored') && !restored) problems.push('no restored measurement: run bench:setup, then measure:capacity -- --restored');
if (restored) {
  const dataset = JSON.parse(await readFile(BENCH_DATASET_FILE, 'utf8')) as PricedDataset & { artifact: { fileDigest: string } };
  if (restored.artifactDigest !== dataset.artifact.fileDigest) problems.push(`the restored measurement is of artifact ${restored.artifactDigest}, not the dataset's ${dataset.artifact.fileDigest}: rerun bench:setup and measure:capacity -- --restored`);
  // Judged against the projection and M computed now, not the figures cached with the measurement.
  const largest = basis.engines && basis.engines.length > 0 ? largestProjection(basis.engines) : undefined;
  const engine = largest && basis.engines!.find((e) => project(e).projectedWorkspaceBytes === largest.projectedWorkspaceBytes);
  if (engine) {
    const fresh = { projectedBytes: projectForDataset(engine, dataset), matureProjectedBytes: CAPACITY_REQUIREMENT.projectedWorkspaceBytes };
    problems.push(...cachedProjectionProblems(restored, fresh));
    const usage = usageVerdict(restored.usageBytes, fresh.projectedBytes);
    const peak = peakVerdict(restored.peakBytes, fresh.matureProjectedBytes);
    console.log(`verify:capacity: restored usage ${restored.usageBytes} = ${usage.ratio.toFixed(3)} × the projection ${fresh.projectedBytes} (limit 1.10); second Restore peak ${restored.peakBytes} = ${peak.ratio.toFixed(3)} × M ${fresh.matureProjectedBytes} (limit below 3)`);
    if (!usage.ok) problems.push(`restored usage ${restored.usageBytes} exceeds the projection ${fresh.projectedBytes} by more than 10%`);
    if (!peak.ok) problems.push(`second Restore peak ${restored.peakBytes} is not below 3 × M (${3 * fresh.matureProjectedBytes})`);
  }
}
if (problems.length > 0) {
  for (const p of problems) console.error(`FAIL ${p}`);
  process.exit(1);
}
console.log(`verify:capacity OK: required quota ${CAPACITY_REQUIREMENT.requiredQuotaBytes} = 3 × ${CAPACITY_REQUIREMENT.projectedWorkspaceBytes}, schema ${SCHEMA_VERSION}`);
