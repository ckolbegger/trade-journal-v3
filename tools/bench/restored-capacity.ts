// `npm run measure:capacity -- --restored` (D8 T8.19, decision 18): on a copy of the profile bench:setup restored, records the
// Workspace's `estimate().usage`, then restores the same artifact a second time over it, through the Backup page, and records
// the peak usage sampled during that Restore. Writes .cache/bench/capacity.json for verify:capacity and bench:run. The cached
// profile itself is never opened. Serves dist/ on the bench port (4175), so nothing else may run (A227).
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { CAPACITY_REQUIREMENT } from '../../src/delivery/capacity.ts';
import { BASIS_FILE, largestProjection, project, type EngineMeasurement } from '../capacity/profile.ts';
import { startReleaseServer } from '../release-server.ts';
import { pollPeakUsage, restoreThroughUi, usageNow } from './browser.ts';
import { BENCH_CAPACITY_FILE, BENCH_DATASET_FILE, BENCH_PORT, BENCH_PROFILE_DIR, BENCH_STAMP_FILE } from './profile.ts';
import { pinAsOf } from './pin.ts';
import { peakVerdict, projectForDataset, usageVerdict, type PricedDataset } from './restore-checks.ts';

export interface CapacityFile {
  readonly artifactDigest: string;
  readonly engine: string;
  readonly usageBytes: number;
  readonly projectedBytes: number;
  readonly matureProjectedBytes: number;
  readonly peakBytes: number;
  readonly peakSamples: number;
  readonly sampleEveryMs: number;
}

const SAMPLE_EVERY_MS = 250;

export async function measureRestored(): Promise<void> {
  if (!(await readFile(BENCH_STAMP_FILE).catch(() => undefined))) throw new Error('no restored profile: run npm run bench:setup first');
  const dataset = JSON.parse(await readFile(BENCH_DATASET_FILE, 'utf8')) as PricedDataset & { asOf: string; artifact: { path: string; fileDigest: string } };
  const basis = JSON.parse(await readFile(BASIS_FILE, 'utf8')) as { engines: EngineMeasurement[] };
  // The engine whose projection is the largest, which is the one the requirement 3 × M comes from.
  const largest = largestProjection(basis.engines);
  const engine = basis.engines.find((e) => project(e).projectedWorkspaceBytes === largest.projectedWorkspaceBytes)!;
  const projectedBytes = projectForDataset(engine, dataset);

  execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'tj-bench-capacity-'));
  const profile = path.join(workDir, 'profile');
  await cp(BENCH_PROFILE_DIR, profile, { recursive: true });
  const server = await startReleaseServer({ root: process.cwd(), release: 'dist', port: BENCH_PORT });
  const context = await chromium.launchPersistentContext(profile, { headless: true });
  try {
    await pinAsOf(context, new Date(dataset.asOf));
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(server.url);
    await page.getByRole('table', { name: 'Open Trades' }).locator('tbody tr').first().waitFor({ timeout: 600_000 });
    const usageBytes = await usageNow(page);
    console.log(`measure:capacity: restored Workspace usage ${usageBytes} bytes, projection for the same counts ${projectedBytes} bytes`);

    // A second Restore of the same artifact over the restored Workspace, from the Backup page.
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Backup' }).click();
    await page.getByRole('heading', { name: 'Backup', level: 1 }).waitFor({ timeout: 60_000 });
    const poller = await pollPeakUsage(page, SAMPLE_EVERY_MS);
    const second = await restoreThroughUi(page, path.resolve(dataset.artifact.path));
    const { peakBytes, samples } = await poller.stop();
    console.log(`measure:capacity: second Restore prepare ${(second.prepareMs / 1000).toFixed(1)} s, apply ${(second.applyMs / 1000).toFixed(1)} s, peak usage ${peakBytes} bytes in ${samples} samples`);

    const record: CapacityFile = {
      artifactDigest: dataset.artifact.fileDigest,
      engine: engine.engine,
      usageBytes,
      projectedBytes,
      matureProjectedBytes: CAPACITY_REQUIREMENT.projectedWorkspaceBytes,
      peakBytes,
      peakSamples: samples,
      sampleEveryMs: SAMPLE_EVERY_MS,
    };
    await writeFile(BENCH_CAPACITY_FILE, `${JSON.stringify(record, null, 2)}\n`);
    const usage = usageVerdict(usageBytes, projectedBytes);
    const peak = peakVerdict(peakBytes, record.matureProjectedBytes);
    console.log(`measure:capacity OK: usage ${usage.ratio.toFixed(3)} of the projection, peak ${peak.ratio.toFixed(3)} × M; run npm run verify:capacity -- --restored for the verdicts`);
  } finally {
    await context.close();
    await server.close();
    await rm(workDir, { recursive: true, force: true });
  }
}
