// npm run bench:setup: restores the committed benchmark artifact (.cache/bench/benchmark.tjbackup, made by bench:generate)
// through the production first-run Restore in a fresh Chromium profile, and caches that profile for bench:run (D8 T8.19, P35).
// It refuses an artifact whose digest is not the one bench/dataset.json records, or whose expected rows were not written by the
// Node generator for it; it requires an accepted preview with no repairs and no updates, and the restored counts of the dataset.
// The production build (dist/) is served on the bench origin (port 4175, the benchmark's own), so the profile's IndexedDB
// belongs to the origin bench:run serves. Records .cache/bench/setup.json (the prepare and apply timings) and, last, the
// profile's stamp, so an interrupted setup never looks reusable. A full-size Restore takes minutes; nothing else may run (A227).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { BENCH_GENERATOR_VERSION } from '../src/app/bench.ts';
import { SCHEMA_VERSION } from '../src/persistence/schema.ts';
import { restoreThroughUi } from './bench/browser.ts';
import { BENCH_DATASET_FILE, BENCH_EXPECTED_ROWS_FILE, BENCH_PORT, BENCH_PROFILE_DIR, BENCH_SETUP_FILE, BENCH_STAMP_FILE, type BenchStamp } from './bench/profile.ts';
import { pinAsOf } from './bench/pin.ts';
import { artifactProblems, type ExpectedRowsProvenance, type SetupRecord } from './bench/restore-checks.ts';
import { startReleaseServer } from './release-server.ts';

const dataset = JSON.parse(await readFile(BENCH_DATASET_FILE, 'utf8')) as {
  generatorVersion: number;
  schemaVersion: number;
  asOf: string;
  counts: { trades: number; marks: number; markCorrections: number };
  artifact: { path: string; fileDigest: string; bytes: number };
};
const artifactFile = path.resolve(dataset.artifact.path);
const artifact = await readFile(artifactFile).catch(() => undefined);
if (!artifact) {
  console.error(`FAIL ${dataset.artifact.path} does not exist; run npm run build:bench && npm run bench:generate`);
  process.exit(1);
}
const rows = JSON.parse(await readFile(BENCH_EXPECTED_ROWS_FILE, 'utf8')) as ExpectedRowsProvenance;
const problems = artifactProblems(createHash('sha256').update(artifact).digest('hex'), dataset, rows);
if (dataset.generatorVersion !== BENCH_GENERATOR_VERSION || dataset.schemaVersion !== SCHEMA_VERSION) {
  problems.push(`the dataset is for generator ${dataset.generatorVersion}, schema ${dataset.schemaVersion}; this source is generator ${BENCH_GENERATOR_VERSION}, schema ${SCHEMA_VERSION}`);
}
if (problems.length > 0) {
  for (const problem of problems) console.error(`FAIL ${problem}`);
  process.exit(1);
}

// Restore runs the production build.
execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
await rm(BENCH_PROFILE_DIR, { recursive: true, force: true });
await mkdir(path.dirname(BENCH_PROFILE_DIR), { recursive: true });

const server = await startReleaseServer({ root: process.cwd(), release: 'dist', port: BENCH_PORT });
const context = await chromium.launchPersistentContext(BENCH_PROFILE_DIR, { headless: true });
let record: SetupRecord;
try {
  await pinAsOf(context, new Date(dataset.asOf));
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(server.url);
  await page.getByRole('heading', { name: 'Start your journal' }).waitFor({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Restore from a backup' }).click();
  const restored = await restoreThroughUi(page, artifactFile);
  const number = (n: number) => n.toLocaleString('en-US');
  const repairsLine = restored.notes.filter((n) => n.includes('repair'));
  if (!restored.notes.includes('No repairs needed.') || !restored.notes.includes('No updates needed.')) {
    throw new Error(`the preview was not clean: ${JSON.stringify(restored.notes)}`);
  }
  // The preview counts every Mark stored: the dataset's Marks and its Mark corrections.
  const marks = dataset.counts.marks + dataset.counts.markCorrections;
  if (!restored.tradesInBackup.startsWith(number(dataset.counts.trades)) || restored.marksInBackup !== number(marks)) {
    throw new Error(`the preview's counts (Trades ${restored.tradesInBackup}, Marks ${restored.marksInBackup}) are not the dataset's (${dataset.counts.trades}, ${marks})`);
  }
  console.log(`bench:setup: prepare ${(restored.prepareMs / 1000).toFixed(1)} s, apply ${(restored.applyMs / 1000).toFixed(1)} s, ${JSON.stringify(repairsLine)}`);
  // As a trader would: Go to Trades starts the application on the restored journal; the Open list must then render.
  await page.getByRole('link', { name: 'Go to Trades' }).click();
  await page.getByRole('table', { name: 'Open Trades' }).locator('tbody tr').first().waitFor({ timeout: 600_000 });
  record = { artifactDigest: dataset.artifact.fileDigest, artifactBytes: artifact.length, prepareMs: restored.prepareMs, applyMs: restored.applyMs, repairs: 0, issues: 0 };
} finally {
  await context.close();
  await server.close();
}
await writeFile(BENCH_SETUP_FILE, `${JSON.stringify(record, null, 2)}\n`);
// Written last: a profile without this stamp is not reused.
const stamp: BenchStamp = { generatorVersion: BENCH_GENERATOR_VERSION, schemaVersion: SCHEMA_VERSION };
await writeFile(BENCH_STAMP_FILE, `${JSON.stringify(stamp)}\n`);
console.log(`bench:setup OK: ${path.relative(process.cwd(), BENCH_PROFILE_DIR)} holds the artifact restored through the first-run Restore (0 issues, 0 repairs)`);
