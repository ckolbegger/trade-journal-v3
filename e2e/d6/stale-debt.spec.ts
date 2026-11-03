import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import { chromium, expect, test, type Page } from '@playwright/test';

// T6.25-B3 (decision 75). Resolving a Debt drops its sparse `outstandingDue` field, and Chromium's IndexedDB keeps the old
// `journalDebts.byOutstandingDue` entry until a read-write cursor visits it. This drives the production Persistence and
// Journal write path on Chromium (deferring Debts, then declining all but 100), then times the Outstanding read against a
// fresh database holding the same documents.

const ORIGIN = 'http://localhost:5175';
const DEBTS = 3000;
const FACTOR = 3;

test('should keep the Outstanding Debt index read within a small factor of a fresh database after Debts are created and resolved', async () => {
  test.setTimeout(120_000);
  // A persistent profile gives the on-disk LevelDB backend the application runs on; the default in-memory context does not.
  const profile = await mkdtemp(path.join(os.tmpdir(), 'tj-stale-debt-'));
  const context = await chromium.launchPersistentContext(profile, { headless: true });
  try {
    await churn(context.pages()[0] ?? (await context.newPage()));
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

async function churn(page: Page) {
  const output = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: { entry: 'e2e/d6/stale-debt-entry.ts', formats: ['iife'], name: 'staleDebtEntry', fileName: 'entry' },
    },
  });
  const bundle = (Array.isArray(output) ? output[0]! : output) as { output: { type: string; code?: string }[] };
  const code = bundle.output.find((chunk) => chunk.type === 'chunk')!.code!;

  await page.route(`${ORIGIN}/**`, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>stale debt</title>' }));
  await page.goto(ORIGIN);
  await page.addScriptTag({ content: code });
  const result = await page.evaluate((count) => (window as unknown as { runDebtChurn: (n: number) => Promise<{ documents: number; openRows: number; churnedMs: number; freshMs: number }> }).runDebtChurn(count), DEBTS);

  console.log(`stale-debt: ${JSON.stringify(result)}`);
  expect(result.documents).toBe(DEBTS);
  expect(result.openRows).toBe(100);
  // A floor on the fresh read keeps a sub-millisecond baseline from turning timer noise into a failure.
  expect(result.churnedMs).toBeLessThanOrEqual(FACTOR * Math.max(result.freshMs, 1));
}
