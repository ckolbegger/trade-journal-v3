// npm run bench:expected: re-renders bench/expected-open-rows.json's headers and rows from the cached
// profile with the app pinned to the dataset's as-of instant (T4.31-B1). The profile and the facade
// items are not touched. Serves the production build (dist/, run `npm run build` first).
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type BrowserContext, chromium } from '@playwright/test';
import { assertMissingRendered, assertPinned, pinAsOf } from './bench/pin.ts';
import { BENCH_DATASET_FILE, BENCH_EXPECTED_ROWS_FILE, BENCH_PORT, BENCH_PROFILE_DIR, type ExpectedOpenRows } from './bench/profile.ts';
import { startReleaseServer } from './release-server.ts';

const expected = JSON.parse(await readFile(BENCH_EXPECTED_ROWS_FILE, 'utf8')) as ExpectedOpenRows;
const dataset = JSON.parse(await readFile(BENCH_DATASET_FILE, 'utf8')) as { asOf: string; missingInstruments: string[] };
const asOf = new Date(dataset.asOf);
const workDir = await mkdtemp(path.join(os.tmpdir(), 'tj-bench-expected-'));
const profile = path.join(workDir, 'profile');
await cp(BENCH_PROFILE_DIR, profile, { recursive: true });
const server = await startReleaseServer({ root: process.cwd(), release: 'dist', port: BENCH_PORT });
let context: BrowserContext | undefined;
try {
  context = await chromium.launchPersistentContext(profile, { headless: true });
  await pinAsOf(context, asOf);
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(server.url);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 60_000 });
  const table = page.getByRole('table', { name: 'Open Trades' });
  await table.locator('tbody tr').nth(expected.rows.length - 1).waitFor({ timeout: 60_000 });
  await assertPinned(page, asOf);
  const rendered = await table.evaluate((t: HTMLTableElement) => ({
    headers: [...t.tHead!.rows[0]!.cells].map((c) => c.textContent.trim()),
    rows: [...t.tBodies[0]!.rows].map((r) => [...r.cells].map((c) => c.textContent.trim())),
  }));
  assertMissingRendered(rendered.rows, dataset.missingInstruments);
  await context.close();
  const rows: ExpectedOpenRows = { ...expected, ...rendered };
  await writeFile(BENCH_EXPECTED_ROWS_FILE, `${JSON.stringify(rows, (_, v: unknown) => (typeof v === 'bigint' ? v.toString() : v), 2)}\n`);
  console.log(`bench:expected OK: ${rendered.rows.length} rows rendered at ${asOf.toISOString()}`);
} finally {
  // Closing an already closed context is a no-op; a failed wait or guard must not leave Chromium on a removed profile.
  await context?.close();
  await server.close();
  await rm(workDir, { recursive: true, force: true });
}
