import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import { chromium, expect, test, type Page } from '@playwright/test';

// T6.25-B2 (decision 74). Chromium's IndexedDB keeps a record's old index entry when its index key moves, and drops it only
// when a read-write cursor visits it. The Review's Open-range read walks every such stale entry, so a Trade write that moves
// `activityDesc` or the lifecycle must vacate the old keys. This drives the production Persistence and Trade Record write path
// on Chromium (the Plan, two entries, an exit per Trade), then times the Open-range read of `trades.byLifecycleActivity`
// against a fresh database holding the same documents.

const ORIGIN = 'http://localhost:5175';
const TRADES = 3000;
const FACTOR = 3;

test('should keep the Open-range index read within a small factor of a fresh database after Trades churn through Plan, entries and exit', async () => {
  test.setTimeout(120_000);
  // A persistent profile gives the on-disk LevelDB backend the application runs on; the default in-memory context does not.
  const profile = await mkdtemp(path.join(os.tmpdir(), 'tj-stale-index-'));
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
      lib: { entry: 'e2e/d6/stale-index-entry.ts', formats: ['iife'], name: 'staleIndexEntry', fileName: 'entry' },
    },
  });
  const bundle = (Array.isArray(output) ? output[0]! : output) as { output: { type: string; code?: string }[] };
  const code = bundle.output.find((chunk) => chunk.type === 'chunk')!.code!;

  await page.route(`${ORIGIN}/**`, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>stale index</title>' }));
  await page.goto(ORIGIN);
  await page.addScriptTag({ content: code });
  const result = await page.evaluate((count) => (window as unknown as { runChurn: (n: number) => Promise<{ documents: number; openRows: number; churnedMs: number; freshMs: number }> }).runChurn(count), TRADES);

  console.log(`stale-index: ${JSON.stringify(result)}`);
  expect(result.documents).toBe(TRADES);
  expect(result.openRows).toBe(100);
  // A floor on the fresh read keeps a sub-millisecond baseline from turning timer noise into a failure.
  expect(result.churnedMs).toBeLessThanOrEqual(FACTOR * Math.max(result.freshMs, 1));
}
