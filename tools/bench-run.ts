// npm run bench:run: the AC-PERF-001 latency harness (D2 T2.21, extended by D4 T4.31). It copies the cached benchmark
// profile (generating it first when missing or stale), serves the production build (dist/) on the
// bench origin, and runs one excluded warm-up launch that installs the service worker. With the
// server stopped and the browser offline it then times 30 cold starts (browser process stopped
// and relaunched each time) to the `tj:interactive` mark, and 30 warm Planned-to-Open tab
// switches to `tj:open-list-ready`. Both marks fire only after every Open row's figures (Net cost,
// P&L, entry) have rendered. `Date` and `Temporal.Now.instant` are pinned to the dataset's as-of instant (A52; Playwright
// `clock.setFixedTime` pins only `Date`, so tools/bench/pin.ts points native Temporal at it, T4.31-B1); timers and
// `performance.now` stay real. Before and after the runs, and
// after each cold start, it compares the rendered Open list (figures included, with the Missing
// Instruments' rows) with bench/expected-open-rows.json. It writes evidence/D04/bench.md and fails
// when either nearest-rank p95 exceeds its budget (cold 2,500 ms, warm 1,500 ms).
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { BENCH_GENERATOR_VERSION } from '../src/app/bench.ts';
import { SCHEMA_VERSION } from '../src/persistence/schema.ts';
import { BENCH_DATASET_FILE, BENCH_EXPECTED_ROWS_FILE, BENCH_PORT, BENCH_PROFILE_DIR, BENCH_STAMP_FILE, type BenchStamp, type ExpectedOpenRows } from './bench/profile.ts';
import { assertMissingRendered, assertPinned, pinAsOf } from './bench/pin.ts';
import { startReleaseServer } from './release-server.ts';

const RUNS = 30;
const COLD_BUDGET_MS = 2_500;
const WARM_BUDGET_MS = 1_500;
const BUILD_DIR = 'dist';
const EVIDENCE_FILE = path.resolve('evidence/D04/bench.md');
const WAIT_MS = 60_000;

// Nearest-rank p95: the ceil(0.95 × n)-th smallest value (the 29th of 30).
function p95(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.95 * sorted.length) - 1]!;
}

const npm = (script: string) => execFileSync('npm', ['run', script], { stdio: 'inherit' });

// The cached profile must match this source's generator and schema versions.
const stamp = (await readFile(BENCH_STAMP_FILE, 'utf8').then(JSON.parse, () => undefined)) as BenchStamp | undefined;
if (stamp?.generatorVersion !== BENCH_GENERATOR_VERSION || stamp.schemaVersion !== SCHEMA_VERSION) {
  console.log('bench:run: the cached profile is missing or stale; generating it');
  npm('build:bench');
  npm('bench:generate');
}
// Measurement runs the production build.
npm('build');

const expected = JSON.parse(await readFile(BENCH_EXPECTED_ROWS_FILE, 'utf8')) as ExpectedOpenRows;
const dataset = JSON.parse(await readFile(BENCH_DATASET_FILE, 'utf8')) as Record<string, unknown>;

const workDir = await mkdtemp(path.join(os.tmpdir(), 'tj-bench-run-'));
const profile = path.join(workDir, 'profile');
await cp(BENCH_PROFILE_DIR, profile, { recursive: true });

const server = await startReleaseServer({ root: process.cwd(), release: BUILD_DIR, port: BENCH_PORT });
const origin = server.url;
let serving = true;

const missing = (dataset['missingInstruments'] as string[] | undefined) ?? [];
const asOf = new Date(String(dataset['asOf']));
if (Number.isNaN(asOf.getTime())) throw new Error('bench/dataset.json has no asOf instant; regenerate the profile');
// A52: `Date` and Temporal are pinned; timers and `performance.now` stay real.
const launched: BrowserContext[] = [];
const launch = async (offline: boolean) => {
  const context = await chromium.launchPersistentContext(profile, { headless: true, offline });
  launched.push(context);
  // Playwright's clock also replaces `window.performance` with a fake whose marks are never recorded
  // (getEntries is empty), though its `now` is real. So the real object is kept before the pin, and
  // the fake's `mark` is pointed at it after, so the app's `tj:` marks land where the harness reads.
  await context.addInitScript(() => ((window as unknown as { __realPerf: Performance }).__realPerf = performance));
  await pinAsOf(context, asOf);
  await context.addInitScript(() => {
    const real = (window as unknown as { __realPerf: Performance }).__realPerf;
    (performance as unknown as { mark: (name: string) => void }).mark = (name) => void real.mark(name);
  });
  return context;
};
const pageOf = async (context: BrowserContext) => context.pages()[0] ?? (await context.newPage());

const markTime = (page: Page, name: string) =>
  page
    .waitForFunction((n) => (window as unknown as { __realPerf: Performance }).__realPerf.getEntriesByName(n, 'mark')[0]?.startTime, name, { timeout: WAIT_MS, polling: 10 })
    .then((handle) => handle.jsonValue() as Promise<number>);

// The Open list as rendered, compared with the generator's expected rows.
async function compareOpenList(page: Page, when: string, log = true) {
  const table = page.getByRole('table', { name: 'Open Trades' });
  await table.locator('tbody tr').nth(expected.rows.length - 1).waitFor({ timeout: WAIT_MS });
  const rendered = await table.evaluate((t: HTMLTableElement) => ({
    headers: [...t.tHead!.rows[0]!.cells].map((c) => c.textContent.trim()),
    rows: [...t.tBodies[0]!.rows].map((r) => [...r.cells].map((c) => c.textContent.trim())),
  }));
  await assertPinned(page, asOf);
  assertMissingRendered(rendered.rows, missing);
  const equal = isDeepStrictEqual(rendered.headers, expected.headers) && isDeepStrictEqual(rendered.rows, expected.rows);
  if (log) console.log(`bench:run: Open list ${when}: ${rendered.rows.length} rows, ${equal ? 'equal to' : 'DIFFERENT from'} the expected rows`);
  if (!equal) throw new Error(`the Open list ${when} differs from ${path.relative(process.cwd(), BENCH_EXPECTED_ROWS_FILE)}`);
  return rendered.rows.length;
}

let engine: string;
const cold: number[] = [];
// Disclosed, not gated: from the call that launches the browser process to the same mark.
const launchToMark: number[] = [];
const warm: number[] = [];
let before: number;
let after: number;
try {
  // Warm-up (excluded): online, so the release's service worker installs and claims the page.
  const warmUp = await launch(false);
  engine = `Chromium ${warmUp.browser()?.version() ?? ''}`.trim();
  const page = await pageOf(warmUp);
  await page.goto(origin);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: WAIT_MS });
  await markTime(page, 'tj:interactive');
  before = await compareOpenList(page, 'before the runs');
  await warmUp.close();

  // No network from here on: the server is stopped and every launch is offline.
  await server.close();
  serving = false;

  for (let run = 1; run <= RUNS; run++) {
    const launched = Date.now();
    const context = await launch(true);
    const coldPage = await pageOf(context);
    await coldPage.goto(origin);
    const interactive = await markTime(coldPage, 'tj:interactive');
    cold.push(interactive);
    launchToMark.push((await coldPage.evaluate(() => (window as unknown as { __realPerf: Performance }).__realPerf.timeOrigin)) + interactive - launched);
    // Each timed start rendered the whole Open list with every row's figures.
    await compareOpenList(coldPage, `at cold start ${run}`, false);
    await context.close();
    console.log(`bench:run: cold ${run}/${RUNS} ${cold.at(-1)!.toFixed(1)} ms`);
  }

  const context = await launch(true);
  const warmPage = await pageOf(context);
  await warmPage.goto(origin);
  await markTime(warmPage, 'tj:interactive');
  // The switch starts at the pointer press on the Open tab.
  await warmPage.evaluate(() => {
    document.addEventListener('pointerdown', () => ((window as unknown as { __benchPress: number }).__benchPress = performance.now()), true);
  });
  for (let run = 1; run <= RUNS; run++) {
    await warmPage.getByRole('tab', { name: 'Planned' }).click();
    await warmPage.getByRole('table', { name: 'Planned Trades' }).waitFor({ timeout: WAIT_MS });
    await warmPage.evaluate(() => (window as unknown as { __realPerf: Performance }).__realPerf.clearMarks('tj:open-list-ready'));
    await warmPage.getByRole('tab', { name: 'Open' }).click();
    const ready = await markTime(warmPage, 'tj:open-list-ready');
    const pressed = await warmPage.evaluate(() => (window as unknown as { __benchPress: number }).__benchPress);
    warm.push(ready - pressed);
    console.log(`bench:run: warm ${run}/${RUNS} ${warm.at(-1)!.toFixed(1)} ms`);
  }
  after = await compareOpenList(warmPage, 'after the runs');
  await context.close();
} finally {
  // Closing an already closed context is a no-op; a failure must not leave Chromium on a removed profile.
  for (const context of launched) await context.close();
  if (serving) await server.close();
  await rm(workDir, { recursive: true, force: true });
}

const coldP95 = p95(cold);
const warmP95 = p95(warm);
const coldPass = coldP95 <= COLD_BUDGET_MS;
const warmPass = warmP95 <= WARM_BUDGET_MS;
const ms = (v: number) => v.toFixed(1);
const playwrightVersion = (JSON.parse(await readFile('node_modules/@playwright/test/package.json', 'utf8')) as { version: string }).version;
const cpus = os.cpus();

const report = `# D4 benchmark run (AC-PERF-001)

Written by \`npm run bench:run\` (T2.21, extended by T4.31) on ${new Date().toISOString()}.

## Result

| Measure | Runs | Nearest-rank p95 (29th of 30) | Budget | Result |
|---|---|---|---|---|
| Cold start to \`tj:interactive\` | ${cold.length} | ${ms(coldP95)} ms | ${COLD_BUDGET_MS.toLocaleString('en-US')} ms | ${coldPass ? 'pass' : 'FAIL'} |
| Warm Planned-to-Open switch to \`tj:open-list-ready\` | ${warm.length} | ${ms(warmP95)} ms | ${WARM_BUDGET_MS.toLocaleString('en-US')} ms | ${warmPass ? 'pass' : 'FAIL'} |

Open list compared with \`bench/expected-open-rows.json\`: before the runs ${before} rows equal, after the runs ${after} rows equal, and each of the ${RUNS} cold starts rendered the same ${expected.rows.length} rows (figures included). The ${missing.length} Missing Instruments on the as-of date (${missing.join(', ')}) have rows in that list, each showing \`Mark missing\` in P&L (and no other row does).

## Superseded run (T4.31, before T4.31-B1)

The earlier run pinned only \`Date\`, so the application's Temporal clock read the real day and the Open list (and the expected rows captured the same way) was rendered for a different Expected Mark Date: 87 rows showed \`Awaiting the next close\` and no row showed \`Mark missing\`. Its figures are not valid evidence for the as-of dataset: cold p95 98.9 ms (median 93.0 ms), warm p95 44.4 ms (median 41.1 ms), process launch to mark p95 171.4 ms.

## Method

- Playwright's clock also swaps \`window.performance\` for a fake that records no marks, so the harness keeps the real object before the pin and points the fake's \`mark\` at it; \`performance.now\` and timers are the real ones.
- \`Date\` is pinned to the dataset's as-of instant (${asOf.toISOString()}, A52) with Playwright \`context.clock.setFixedTime\`, and native \`Temporal.Now.instant\` (the application's clock) is pointed at it (T4.31-B1); every comparison first checks both read the as-of instant and that exactly the Missing Instruments' rows show \`Mark missing\`. Timers and \`performance.now\` are real, and the build is production.
- A copy of the cached profile (\`.cache/bench/profile\`, generator ${String(dataset['generatorVersion'])}, schema ${String(dataset['schemaVersion'])}) per run of the harness; the cached profile itself is never opened.
- The production build (\`${BUILD_DIR}/\`) served by the release harness server at ${origin}, the origin the profile's IndexedDB belongs to.
- One warm-up launch, online, installs the service worker and is excluded. The server is then stopped and every later launch is offline (Playwright \`offline: true\`), so the app loads from the service worker and IndexedDB only.
- Cold start: the Chromium process is launched on the profile, navigates to the origin, and the time is the \`tj:interactive\` mark's \`startTime\` (from navigation start; readiness Writable and the Open list fully rendered with every row's figures, each run's rendered list compared with the expected rows afterwards); the process is then closed. The time from the call that launches the browser process to the same mark is recorded beside it for disclosure and is not gated.
- Warm switch: in one launched page, the Planned tab is opened and its first page rendered, then the Open tab is clicked; the time runs from the pointer press on the Open tab to the next \`tj:open-list-ready\` mark.

## Raw timings (ms, in run order)

| Run | Cold (navigation start to mark) | Cold, disclosed: process launch to mark | Warm |
|---|---|---|---|
${cold.map((c, i) => `| ${i + 1} | ${ms(c)} | ${ms(launchToMark[i]!)} | ${ms(warm[i]!)} |`).join('\n')}

Sorted cold: ${[...cold].sort((a, b) => a - b).map(ms).join(', ')}

Process launch to mark (not gated): p95 ${ms(p95(launchToMark))} ms.

Sorted warm: ${[...warm].sort((a, b) => a - b).map(ms).join(', ')}

## Environment

| Item | Value |
|---|---|
| Hardware | ${cpus[0]?.model ?? 'unknown'}, ${cpus.length} cores, ${Math.round(os.totalmem() / 2 ** 30)} GiB memory, ${os.arch()} |
| OS | ${os.type()} ${os.release()} (${os.platform()}) |
| Browser engine | ${engine}, headless, via Playwright ${playwrightVersion} |
| Node | ${process.version} |

## Dataset provenance (\`bench/dataset.json\`)

\`\`\`json
${JSON.stringify(dataset, null, 2)}
\`\`\`
`;
await writeFile(EVIDENCE_FILE, report);
console.log(`bench:run: cold p95 ${ms(coldP95)} ms (budget ${COLD_BUDGET_MS}), warm p95 ${ms(warmP95)} ms (budget ${WARM_BUDGET_MS}); wrote ${path.relative(process.cwd(), EVIDENCE_FILE)}`);
if (!coldPass || !warmPass) {
  console.error('bench:run FAIL: a p95 exceeds its budget');
  process.exit(1);
}
console.log('bench:run OK');
