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
// Instruments' rows) with bench/expected-open-rows.json. D5 (T5.22) also opens the as-of Review before
// and after the runs and compares the reflections it lists as due (its blockers, by Trade) with the
// generator's `asOfDueReflections` and `outstandingDebts` in bench/dataset.json; the time to render
// that Review is disclosed, not gated. D5R (T5R.13) then times, on the Review's cards and also disclosed and
// not gated, "open the first card" (the Review's `open` plus one `getTrade`), a Save Marks of one card's Marks, and a
// Trade Action save, each from the pointer press to the rendered result. It writes evidence/D05R/bench.md and fails
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
const EVIDENCE_FILE = path.resolve('evidence/D05R/bench.md');
const WAIT_MS = 60_000;
// D5's recorded results (evidence/D05/bench.md), which the report compares with.
const D5_COLD_P95_MS = 104.8;
const D5_WARM_P95_MS = 43.6;
const D5_REVIEW_OPEN_MS = { before: 2342, after: 2225 };
// Repetitions of each disclosed card timing (T5R.13).
const OPEN_CARD_RUNS = 10;
const SAVE_RUNS = 5;

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

// The reflections the as-of Review lists as due: its blockers read "Reflection due for X" or
// "N reflections due for X" for each Trade with due Debt. They must equal the generator's expected
// count and the Trades of its Outstanding Debts (both due at the as-of Review, decision 58).
const expectedDue = (dataset['asOfDueReflections'] as number | undefined) ?? Number.NaN;
const expectedDueByTrade = new Map<string, number>();
for (const debt of (dataset['outstandingDebts'] as { underlying: string }[] | undefined) ?? []) {
  expectedDueByTrade.set(debt.underlying, (expectedDueByTrade.get(debt.underlying) ?? 0) + 1);
}
interface DueComparison {
  readonly total: number;
  readonly byTrade: ReadonlyMap<string, number>;
  readonly renderMs: number;
}
const dueComparisons: { when: string; due: DueComparison }[] = [];
async function compareDueReflections(page: Page, when: string) {
  const pressed = Date.now();
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Review' }).click();
  const status = page.getByRole('region', { name: 'Review status' });
  await status.waitFor({ timeout: WAIT_MS });
  const renderMs = Date.now() - pressed;
  const reviewDate = await status.locator('time').first().getAttribute('datetime');
  const blockers = await status.getByRole('list', { name: 'Blockers' }).getByRole('listitem').allTextContents();
  const byTrade = new Map<string, number>();
  let total = 0;
  for (const text of blockers) {
    const found = /^(?:Reflection|(\d+) reflections) due for (.+)$/.exec(text.trim());
    if (!found) continue;
    const count = found[1] === undefined ? 1 : Number(found[1]);
    byTrade.set(found[2]!, (byTrade.get(found[2]!) ?? 0) + count);
    total += count;
  }
  const equal = reviewDate === dataset['reviewDate'] && total === expectedDue && isDeepStrictEqual([...byTrade].sort(), [...expectedDueByTrade].sort());
  console.log(`bench:run: as-of Review ${reviewDate} ${when}: ${total} due reflections (${[...byTrade].map(([t, n]) => `${t} ${n}`).join(', ') || 'none'}), ${equal ? 'equal to' : 'DIFFERENT from'} the expected ${expectedDue}`);
  dueComparisons.push({ when, due: { total, byTrade, renderMs } });
  if (!equal) throw new Error(`the as-of Review's due reflections ${when} differ from bench/dataset.json (${expectedDue} expected, Review Date ${String(dataset['reviewDate'])})`);
}

// ---- Card timings (D5R, T5R.13): disclosed, not gated ---------------------------------------------------------
// What "rendered" means for each timing. The condition is checked in the page on every DOM change, so the time is
// the first change after which it holds, read from the real clock (the same timeline as the pointer press).
type Rendered =
  | { readonly kind: 'cardLoaded' } // some card's content is shown and no card is still loading
  | { readonly kind: 'marksSaved'; readonly symbol: string } // the card's Save Marks counts no drafts: the same result cleared them
  | { readonly kind: 'actionSaved'; readonly symbol: string }; // the card's Action form is gone and no card is loading (the result replaced it)

// Runs `press` (one click) and returns the milliseconds from its pointer press to the rendered result.
async function pressToRendered(page: Page, rendered: Rendered, press: () => Promise<void>): Promise<number> {
  const waiting = await page.evaluate((r: Rendered) => {
    const w = window as unknown as { __realPerf: Performance; __cardPress?: number; __cardDone?: number };
    w.__cardPress = undefined;
    w.__cardDone = undefined;
    const loading = () => [...document.querySelectorAll('[role="status"]')].some((e) => (e.textContent ?? '').startsWith('Loading the Trade'));
    const holds = (): boolean => {
      if (r.kind === 'cardLoaded') return document.querySelector('section[aria-label$=" review"]') !== null && !loading();
      const card = `section[aria-label="${r.symbol} review"]`;
      if (r.kind === 'actionSaved') return document.querySelector(`${card} form[aria-label="Action"]`) === null && !loading();
      return [...document.querySelectorAll(`${card} section[aria-label="Marks"] button`)].some((b) => b.textContent === 'Save Marks (0)');
    };
    const observer = new MutationObserver(() => {
      if (w.__cardDone === undefined && holds()) {
        w.__cardDone = w.__realPerf.now();
        observer.disconnect();
      }
    });
    observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
    document.addEventListener('pointerdown', () => void (w.__cardPress ??= w.__realPerf.now()), { capture: true, once: true });
    return holds();
  }, rendered);
  if (waiting) throw new Error(`the rendered condition ${JSON.stringify(rendered)} already held before the press`);
  await press();
  const done = (await page
    .waitForFunction(() => (window as unknown as { __cardDone?: number }).__cardDone, null, { timeout: WAIT_MS, polling: 10 })
    .then((handle) => handle.jsonValue())) as number;
  const pressed = await page.evaluate(() => (window as unknown as { __cardPress?: number }).__cardPress);
  if (pressed === undefined) throw new Error('no pointer press was seen');
  return done - pressed;
}

const primaryLink = (page: Page, name: string) => page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name });
const cardOf = (page: Page, symbol: string) => page.getByRole('region', { name: `${symbol} review`, exact: true }).first();

// Leaves the Review for the Trades list, so the next press on Review opens it afresh.
async function leaveReview(page: Page) {
  await primaryLink(page, 'Trades').click();
  await page.getByRole('table', { name: 'Open Trades' }).waitFor({ timeout: WAIT_MS });
}

// From the press on Review to the first card's content: the Review's `open` plus one `getTrade`.
async function timeOpenFirstCard(page: Page): Promise<number> {
  await leaveReview(page);
  const ms = await pressToRendered(page, { kind: 'cardLoaded' }, () => primaryLink(page, 'Review').click());
  await page.getByRole('region', { name: 'Review status' }).waitFor({ timeout: WAIT_MS });
  return ms;
}

// Opens the Review afresh and the Trade's card, then waits for the card's content.
async function reachCard(page: Page, symbol: string) {
  await timeOpenFirstCard(page);
  const header = page.getByRole('button', { name: new RegExp(`^Review ${symbol.replace(/\./g, '\\.')}(?:\\s|$)`) }).first();
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
  const card = cardOf(page, symbol);
  await card.waitFor({ timeout: WAIT_MS });
  await page.getByRole('status').filter({ hasText: /^Loading the Trade/ }).waitFor({ state: 'detached', timeout: WAIT_MS });
  return card;
}

async function showPanel(card: ReturnType<typeof cardOf>, panel: 'Marks' | 'Action') {
  const name = new RegExp(`^${panel}\\b`);
  const header = card.getByRole('button', { name });
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
  await card.getByRole('button', { name, expanded: true }).waitFor({ timeout: WAIT_MS });
}

// A Save Marks of the Missing Instrument's Review-date price, from the press on Save Marks.
async function timeSaveMarks(page: Page, symbol: string): Promise<number> {
  const card = await reachCard(page, symbol);
  await showPanel(card, 'Marks');
  // The row's name carries the date as the Review shows it (Fri Dec 29), so it is found by the Instrument.
  await card.getByRole('list', { name: "Today's Marks" }).getByRole('region', { name: new RegExp(`^${symbol} Mark, `) }).getByLabel('Price').fill('51.00');
  const save = card.locator('section[aria-label="Marks"]').getByRole('button', { name: /^Save Marks/ });
  return pressToRendered(page, { kind: 'marksSaved', symbol }, () => save.click());
}

// A Hold Action save, from the press on Save in the card's Action form.
async function timeSaveAction(page: Page, symbol: string): Promise<number> {
  const card = await reachCard(page, symbol);
  await showPanel(card, 'Action');
  // The dataset holds an Action for every Trade on the Review Date, so this save is an edit of it (its Change button).
  await card.getByRole('button', { name: 'Change' }).click();
  const form = card.getByRole('form', { name: 'Action' });
  await form.getByRole('radio', { name: 'Hold', exact: true }).check();
  await form.getByLabel(/^Why are you taking this action\?/).fill('bench edit');
  return pressToRendered(page, { kind: 'actionSaved', symbol }, () => form.getByRole('button', { name: 'Save' }).click());
}

interface CardTimings {
  readonly openFirstCard: number[];
  readonly saveMarks: { symbol: string; ms: number }[];
  readonly saveAction: { symbol: string; ms: number }[];
}
async function timeCards(page: Page): Promise<CardTimings> {
  const timings: CardTimings = { openFirstCard: [], saveMarks: [], saveAction: [] };
  for (let run = 1; run <= OPEN_CARD_RUNS; run++) {
    timings.openFirstCard.push(await timeOpenFirstCard(page));
    console.log(`bench:run: open the first card ${run}/${OPEN_CARD_RUNS} ${timings.openFirstCard.at(-1)!.toFixed(1)} ms`);
  }
  for (const symbol of missing.slice(0, SAVE_RUNS)) {
    timings.saveMarks.push({ symbol, ms: await timeSaveMarks(page, symbol) });
    console.log(`bench:run: Save Marks ${symbol} ${timings.saveMarks.at(-1)!.ms.toFixed(1)} ms`);
  }
  // Cards whose Instrument is not Missing and whose Trade owes no reflection, in the Review's order.
  const owing = new Set(((dataset['outstandingDebts'] as { underlying: string }[] | undefined) ?? []).map((d) => d.underlying));
  await timeOpenFirstCard(page);
  const names = await page.locator('ol[aria-label="Positions"] .review-card-name').allTextContents();
  const symbols = [...new Set(names.map((n) => n.trim()))].filter((s) => !missing.includes(s) && !owing.has(s)).slice(0, SAVE_RUNS);
  for (const symbol of symbols) {
    timings.saveAction.push({ symbol, ms: await timeSaveAction(page, symbol) });
    console.log(`bench:run: Trade Action save ${symbol} ${timings.saveAction.at(-1)!.ms.toFixed(1)} ms`);
  }
  return timings;
}

let engine: string;
let cardTimings: CardTimings;
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
  await compareDueReflections(page, 'before the runs');
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
  await compareDueReflections(warmPage, 'after the runs');
  // Last, because the saves change the profile's copy.
  cardTimings = await timeCards(warmPage);
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

const dueLine = (c: { when: string; due: DueComparison }) =>
  `| ${c.when} | ${c.due.total} (${[...c.due.byTrade].map(([t, n]) => `${t} ${n}`).join(', ')}) | ${expectedDue} (${[...expectedDueByTrade].map(([t, n]) => `${t} ${n}`).join(', ')}) | equal | ${c.due.renderMs} ms |`;
const commit = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
const dirty = execFileSync('git', ['status', '--porcelain', '--', 'src', 'tools', 'bench', 'package.json']).toString().trim() !== '';

const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length / 2;
  return sorted.length % 2 === 1 ? sorted[Math.floor(mid)]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};
const spread = (values: readonly number[]) => `${values.length} | ${ms(median(values))} ms | ${ms(p95(values))} ms | ${ms(Math.min(...values))} ms | ${ms(Math.max(...values))} ms`;
const openCard = cardTimings!.openFirstCard;
const markMs = cardTimings!.saveMarks.map((s) => s.ms);
const actionMs = cardTimings!.saveAction.map((s) => s.ms);

const report = `# D5R benchmark run (AC-PERF-001)

Written by \`npm run bench:run\` (T2.21, extended by T4.31, T5.22 and T5R.13) on ${new Date().toISOString()}, at commit ${commit}${dirty ? ' plus uncommitted changes to src, tools, bench or package.json' : ''}.

## Result

| Measure | Runs | Nearest-rank p95 (29th of 30) | Budget | Result |
|---|---|---|---|---|
| Cold start to \`tj:interactive\` | ${cold.length} | ${ms(coldP95)} ms | ${COLD_BUDGET_MS.toLocaleString('en-US')} ms | ${coldPass ? 'pass' : 'FAIL'} |
| Warm Planned-to-Open switch to \`tj:open-list-ready\` | ${warm.length} | ${ms(warmP95)} ms | ${WARM_BUDGET_MS.toLocaleString('en-US')} ms | ${warmPass ? 'pass' : 'FAIL'} |

Open list compared with \`bench/expected-open-rows.json\`: before the runs ${before} rows equal, after the runs ${after} rows equal, and each of the ${RUNS} cold starts rendered the same ${expected.rows.length} rows (figures included). The ${missing.length} Missing Instruments on the as-of date (${missing.join(', ')}) have rows in that list, each showing \`Mark missing\` in P&L (and no other row does).

## As-of Review's due reflections (T5.22)

The harness opens the Review from the primary navigation and reads its blockers: each "Reflection due for X" or "N reflections due for X" is a reflection due at the as-of Review (Review Date ${String(dataset['reviewDate'])}). The expected values are \`asOfDueReflections\` and the Trades of \`outstandingDebts\` in \`bench/dataset.json\` (the Outstanding Debts are from ${((dataset['outstandingDebts'] as { momentDate: string }[] | undefined) ?? []).map((d) => d.momentDate).join(' and ')}, both due at the as-of Review, decision 58). A difference fails the run.

| When | Due reflections listed (by Trade) | Expected | Result | Time from the click on Review to its status (disclosed, not gated) |
|---|---|---|---|---|
${dueComparisons.map(dueLine).join('\n')}

## Card timings (T5R.13, disclosed, not gated)

Each is the time from the pointer press to the rendered result, on the mature dataset above. The thresholds in the first table are the only gates.

| Measure | Runs | Median | Nearest-rank p95 | Min | Max |
|---|---|---|---|---|---|
| Open the first card (press on Review to the first card's content: \`open\` plus one \`getTrade\`) | ${spread(openCard)} |
| Save Marks of one card's Marks (press on Save Marks to the card's drafts cleared) | ${spread(markMs)} |
| Trade Action save (press on Save in the Action form to the form replaced by the result) | ${spread(actionMs)} |

- **Against D5:** D5 measured the cold start at ${D5_COLD_P95_MS} ms and the warm switch at ${D5_WARM_P95_MS} ms (p95); this run's are ${ms(coldP95)} ms and ${ms(warmP95)} ms. D5 timed the press on Review to the Review's status at ${D5_REVIEW_OPEN_MS.before} ms before its runs and ${D5_REVIEW_OPEN_MS.after} ms after (single measurements); opening the first card here, which adds the first Trade's \`getTrade\`, takes a median of ${ms(median(openCard))} ms.
- **Tech debt item 3** (the Review's open cost grows with history) is measured here, not fixed: D5R takes the save path off it (P38) but not the first \`open\` of each Review, and the open-the-first-card timing is its baseline.
- **The saves** are timed on cards of the cached profile's copy: ${cardTimings!.saveMarks.map((s) => `Save Marks on ${s.symbol}`).join(', ')}; and a Hold Action on ${cardTimings!.saveAction.map((s) => s.symbol).join(', ')}. A Marks save fills the Instrument's Missing Review-date Mark with 51.00. The dataset holds an Action for every Trade on the Review Date, so each Action save is an edit of the saved Action (Change, Hold, an Intent of "bench edit", Save): a \`SaveTradeAction\` with the entry's expected revision, with the same post-save rebuild as a first save. The Review is opened afresh before each, which is not timed.
- **Raw timings (ms, in run order):** open the first card ${openCard.map(ms).join(', ')}; Save Marks ${markMs.map(ms).join(', ')}; Trade Action save ${actionMs.map(ms).join(', ')}.
- **Method:** a MutationObserver in the page reads the real clock on the first DOM change after which the result holds (the card's content shown with no card still loading; the card's Save Marks counting no drafts; the card's Action form gone with no card still loading), and a capture-phase pointer press records the start on the same clock.

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
