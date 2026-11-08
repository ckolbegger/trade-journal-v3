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
// Trade Action save, each from the pointer press to the rendered result. D6 (T6.25) also compares, before and after the
// runs, the first Closed page (each row's Trade, Underlying and Close date) with the first 50 Closed Trades of the stored
// `byLifecycleTerminal` index, read raw in the page (the generator records no Closed page, so the expectation is
// derived from the stored data), and the as-of Review's walk and owed-reflection group (each card's Trade and
// Underlying) with `asOfReview` in bench/dataset.json. It discloses, ungated, the Closed page's render time and a
// single Daily Trade Review Action save at the as-of Review, cold (fresh browser process) and warm. D7 (T7.29) also compares,
// before and after the runs, the as-of Review's settlement family (each item's Trade, contract, open quantity and expiration
// date, from its blocker and its card's Settlement panel) with `asOfReview.settlement`, on the profile with 30% option Trades. It writes
// evidence/D07/bench.md and fails when either nearest-rank p95 exceeds its budget (cold 2,500 ms, warm 1,500 ms).
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { chromium, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { BENCH_GENERATOR_VERSION, BENCH_TIME_ZONE, expectedSettlementDue, type BenchAsOfReview } from '../src/app/bench.ts';
import { SCHEMA_VERSION } from '../src/persistence/schema.ts';
import { cardIdentity, closedIdentity, expectedSettlementIdentity, firstDifference, settlementExpectations, settlementIdentity, tradeIdOfHref, walkedTradesOwingNothing, type ExpectedClosedRow } from './bench/compare.ts';
import { BENCH_DATASET_FILE, BENCH_EXPECTED_ROWS_FILE, BENCH_PORT, BENCH_PROFILE_DIR, BENCH_STAMP_FILE, type BenchStamp, type ExpectedOpenRows } from './bench/profile.ts';
import { schemaMismatch } from './bench/partial.ts';
import { assertMissingRendered, assertPinned, pinAsOf } from './bench/pin.ts';
import { startReleaseServer } from './release-server.ts';

const RUNS = 30;
const COLD_BUDGET_MS = 2_500;
const WARM_BUDGET_MS = 1_500;
const BUILD_DIR = 'dist';
const EVIDENCE_FILE = path.resolve('evidence/D07/bench.md');
const WAIT_MS = 60_000;
// D5's recorded results (evidence/D05/bench.md), which the report compares with.
const D5_COLD_P95_MS = 104.8;
const D5_WARM_P95_MS = 43.6;
const D5_REVIEW_OPEN_MS = { before: 2342, after: 2225 };
// D5R2's results on the same generator-3 dataset (evidence/D05R2/bench.md).
const D5R2_COLD_P95_MS = 96.2;
const D5R2_WARM_P95_MS = 47.3;
// Repetitions of each disclosed card timing (T5R.13).
const OPEN_CARD_RUNS = 10;
const SAVE_RUNS = 5;
// D6 (T6.25), disclosed and not gated: Closed page renders, and Action saves on a fresh browser process.
const CLOSED_PAGE_RUNS = 10;
const COLD_SAVE_RUNS = 3;
// A Closed page holds 50 rows (trade-record's CLOSED_PAGE_SIZE).
const CLOSED_PAGE_SIZE = 50;

// Nearest-rank p95: the ceil(0.95 × n)-th smallest value (the 29th of 30).
function p95(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.95 * sorted.length) - 1]!;
}

const npm = (script: string) => execFileSync('npm', ['run', script], { stdio: 'inherit' });

// `--partial <dir>` (T6.25-P1) runs on a partial dataset prepared by `npm run bench:partial -- <dir>`: its profile is
// `<dir>/run-profile`, its provenance `<dir>/dataset.json`, and there is no generator stamp or expected-rows file. The
// Open list, the Review's walk and owed group, and its due reflections are then compared by membership with the stored
// data (derived in bench:partial) and, for what the stored data cannot fix (the rows' figures, the attention-ranked
// order, which reflections are due), with the first render, which every later render must equal.
const partialAt = process.argv.indexOf('--partial');
const partialDir = partialAt === -1 ? undefined : path.resolve(process.argv[partialAt + 1] ?? '');
if (partialAt !== -1 && !process.argv[partialAt + 1]) throw new Error('--partial needs the dataset directory');
const partial = partialDir !== undefined;

// The cached profile must match this source's generator and schema versions.
const stamp = partial ? undefined : ((await readFile(BENCH_STAMP_FILE, 'utf8').then(JSON.parse, () => undefined)) as BenchStamp | undefined);
if (!partial && (stamp?.generatorVersion !== BENCH_GENERATOR_VERSION || stamp.schemaVersion !== SCHEMA_VERSION)) {
  console.log('bench:run: the cached profile is missing or stale; generating it');
  npm('build:bench');
  npm('bench:generate');
}
// Measurement runs the production build.
npm('build');

const dataset = JSON.parse(await readFile(partial ? path.join(partialDir, 'dataset.json') : BENCH_DATASET_FILE, 'utf8')) as Record<string, unknown>;
if (partial && dataset['partial'] !== true) throw new Error(`${partialDir}/dataset.json is not marked partial`);
if (partial) {
  const mismatch = schemaMismatch(dataset['schemaVersion'], SCHEMA_VERSION);
  if (mismatch) throw new Error(`${partialDir}/dataset.json is stale: ${mismatch}; rerun bench:partial`);
}
// The Open list to compare with: the generator's, or (partial) the first render's.
let expected: Pick<ExpectedOpenRows, 'headers' | 'rows'> | undefined = partial ? undefined : (JSON.parse(await readFile(BENCH_EXPECTED_ROWS_FILE, 'utf8')) as ExpectedOpenRows);
const partialCounts = partial ? (dataset['counts'] as { openTrades: number }) : undefined;
const openRowCount = () => expected?.rows.length ?? partialCounts!.openTrades;

const workDir = await mkdtemp(path.join(os.tmpdir(), 'tj-bench-run-'));
const profile = path.join(workDir, 'profile');
await cp(partial ? path.join(partialDir, 'run-profile') : BENCH_PROFILE_DIR, profile, { recursive: true });

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
  await table.locator('tbody tr').nth(openRowCount() - 1).waitFor({ timeout: WAIT_MS });
  const rendered = await table.evaluate((t: HTMLTableElement) => ({
    headers: [...t.tHead!.rows[0]!.cells].map((c) => c.textContent.trim()),
    rows: [...t.tBodies[0]!.rows].map((r) => [...r.cells].map((c) => c.textContent.trim())),
  }));
  await assertPinned(page, asOf);
  if (partial && missing.length === 0) {
    // The last session of the partial dataset saved every Instrument's Mark, so no row may show a missing one.
    const flagged = rendered.rows.filter((r) => r[3]!.startsWith('Mark missing')).map((r) => r[0]);
    if (flagged.length > 0) throw new Error(`the Open list shows Mark missing for ${flagged.join(', ')}, though every Instrument has the as-of Mark`);
  } else {
    assertMissingRendered(rendered.rows, missing);
  }
  if (!expected) {
    // Partial dataset, first render: the Open list must be exactly the stored Open Trades' Underlyings; its figures become the baseline.
    const symbols = rendered.rows.map((r) => r[0]!).sort();
    if (!isDeepStrictEqual(symbols, dataset['openUnderlyings'])) throw new Error(`the Open list's Underlyings differ from the stored Open Trades': ${symbols.length} rendered, ${(dataset['openUnderlyings'] as string[]).length} stored`);
    expected = { headers: rendered.headers, rows: rendered.rows };
    console.log(`bench:run: Open list baseline taken ${when}: ${rendered.rows.length} rows, the stored Open Trades' Underlyings`);
  }
  const equal = isDeepStrictEqual(rendered.headers, expected.headers) && isDeepStrictEqual(rendered.rows, expected.rows);
  if (log) console.log(`bench:run: Open list ${when}: ${rendered.rows.length} rows, ${equal ? 'equal to' : 'DIFFERENT from'} the expected rows`);
  if (!equal) throw new Error(`the Open list ${when} differs from ${path.relative(process.cwd(), BENCH_EXPECTED_ROWS_FILE)}`);
  return rendered.rows.length;
}

// The reflections the as-of Review lists as due: its blockers read "Reflection due for X" or
// "N reflections due for X" for each Trade with due Debt, X naming the Trade in full ("QAJ (Long 120 shares @ $300.97)",
// A150); the harness compares X's underlying symbol (up to the first " ("). They must equal the generator's expected
// count and the Trades of its Outstanding Debts (both due at the as-of Review, decision 58).
let expectedDue = (dataset['asOfDueReflections'] as number | undefined) ?? Number.NaN;
let expectedDueByTrade = new Map<string, number>();
for (const debt of (dataset['outstandingDebts'] as { underlying: string }[] | undefined) ?? []) {
  expectedDueByTrade.set(debt.underlying, (expectedDueByTrade.get(debt.underlying) ?? 0) + 1);
}
let dueBaselineTaken = !partial;
interface DueComparison {
  readonly total: number;
  readonly byTrade: ReadonlyMap<string, number>;
  readonly renderMs: number;
}
const dueComparisons: { when: string; due: DueComparison }[] = [];

// ---- Closed page, Review walk and owed group (D6, T6.25) ------------------------------------------------------
// The generator records the Review's identities (`asOfReview`) but no Closed page, so the expected Closed page is the
// first CLOSED_PAGE_SIZE Closed Trades of the stored `byLifecycleTerminal` index (terminal time descending), read raw
// from the profile's IndexedDB before any timed run; the Underlying of each walked Trade is read the same way, since
// the dataset records only the walk's identities. The comparison is then between the stored records and what the
// facade and UI render.
// Partial dataset: the stored data fixes the walk's and the owed group's membership (sorted identities in the dataset), not
// their order, so the first rendered Review sets the order every later one must equal.
const asOfReview = dataset['asOfReview'] as BenchAsOfReview | undefined;
if (!asOfReview && !partial) throw new Error('bench/dataset.json has no asOfReview (generator 4 or later); regenerate the profile');
let expectedClosedIdentities: string[] = [];
let expectedWalkIdentities: string[] = [];
let expectedOwedIdentities: string[] = asOfReview ? asOfReview.owedGroup.map((t) => cardIdentity(t.tradeId, t.underlying)) : [];
let reviewOrderTaken = !partial;
const partialWalk = (dataset['walkIdentities'] as string[] | undefined) ?? [];
const partialOwed = (dataset['owedIdentities'] as string[] | undefined) ?? [];
const walkSize = () => (partial ? partialWalk.length : expectedWalkIdentities.length);
const owedSize = () => (partial ? partialOwed.length : expectedOwedIdentities.length);

async function deriveExpectedIdentities(page: Page) {
  const stored = await page.evaluate(
    async ({ walk, size }) => {
      const asPromise = <T,>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => ((r.onsuccess = () => resolve(r.result)), (r.onerror = () => reject(r.error ?? new Error('request failed')))));
      const names = (await indexedDB.databases()).map((d) => d.name).filter((n): n is string => n?.startsWith('tj-ws-') === true);
      if (names.length !== 1) throw new Error(`expected one Workspace database, found ${names.length}`);
      const db = await asPromise(indexedDB.open(names[0]!));
      try {
        const trades = db.transaction('trades').objectStore('trades');
        const closed = (await asPromise(trades.index('byLifecycleTerminal').getAll(IDBKeyRange.bound(['Closed'], ['Closed', []]), size))) as { tradeId: string; underlying: string; terminalTime: string }[];
        const underlyings: Record<string, string> = {};
        for (const id of walk) underlyings[id] = ((await asPromise(trades.get(id))) as { underlying: string } | undefined)?.underlying ?? '';
        return { closed: closed.map(({ tradeId, underlying, terminalTime }) => ({ tradeId, underlying, terminalTime })), underlyings };
      } finally {
        db.close();
      }
    },
    { walk: asOfReview?.walk ?? [], size: CLOSED_PAGE_SIZE },
  );
  expectedClosedIdentities = stored.closed.map((row: ExpectedClosedRow) => closedIdentity(row, BENCH_TIME_ZONE));
  if (expectedClosedIdentities.length === 0) throw new Error('the stored Workspace holds no Closed Trade');
  if (partial) {
    if (partialWalk.length === 0) throw new Error('the partial dataset has an empty walk, so the Review walk would be compared vacuously');
    if (partialOwed.length === 0) throw new Error('the partial dataset has an empty owed group, so the owed group would be compared vacuously');
    return;
  }
  expectedWalkIdentities = asOfReview!.walk.map((id) => cardIdentity(id, stored.underlyings[id]!));
  if (expectedWalkIdentities.length === 0) throw new Error('asOfReview.walk is empty, so the Review walk would be compared vacuously');
  if (expectedOwedIdentities.length === 0) throw new Error('asOfReview.owedGroup is empty, so the owed group would be compared vacuously');
  if (expectedWalkIdentities.some((id) => id.endsWith(' '))) throw new Error('a Trade in asOfReview.walk is not stored');
}

// The Closed tab's first page: each row's Trade (from its link), Underlying and Close date, in order.
async function compareClosedPage(page: Page, when: string): Promise<number> {
  const pressed = Date.now();
  await primaryLink(page, 'Trades').click();
  await page.getByRole('tab', { name: 'Closed' }).click();
  const table = page.getByRole('table', { name: 'Closed Trades' });
  await table.locator('tbody tr').nth(expectedClosedIdentities.length - 1).waitFor({ timeout: WAIT_MS });
  const renderMs = Date.now() - pressed;
  const rendered = await table.evaluate((t: HTMLTableElement) =>
    [...t.tBodies[0]!.rows].map((r) => ({ href: r.cells[0]!.querySelector('a')!.getAttribute('href')!, underlying: r.cells[0]!.textContent.trim(), closeDate: r.cells[6]!.textContent.trim() })),
  );
  const identities = rendered.map((r) => `${tradeIdOfHref(r.href)} ${r.underlying} ${r.closeDate}`);
  const difference = firstDifference(expectedClosedIdentities, identities);
  console.log(`bench:run: first Closed page ${when}: ${identities.length} rows, ${difference ? `DIFFERENT (${difference})` : 'equal to the stored first Closed Trades'}`);
  if (difference) throw new Error(`the first Closed page ${when} differs from the stored Closed Trades: ${difference}`);
  return renderMs;
}

// The Review's cards as rendered: the walk's and the owed group's Trade and Underlying, in order.
async function readReviewCards(page: Page) {
  const read = (list: string) => page.locator(`${list} > li.review-card`).evaluateAll((items) => items.map((li) => `${li.getAttribute('data-trade-id')} ${li.querySelector('.review-card-name')?.textContent.trim() ?? ''}`));
  if (walkSize() > 0) await page.locator('ol[aria-label="Positions"] > li.review-card').nth(walkSize() - 1).waitFor({ timeout: WAIT_MS });
  if (owedSize() > 0) await page.locator('ol[aria-labelledby="owed-group-heading"] > li.review-card').nth(owedSize() - 1).waitFor({ timeout: WAIT_MS });
  return { walk: await read('ol[aria-label="Positions"]'), owed: await read('ol[aria-labelledby="owed-group-heading"]') };
}
const reviewCardComparisons: { when: string; walk: number; owed: number }[] = [];
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
    const underlying = found[2]!.split(' (')[0]!;
    byTrade.set(underlying, (byTrade.get(underlying) ?? 0) + count);
    total += count;
  }
  if (!dueBaselineTaken) {
    // Partial dataset, first render: which reflections are due is the app's rule (one session of grace), not stored, so
    // the first render sets it. Every Trade it names must hold an Outstanding Debt in the stored data.
    const owing = new Set(dataset['outstandingUnderlyings'] as string[]);
    const strangers = [...byTrade.keys()].filter((t) => !owing.has(t));
    if (strangers.length > 0) throw new Error(`the as-of Review lists reflections due for ${strangers.join(', ')}, which hold no Outstanding Debt in the stored data`);
    expectedDue = total;
    expectedDueByTrade = new Map(byTrade);
    dueBaselineTaken = true;
    console.log(`bench:run: due reflections baseline taken ${when}: ${total}`);
  }
  const equal = reviewDate === dataset['reviewDate'] && total === expectedDue && isDeepStrictEqual([...byTrade].sort(), [...expectedDueByTrade].sort());
  console.log(`bench:run: as-of Review ${reviewDate} ${when}: ${total} due reflections (${[...byTrade].map(([t, n]) => `${t} ${n}`).join(', ') || 'none'}), ${equal ? 'equal to' : 'DIFFERENT from'} the expected ${expectedDue}`);
  dueComparisons.push({ when, due: { total, byTrade, renderMs } });
  if (!equal) throw new Error(`the as-of Review's due reflections ${when} differ from bench/dataset.json (${expectedDue} expected, Review Date ${String(dataset['reviewDate'])})`);
  // D6: the walk and the owed-reflection group are the dataset's identities, in order.
  const cards = await readReviewCards(page);
  if (!reviewOrderTaken) {
    // Partial dataset, first render: the walk and the owed group must be exactly the stored data's members; their order is the baseline.
    const walkDiff = firstDifference(partialWalk, [...cards.walk].sort());
    const owedDiff = firstDifference(partialOwed, [...cards.owed].sort());
    if (walkDiff) throw new Error(`the as-of Review's walk is not the Trades open at the close in the stored data: ${walkDiff}`);
    if (owedDiff) throw new Error(`the as-of Review's owed group is not the Trades outside the walk with an Outstanding Debt in the stored data: ${owedDiff}`);
    expectedWalkIdentities = cards.walk;
    expectedOwedIdentities = cards.owed;
    reviewOrderTaken = true;
    console.log(`bench:run: Review order baseline taken ${when}: ${cards.walk.length} walked and ${cards.owed.length} owed cards, the stored data's members`);
  }
  const walkDifference = firstDifference(expectedWalkIdentities, cards.walk);
  const owedDifference = firstDifference(expectedOwedIdentities, cards.owed);
  console.log(`bench:run: as-of Review ${when}: walk ${cards.walk.length} cards ${walkDifference ? `DIFFERENT (${walkDifference})` : 'equal'}, owed group ${cards.owed.length} cards ${owedDifference ? `DIFFERENT (${owedDifference})` : 'equal'}`);
  if (walkDifference) throw new Error(`the as-of Review's walk ${when} differs from asOfReview.walk: ${walkDifference}`);
  if (owedDifference) throw new Error(`the as-of Review's owed-reflection group ${when} differs from asOfReview.owedGroup: ${owedDifference}`);
  reviewCardComparisons.push({ when, walk: cards.walk.length, owed: cards.owed.length });
}

// ---- The as-of Review's settlement family (D7, T7.29) ---------------------------------------------------------
// The Review lists a "Settlement Due for <contract>, which expired <date>" blocker for each settlement item, linking to the
// Trade's card. The comparison is the blockers in the Review's order, each by its Trade (from the link), contract and
// expiration date, plus the open quantity and contract that the Trade's Settlement panel shows once the link has opened its
// card, with `asOfReview.settlement` in bench/dataset.json (the family in the Review's order: expiration date, then Trade).
const settlementComparisons: { when: string; items: number }[] = [];
// The generator's rule: its Settlement Due contracts at the as-of Review, fewer when the profile has fewer Open option Trades;
// a partial dataset records none.
const EXPECTED_SETTLEMENT_DUE = expectedSettlementDue({ partial, openOptionTrades: (dataset['counts'] as Record<string, number>)['openOptionTrades'] ?? 0 });
async function compareSettlement(page: Page, when: string) {
  const expectedItems = settlementExpectations(asOfReview?.settlement, EXPECTED_SETTLEMENT_DUE);
  if (!expectedItems) return;
  const expectedIdentities = expectedItems.map(expectedSettlementIdentity);
  const status = page.getByRole('region', { name: 'Review status' });
  const blockers = await status
    .getByRole('list', { name: 'Blockers' })
    .getByRole('listitem')
    .evaluateAll((items) => items.filter((li) => (li.textContent ?? '').startsWith('Settlement Due for ')).map((li) => ({ text: (li.textContent ?? '').trim(), href: li.querySelector('a')?.getAttribute('href') ?? '' })));
  const identities: string[] = [];
  for (const blocker of blockers) {
    const words = /^Settlement Due for (.+), which expired (.+)$/.exec(blocker.text);
    const tradeId = new URLSearchParams(blocker.href.split('?')[1] ?? '').get('trade');
    if (!words || !tradeId) {
      identities.push(`unreadable blocker "${blocker.text}" (${blocker.href})`);
      continue;
    }
    await status.locator(`a[href="${blocker.href}"]`).click();
    const panel = page.locator(`li[data-trade-id="${tradeId}"] section[aria-label="Settlement"]`);
    await panel.waitFor({ state: 'attached', timeout: WAIT_MS });
    const shown = await panel.locator('dd').allTextContents();
    const panelContract = shown[0]?.trim() ?? '';
    identities.push(settlementIdentity(tradeId, panelContract === words[1] ? words[1] : `${words[1]} (panel: ${panelContract})`, shown[1]?.trim() ?? '', words[2]!));
  }
  const difference = firstDifference(expectedIdentities, identities);
  console.log(`bench:run: as-of Review settlement family ${when}: ${identities.length} items ${difference ? `DIFFERENT (${difference})` : 'equal'}`);
  if (difference) throw new Error(`the as-of Review's settlement family ${when} differs from asOfReview.settlement: ${difference}`);
  settlementComparisons.push({ when, items: identities.length });
}

// ---- Card timings (D5R, T5R.13): disclosed, not gated ---------------------------------------------------------
// What "rendered" means for each timing. The condition is checked in the page on every DOM change, so the time is
// the first change after which it holds, read from the real clock (the same timeline as the pointer press).
type Rendered =
  | { readonly kind: 'cardLoaded' } // some card's content is shown and no card is still loading
  | { readonly kind: 'marksSaved'; readonly symbol: string } // the card's Save Marks counts no drafts: the same result cleared them
  | { readonly kind: 'actionSaved'; readonly tradeId: string }; // the Trade's card's Action form is gone and no card is loading (the result replaced it)

// Runs `press` (one click) and returns the milliseconds from its pointer press to the rendered result.
async function pressToRendered(page: Page, rendered: Rendered, press: () => Promise<void>): Promise<number> {
  const waiting = await page.evaluate((r: Rendered) => {
    const w = window as unknown as { __realPerf: Performance; __cardPress?: number; __cardDone?: number };
    w.__cardPress = undefined;
    w.__cardDone = undefined;
    const loading = () => [...document.querySelectorAll('[role="status"]')].some((e) => (e.textContent ?? '').startsWith('Loading the Trade'));
    const holds = (): boolean => {
      if (r.kind === 'cardLoaded') return document.querySelector('section[aria-label$=" review"]') !== null && !loading();
      // An Action save's card is the one list item of its Trade (an Underlying has several cards).
      if (r.kind === 'actionSaved') return document.querySelector(`li[data-trade-id="${r.tradeId}"] form[aria-label="Action"]`) === null && !loading();
      // The card's region is named for its Trade in full, so it is found by the underlying it starts with.
      const card = `section[aria-label^="${r.symbol} "][aria-label$=" review"]`;
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
// The card's region is named for its Trade in full ("ABBV (Long 120 shares @ $300.97) review", A150); it is found by its underlying.
const cardOf = (page: Page | Locator, symbol: string) => page.getByRole('region', { name: new RegExp(`^${symbol.replace(/\./g, '\\.')}(?: \\(.*\\))? review$`) }).first();

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
// A Trade's own card is found by its list item (`tradeId`); otherwise the first card of the Underlying.
async function reachCard(page: Page, symbol: string, tradeId?: string) {
  await timeOpenFirstCard(page);
  const scope = tradeId === undefined ? page : page.locator(`ol[aria-label="Positions"] > li[data-trade-id="${tradeId}"]`);
  const header = scope.getByRole('button', { name: new RegExp(`^Review ${symbol.replace(/\./g, '\\.')}(?:\\s|$)`) }).first();
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
  const card = cardOf(scope, symbol);
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

// The cards whose timed Action save was the first of their Action (not an edit).
const firstSaves = new Set<string>();
// A Hold Action save, from the press on Save in the card's Action form.
interface SaveCard {
  readonly symbol: string;
  readonly tradeId: string;
}
// How the report names a Trade's card: its Underlying and the start of its Trade id.
const labelOf = (c: SaveCard) => `${c.symbol} ${c.tradeId.slice(0, 8)}`;
async function timeSaveAction(page: Page, saveCard: SaveCard): Promise<number> {
  const card = await reachCard(page, saveCard.symbol, saveCard.tradeId);
  await showPanel(card, 'Action');
  // The dataset holds an Action for every Trade on the Review Date, so this save is an edit of it (its Change button).
  // A card whose Action is not saved yet (only the partial dataset has any, T6.25-P1) shows the form already, so this save is a first one.
  const change = card.getByRole('button', { name: 'Change' });
  if ((await change.count()) > 0) await change.click();
  else firstSaves.add(labelOf(saveCard));
  const form = card.getByRole('form', { name: 'Action' });
  await form.getByRole('radio', { name: 'Hold', exact: true }).check();
  await form.getByLabel(/^Why are you taking this action\?/).fill('bench edit');
  return pressToRendered(page, { kind: 'actionSaved', tradeId: saveCard.tradeId }, () => form.getByRole('button', { name: 'Save' }).click());
}

interface CardTimings {
  readonly openFirstCard: number[];
  readonly saveMarks: { symbol: string; ms: number }[];
  readonly saveAction: { symbol: string; ms: number }[];
  // Cards for the cold saves (D6), picked with the warm ones so that no card is saved twice.
  readonly coldCards: SaveCard[];
}
async function timeCards(page: Page): Promise<CardTimings> {
  const timings: CardTimings = { openFirstCard: [], saveMarks: [], saveAction: [], coldCards: [] };
  for (let run = 1; run <= OPEN_CARD_RUNS; run++) {
    timings.openFirstCard.push(await timeOpenFirstCard(page));
    console.log(`bench:run: open the first card ${run}/${OPEN_CARD_RUNS} ${timings.openFirstCard.at(-1)!.toFixed(1)} ms`);
  }
  for (const symbol of missing.slice(0, SAVE_RUNS)) {
    timings.saveMarks.push({ symbol, ms: await timeSaveMarks(page, symbol) });
    console.log(`bench:run: Save Marks ${symbol} ${timings.saveMarks.at(-1)!.ms.toFixed(1)} ms`);
  }
  // Cards (each opened by its Trade) whose Instrument is not Missing and whose Trade owes no reflection, in the Review's order.
  await timeOpenFirstCard(page);
  const reviewCards = await page.locator('ol[aria-label="Positions"] > li.review-card').evaluateAll((items) => items.map((li) => ({ tradeId: li.getAttribute('data-trade-id') ?? '', underlying: li.querySelector('.review-card-name')?.textContent.trim() ?? '' })));
  let picked: { tradeId: string; underlying: string }[];
  if (partial) {
    // The partial Review stopped part-way: only the first card of an Underlying whose Action is saved can be edited (its Change button),
    // as every card of a full dataset can. These come first. The Underlyings whose first card has no Action yet follow, to make up the
    // number of saves: those are first saves, disclosed as such. An Underlying that owes a reflection is left out.
    const actioned = new Set(dataset['actionedTradeIds'] as string[]);
    const owing = new Set(dataset['outstandingUnderlyings'] as string[]);
    const firstOf = new Map<string, string>();
    for (const card of reviewCards) if (!firstOf.has(card.underlying)) firstOf.set(card.underlying, card.tradeId);
    picked = [...firstOf]
      .sort(([, a], [, b]) => Number(actioned.has(b)) - Number(actioned.has(a)))
      .map(([underlying, tradeId]) => ({ tradeId, underlying }))
      .filter((c) => !missing.includes(c.underlying) && !owing.has(c.underlying))
      .slice(0, SAVE_RUNS + COLD_SAVE_RUNS);
  } else {
    // Every Underlying has a walked Trade that owes a reflection, so a card is chosen by its Trade, not by its Underlying.
    picked = walkedTradesOwingNothing(reviewCards, asOfReview?.walk ?? [], (dataset['outstandingDebts'] as { tradeId: string }[] | undefined) ?? [], missing, SAVE_RUNS + COLD_SAVE_RUNS);
  }
  const saveCards: SaveCard[] = picked.map((c) => ({ symbol: c.underlying, tradeId: c.tradeId }));
  if (partial) console.log(`bench:run: ${saveCards.length} Action cards found for ${SAVE_RUNS + COLD_SAVE_RUNS} saves`);
  timings.coldCards.push(...saveCards.slice(SAVE_RUNS));
  for (const saveCard of saveCards.slice(0, SAVE_RUNS)) {
    timings.saveAction.push({ symbol: labelOf(saveCard), ms: await timeSaveAction(page, saveCard) });
    console.log(`bench:run: Trade Action save ${labelOf(saveCard)} ${timings.saveAction.at(-1)!.ms.toFixed(1)} ms`);
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
const closedRenderMs: number[] = [];
const coldSaveAction: { symbol: string; ms: number }[] = [];
// Goes to the Trades page (the harness may be on the Review) and its Open list, so the next press on Closed renders its page afresh.
async function leaveClosed(page: Page) {
  await primaryLink(page, 'Trades').click();
  await page.getByRole('tab', { name: 'Open' }).click();
  await page.getByRole('table', { name: 'Open Trades' }).waitFor({ timeout: WAIT_MS });
}
try {
  // Warm-up (excluded): online, so the release's service worker installs and claims the page.
  const warmUp = await launch(false);
  engine = `Chromium ${warmUp.browser()?.version() ?? ''}`.trim();
  const page = await pageOf(warmUp);
  await page.goto(origin);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: WAIT_MS });
  await markTime(page, 'tj:interactive');
  before = await compareOpenList(page, 'before the runs');
  await deriveExpectedIdentities(page);
  await compareClosedPage(page, 'before the runs');
  await compareDueReflections(page, 'before the runs');
  await compareSettlement(page, 'before the runs');
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
  await compareClosedPage(warmPage, 'after the runs');
  await compareDueReflections(warmPage, 'after the runs');
  await compareSettlement(warmPage, 'after the runs');
  // Disclosed, not gated: the Closed tab's first page, from the press on the tab to the last row.
  for (let run = 1; run <= CLOSED_PAGE_RUNS; run++) {
    await leaveClosed(warmPage);
    closedRenderMs.push(await compareClosedPage(warmPage, `at render ${run}`));
  }
  // Last, because the saves change the profile's copy.
  cardTimings = await timeCards(warmPage);
  await context.close();
  // Cold Action saves: each on a fresh browser process, offline, on a card no warm save used.
  for (const saveCard of cardTimings.coldCards) {
    const coldContext = await launch(true);
    const savePage = await pageOf(coldContext);
    await savePage.goto(origin);
    await markTime(savePage, 'tj:interactive');
    coldSaveAction.push({ symbol: labelOf(saveCard), ms: await timeSaveAction(savePage, saveCard) });
    console.log(`bench:run: cold Trade Action save ${labelOf(saveCard)} ${coldSaveAction.at(-1)!.ms.toFixed(1)} ms`);
    await coldContext.close();
  }
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
const spread = (values: readonly number[]) => values.length === 0 ? '0 | none | none | none | none' : `${values.length} | ${ms(median(values))} ms | ${ms(p95(values))} ms | ${ms(Math.min(...values))} ms | ${ms(Math.max(...values))} ms`;
const openCard = cardTimings!.openFirstCard;
const markMs = cardTimings!.saveMarks.map((s) => s.ms);
const actionMs = cardTimings!.saveAction.map((s) => s.ms);

const coldActionMs = coldSaveAction.map((s) => s.ms);

// The partial dataset's counts beside plan section 1.4's (D6 column), and how its expectations were fixed.
function partialSection(): string {
  const c = dataset['counts'] as Record<string, number>;
  const n = (v: number) => v.toLocaleString('en-US');
  return `**PARTIAL DATASET (user decision of 2026-11-03).** Generation (generator 5) was stopped by SIGTERM at session ${n(c['sessions']!)} of 1,255 (${String(dataset['reviewDate'])}) because a Review save grows with the stored history. This run is on that snapshot (\`${String(dataset['snapshotDir'])}\`, untouched; the run uses a copy with the service worker and caches stripped, \`${String(dataset['runProfileDir'])}\`). The as-of instant is the last session's close plus 35 minutes, ${String(dataset['asOf'])}, derived from the stored Review Actions. The last session's Review is incomplete: ${(dataset['actionedTradeIds'] as string[]).length} of its ${(dataset['walkIdentities'] as string[]).length} walked Trades have their Action. The AC-PERF-001 D6 row is therefore partial, not covered, until a full rerun.

| Record kind | Plan section 1.4 at D6 | This partial dataset |
|---|---|---|
| Sessions | 1,255 | ${n(c['sessions']!)} |
| Trades | 25,000 | ${n(c['trades']!)} |
| Closed | 24,700 | ${n(c['closedTrades']!)} |
| Open | 200 | ${n(c['openTrades']!)} |
| Planned | 100 | ${n(c['plannedTrades']!)} |
| Position Changes | about 100,000 | ${n(c['positionChanges']!)} |
| Executions | about 200,000 | ${n(c['executions']!)} |
| Close Reasons | 24,700 | ${n(c['closeReasons']!)} |
| Position Change Reflection outcomes (entries + declines) | about 100,000 | ${n(c['positionChangeReflectionEntries']! + c['positionChangeReflectionDeclines']!)} |
| Close Review outcomes (entries + declines) | 24,700 | ${n(c['closeReviewEntries']! + c['closeReviewDeclines']!)} |
| Marks (revisions) | about 190,000 | ${n(c['marks']!)} |
| Daily Trade Review Actions | about 126,000 | ${n(c['actions']!)} |
| Debts (Outstanding) | not counted in section 1.4 | ${n(c['debts']!)} (${n(c['debtsOutstanding']!)}) |

How the expectations were fixed (the generator wrote none for this snapshot): the counts, the Open Trades' Underlyings, the Missing Instruments (${missing.length}: every Instrument has the as-of Mark, as the generator saves them all before its last session), the first Closed page, and the membership of the Review's walk (Trades open at the close) and owed group (Trades outside the walk with an Outstanding Debt) come from the stored records. The stored records do not fix the Open rows' figures, the walk's attention-ranked order or which reflections are due, so those come from the first render, which every later render must equal. The Action saves (${cardTimings!.saveAction.length} warm and ${coldSaveAction.length} cold) are edits of a saved Action, as in a full dataset, wherever the part-way Review had saved one; the rest are first saves of an Action: ${[...firstSaves].join(', ') || 'none'}. No Save Marks timing is possible, because no Instrument is missing its as-of Mark.

`;
}

const report = `# D7 benchmark run (AC-PERF-001)

Written by \`npm run bench:run\` (T2.21, extended by T4.31, T5.22, T5R.13, T6.25 and T7.29) on ${new Date().toISOString()}, at commit ${commit}${dirty ? ' plus uncommitted changes to src, tools, bench or package.json' : ''}.

## Result

| Measure | Runs | Nearest-rank p95 (29th of 30) | Budget | Result |
|---|---|---|---|---|
| Cold start to \`tj:interactive\` | ${cold.length} | ${ms(coldP95)} ms | ${COLD_BUDGET_MS.toLocaleString('en-US')} ms | ${coldPass ? 'pass' : 'FAIL'} |
| Warm Planned-to-Open switch to \`tj:open-list-ready\` | ${warm.length} | ${ms(warmP95)} ms | ${WARM_BUDGET_MS.toLocaleString('en-US')} ms | ${warmPass ? 'pass' : 'FAIL'} |

${partial ? partialSection() : ''}Open list compared with ${partial ? 'its first render (the baseline, which was checked against the stored Open Trades\' Underlyings)' : '`bench/expected-open-rows.json`'}: before the runs ${before} rows equal, after the runs ${after} rows equal, and each of the ${RUNS} cold starts rendered the same ${openRowCount()} rows (figures included). The ${missing.length} Missing Instruments on the as-of date (${missing.join(', ')}) have rows in that list, each showing \`Mark missing\` in P&L (and no other row does).

## As-of Review's due reflections (T5.22)

The harness opens the Review from the primary navigation and reads its blockers: each "Reflection due for X" or "N reflections due for X" is a reflection due at the as-of Review (X names the Trade in full; the harness compares its underlying symbol) (Review Date ${String(dataset['reviewDate'])}). ${partial ? 'In the partial dataset the stored data does not say which reflections are due (the rule is one session of grace), so the first render sets the expected values after checking that every Trade it names holds an Outstanding Debt in the stored data; every later render must equal it.' : `The expected values are \`asOfDueReflections\` and the Trades of \`outstandingDebts\` in \`bench/dataset.json\` (the Outstanding Debts are from ${((dataset['outstandingDebts'] as { momentDate: string }[] | undefined) ?? []).map((d) => d.momentDate).join(' and ')}, both due at the as-of Review, decision 58).`} A difference fails the run.

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

- **Against D5 and D5R2:** D5 measured the cold start at ${D5_COLD_P95_MS} ms and the warm switch at ${D5_WARM_P95_MS} ms (p95), D5R2 ${D5R2_COLD_P95_MS} ms and ${D5R2_WARM_P95_MS} ms on the same generator-3 dataset; this run's are ${ms(coldP95)} ms and ${ms(warmP95)} ms. D5 timed the press on Review to the Review's status at ${D5_REVIEW_OPEN_MS.before} ms before its runs and ${D5_REVIEW_OPEN_MS.after} ms after (single measurements); opening the first card here, which adds the first Trade's \`getTrade\`, takes a median of ${ms(median(openCard))} ms.
- **Tech debt item 3** (the Review's open cost grows with history) is measured here, not fixed: D5R takes the save path off it (P38) but not the first \`open\` of each Review, and the open-the-first-card timing is its baseline.
- **The saves** are timed on cards of the cached profile's copy: ${cardTimings!.saveMarks.map((s) => `Save Marks on ${s.symbol}`).join(', ')}; and a Hold Action on ${cardTimings!.saveAction.map((s) => s.symbol).join(', ')}. A Marks save fills the Instrument's Missing Review-date Mark with 51.00. ${partial ? `The partial dataset's last Review is incomplete, so an Action save is an edit of the saved Action (Change, Hold, an Intent of "bench edit", Save) except on ${[...firstSaves].join(', ') || 'none'}, where the Action was not saved yet and the save is the first one (Hold, an Intent of "bench edit", Save). Each is` : 'The dataset holds an Action for every Trade on the Review Date, so each Action save is an edit of the saved Action (Change, Hold, an Intent of "bench edit", Save): each is'} a \`SaveTradeAction\` with the entry's expected revision, with the same post-save rebuild as a first save. The Review is opened afresh before each, which is not timed.
- **Raw timings (ms, in run order):** open the first card ${openCard.map(ms).join(', ')}; Save Marks ${markMs.map(ms).join(', ')}; Trade Action save ${actionMs.map(ms).join(', ')}.
- **Method:** a MutationObserver in the page reads the real clock on the first DOM change after which the result holds (the card's content shown with no card still loading; the card's Save Marks counting no drafts; the card's Action form gone with no card still loading), and a capture-phase pointer press records the start on the same clock.

## Closed page, Review walk and owed group (T6.25)

- **Closed page.** The generator records no Closed page, so the expected first page is derived from the stored data: the first ${CLOSED_PAGE_SIZE} Closed Trades of the profile's \`byLifecycleTerminal\` index (terminal time descending), read raw in the page before any timed run. Each rendered row (its Trade from the link, Underlying and Close date in ${BENCH_TIME_ZONE}) must equal the stored Trade's, in order, before the runs (${expectedClosedIdentities.length} rows equal) and after them (${expectedClosedIdentities.length} rows equal), and at each of the ${closedRenderMs.length} renders below. Realized figures, Disposition and Close Reason are not compared (the stored Trade does not hold them).
- **Review walk and owed group.** The as-of Review's cards must equal ${partial ? 'the stored data\'s members (the walk is the Trades open at the close, the owed group the Trades outside it with an Outstanding Debt, each by Trade and Underlying), and the order of the first render in every later render' : '`asOfReview` in `bench/dataset.json`, in order'}, each by its Trade (\`data-trade-id\`) and Underlying${partial ? '' : ' (the walked Trades\' Underlyings are read from the stored Trades, the owed group\'s are the dataset\'s)'}:${reviewCardComparisons.map((c) => `${c.when} ${c.walk} walked and ${c.owed} owed cards equal`).join('; ')}. The owed group's Debt identities are not rendered, so they are not compared here; the Trades and their order are.

- **Settlement family (T7.29).** The as-of Review's "Settlement Due for ..." blockers must equal \`asOfReview.settlement\` in \`bench/dataset.json\`, in the Review's order, each by its Trade (from the blocker's link), contract, open quantity (read from the Settlement panel the link opens) and expiration date: ${settlementComparisons.map((c) => `${c.when} ${c.items} items equal`).join('; ') || 'not compared (the dataset records no settlement family)'}. The Open list's rows, option figures and dated lines included, are the \`bench/expected-open-rows.json\` comparison in the first section; the profile holds ${String((dataset['counts'] as Record<string, number>)['optionTrades'] ?? 0)} option Trades of ${String((dataset['counts'] as Record<string, number>)['trades'])} and ${String((dataset['counts'] as Record<string, number>)['openOptionTrades'] ?? 0)} Open ones.

| Measure (disclosed, not gated) | Runs | Median | Nearest-rank p95 | Min | Max |
|---|---|---|---|---|---|
| Closed tab to its first page (${expectedClosedIdentities.length} rows; press on Trades, then Closed, to the last row rendered) | ${spread(closedRenderMs)} |

## Daily Trade Review Action save (requested measurement, disclosed, not gated; not in the plan's T6.25 row)

A single Action save on a card of the as-of Review (Change, Hold, an Intent, Save: a \`SaveTradeAction\` with the entry's expected revision, so the Review's post-save rebuild is included), from the press on Save to the form replaced by the result. Generator 5's Review save grew by about 1 ms per session in Chromium; this shows its cost at the mature profile. **Warm** is the five saves of the card timings above, in one long-lived page. **Cold** is one save on each of ${COLD_SAVE_RUNS} fresh browser processes (offline, from the service worker), on a card no warm save used, the Review opened afresh first (not timed). These figures are not gated; only the two p95 above are.

| Save | Runs | Median | Nearest-rank p95 | Min | Max |
|---|---|---|---|---|---|
| Warm | ${spread(actionMs)} |
| Cold | ${spread(coldActionMs)} |

Raw (ms): warm ${actionMs.map(ms).join(', ')}; cold ${coldSaveAction.map((s) => `${s.symbol} ${ms(s.ms)}`).join(', ')}; closed page renders ${closedRenderMs.map(ms).join(', ')}.

## Method

- Playwright's clock also swaps \`window.performance\` for a fake that records no marks, so the harness keeps the real object before the pin and points the fake's \`mark\` at it; \`performance.now\` and timers are the real ones.
- \`Date\` is pinned to the dataset's as-of instant (${asOf.toISOString()}, A52) with Playwright \`context.clock.setFixedTime\`, and native \`Temporal.Now.instant\` (the application's clock) is pointed at it (T4.31-B1); every comparison first checks both read the as-of instant and that exactly the Missing Instruments' rows show \`Mark missing\`. Timers and \`performance.now\` are real, and the build is production.
- A copy of the ${partial ? `partial dataset's run profile (\`${String(dataset['runProfileDir'])}\`, a copy of the snapshot with the service worker and caches stripped; generator` : 'cached profile (`.cache/bench/profile`, generator'} ${String(dataset['generatorVersion'])}, schema ${String(dataset['schemaVersion'])}) per run of the harness; the cached profile itself is never opened.
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
