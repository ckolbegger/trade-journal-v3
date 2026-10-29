// npm run bench:generate: creates the D2 benchmark dataset (plan section 1.3) in a cached Chromium
// profile, once per generator version and schema version (D2 T2.20). It serves the bench build
// (`npm run build:bench`, dist-bench/) on the bench origin, lets its service worker take control
// so readiness is Writable, and runs the build's generator through the production facade. It then
// records the expected Open list and the dataset's provenance, removes the service-worker
// registration and Cache Storage from the profile, and stamps the profile with its versions.
// A profile whose stamp matches is reused; any other is deleted and regenerated.
import { readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { chromium, type Page } from '@playwright/test';
import { BENCH_CLOCK_START, BENCH_GENERATOR_MARKER, BENCH_GENERATOR_VERSION, BENCH_SEED, BENCH_TIME_ZONE, type BenchAsOf, type BenchCounts } from '../src/app/bench.ts';
import { SCHEMA_VERSION } from '../src/persistence/schema.ts';
import {
  BENCH_BUILD_DIR,
  BENCH_DATASET_FILE,
  BENCH_EXPECTED_ROWS_FILE,
  BENCH_PORT,
  BENCH_PROFILE_DIR,
  BENCH_STAMP_FILE,
  type BenchStamp,
  type ExpectedOpenRows,
} from './bench/profile.ts';
import { pinAsOf } from './bench/pin.ts';
import { listFiles } from './release.ts';
import { startReleaseServer } from './release-server.ts';

const wanted: BenchStamp = { generatorVersion: BENCH_GENERATOR_VERSION, schemaVersion: SCHEMA_VERSION };
// Generation takes on the order of an hour (D4 T4.30); `bench:` progress lines are echoed below.
const stamp = (await readFile(BENCH_STAMP_FILE, 'utf8').then(JSON.parse, () => undefined)) as BenchStamp | undefined;
if (stamp?.generatorVersion === wanted.generatorVersion && stamp.schemaVersion === wanted.schemaVersion) {
  console.log(`bench:generate OK: reusing the cached profile ${BENCH_PROFILE_DIR} (generator ${stamp.generatorVersion}, schema ${stamp.schemaVersion})`);
  process.exit(0);
}
console.log(
  stamp
    ? `bench:generate: cached profile is generator ${stamp.generatorVersion}, schema ${stamp.schemaVersion}; regenerating for generator ${wanted.generatorVersion}, schema ${wanted.schemaVersion}`
    : `bench:generate: no cached profile; generating for generator ${wanted.generatorVersion}, schema ${wanted.schemaVersion}`,
);

// The generator exists only in the bench build.
const bundled = await Promise.all(
  (await listFiles(BENCH_BUILD_DIR)).filter((f) => f.endsWith('.js')).map((f) => readFile(`${BENCH_BUILD_DIR}/${f}`, 'utf8')),
).catch(() => []);
if (!bundled.some((text) => text.includes(BENCH_GENERATOR_MARKER))) {
  console.error(`FAIL ${BENCH_BUILD_DIR}/ has no generator entry point; run npm run build:bench first`);
  process.exit(1);
}

await rm(BENCH_PROFILE_DIR, { recursive: true, force: true });
const server = await startReleaseServer({ root: process.cwd(), release: BENCH_BUILD_DIR, port: BENCH_PORT });
const origin = server.url;

// The release's service worker installs, verifies its inventory and claims the page.
async function controlled(page: Page) {
  await page.goto(origin);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  await page.waitForLoadState('load');
}

let result: { counts: BenchCounts; openItems: readonly unknown[] } & BenchAsOf;
let expected: Pick<ExpectedOpenRows, 'headers' | 'rows'>;
let release: string;
let generationMs: number;
let engine: string;
try {
  const context = await chromium.launchPersistentContext(BENCH_PROFILE_DIR, { headless: true });
  engine = `chromium ${context.browser()?.version() ?? ''}`.trim();
  const page = context.pages()[0] ?? (await context.newPage());
  page.on('console', (message) => {
    if (message.text().startsWith('bench:')) console.log(message.text());
  });
  await controlled(page);
  release = await page.evaluate(() => document.getElementById('root')?.dataset.release ?? '');
  const started = performance.now();
  result = await page.evaluate(() => window.__tjBench!.generate());
  generationMs = Math.round(performance.now() - started);

  // The Open list as the trader sees it at the as-of instant, for T2.21's before-and-after comparison.
  await pinAsOf(context, new Date(result.asOf));
  await page.goto(origin);
  const table = page.getByRole('table', { name: 'Open Trades' });
  await table.locator('tbody tr').nth(result.counts.openTrades - 1).waitFor({ timeout: 60_000 });
  expected = await table.evaluate((t: HTMLTableElement) => ({
    headers: [...t.tHead!.rows[0]!.cells].map((c) => c.textContent.trim()),
    rows: [...t.tBodies[0]!.rows].map((r) => [...r.cells].map((c) => c.textContent.trim())),
  }));

  // Leave only data in the profile: no service-worker registration, no Cache Storage.
  await page.evaluate(async () => {
    for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister();
    for (const key of await caches.keys()) await caches.delete(key);
  });
  await context.close();

  // Reopen the profile on a blank page of the same origin (nothing served) and confirm.
  const check = await chromium.launchPersistentContext(BENCH_PROFILE_DIR, { headless: true });
  await check.route(`${origin}/**`, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>check</title>' }));
  await server.close();
  const checkPage = check.pages()[0] ?? (await check.newPage());
  await checkPage.goto(`${origin}/bench-profile-check`);
  const left = await checkPage.evaluate(async () => ({
    registrations: (await navigator.serviceWorker.getRegistrations()).length,
    caches: (await caches.keys()).length,
    databases: (await indexedDB.databases()).map((d) => d.name ?? ''),
  }));
  await check.close();
  if (left.registrations !== 0 || left.caches !== 0) throw new Error(`profile still holds ${left.registrations} registrations and ${left.caches} caches`);
  console.log(`bench:generate: profile has 0 service-worker registrations, 0 caches, databases ${left.databases.sort().join(', ')}`);
} finally {
  await server.close();
}

const provenance = {
  generatorVersion: BENCH_GENERATOR_VERSION,
  schemaVersion: SCHEMA_VERSION,
  seed: BENCH_SEED,
  clockStart: BENCH_CLOCK_START,
  timeZone: BENCH_TIME_ZONE,
  origin,
  buildDir: BENCH_BUILD_DIR,
  benchRelease: release,
  asOf: result.asOf,
  reviewDate: result.reviewDate,
  missingInstruments: result.missingInstruments,
  counts: result.counts,
  actionsByChoice: result.actionsByChoice,
  generationMs,
  generatedAt: new Date().toISOString(),
  engine,
  host: { platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model ?? 'unknown', cores: os.cpus().length },
  profileDir: '.cache/bench/profile',
  expectedOpenRows: 'bench/expected-open-rows.json',
};
const rows: ExpectedOpenRows = { ...wanted, ...expected, items: result.openItems };
await writeFile(BENCH_DATASET_FILE, `${JSON.stringify(provenance, null, 2)}\n`);
// Exact values (Rational parts) are bigints; they are written as decimal strings.
await writeFile(BENCH_EXPECTED_ROWS_FILE, `${JSON.stringify(rows, (_, v: unknown) => (typeof v === 'bigint' ? v.toString() : v), 2)}\n`);
// Written last: a profile without this stamp is never reused.
await writeFile(BENCH_STAMP_FILE, `${JSON.stringify(wanted)}\n`);
console.log(`bench:generate OK: ${JSON.stringify(result.counts)} in ${generationMs} ms; profile ${BENCH_PROFILE_DIR}`);
