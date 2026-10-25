import { writeFile } from 'node:fs/promises';
import { platform, release, cpus, totalmem } from 'node:os';
import { test, expect } from '../browser/fixtures';
import { onboard } from '../browser/helpers';
declare global { interface Window { d1Queries: Record<string, { calls: number; rows: number }> } }
// This injected actor calls production commands with actual BrowserHost, IndexedDB and caches.
// It adds no installed UI route or application mock. Values/clock are deterministic; opaque IDs are host generated.
test('D1-I05 command-created 25000 Planned Trades, 50 cold and 50 warm offline trials', async ({ page, context, playwright, browserName, profilePath, baseURL }) => {
  test.setTimeout(1_800_000);
  await onboard(page);
  await page.addScriptTag({ path: '.cache/browser-generator/generator.js' });
  page.on('console', message => { if (message.text().startsWith('D1 command-created')) console.log(message.text()); });
  const dataset = await page.evaluate(() => window.d1Evidence.generate(25000));
  console.log('D1 dataset complete', dataset);
  const before = await page.evaluate(() => window.d1Evidence.inspect());
  expect(before.count).toBe(25000);
  expect(dataset.counts).toEqual({ plans: 25000, entries: 25000, lifecycle: 25000, versions: 50007 });
  await page.evaluate(() => window.d1Evidence.discardPrivateReceipts());
  expect(await page.evaluate(() => window.d1Evidence.inspect())).toEqual(before);
  const afterPrivateDiscard = await page.evaluate(() => window.d1Evidence.measure());
  expect(afterPrivateDiscard).toMatchObject({ status: 'Writable', storageMeasurement: { activeSerializedBytes: 0, method: 'UnmeasuredConservative' } });
  // Lists use authoritative membership and bounded source batches. The only
  // private projection is the size receipt; deletion preserves domain results.
  const browserVersion = context.browser()?.version();
  await context.close();
  const cold: number[] = []; const warm: number[] = [];
  const queries: { cold: Window['d1Queries']; warm: Window['d1Queries'] }[] = [];
  for (let i = 0; i < 50; i++) {
    const browser = await playwright[browserName].launchPersistentContext(profilePath, { headless: true, baseURL, offline: true, viewport: { width: 1440, height: 900 } });
    try {
      const trial = await browser.newPage();
      await trial.addInitScript(() => {
        window.d1Queries = {};
        for (const method of ['openCursor', 'getAll', 'count']) {
          const original = Reflect.get(IDBIndex.prototype, method) as (...args: unknown[]) => IDBRequest;
          Reflect.set(IDBIndex.prototype, method, function (this: IDBIndex, ...args: unknown[]) {
            const record = window.d1Queries[`${this.name}.${method}`] ??= { calls: 0, rows: 0 };
            record.calls++;
            const request = original.apply(this, args);
            request.addEventListener('success', () => { const value = request.result as unknown; record.rows += Array.isArray(value) ? value.length : value instanceof IDBCursor ? 1 : 0; });
            return request;
          });
        }
      });
      const started = performance.now();
      await trial.goto('/');
      await expect(trial.locator('ul li button')).toHaveCount(50);
      cold.push(performance.now() - started);
      const coldQueries = await trial.evaluate(() => { const observed = window.d1Queries; window.d1Queries = {}; return observed; });
      const warmStarted = performance.now();
      await trial.getByRole('button', { name: 'Trades', exact: true }).click();
      await expect(trial.locator('ul li button')).toHaveCount(50);
      warm.push(performance.now() - warmStarted);
      const warmQueries = await trial.evaluate(() => window.d1Queries);
      queries.push({ cold: coldQueries, warm: warmQueries });
      expect(Object.values(warmQueries).reduce((sum, query) => sum + query.calls, 0)).toBeGreaterThan(0);
      expect(Object.values(coldQueries).reduce((sum, query) => sum + query.rows, 0)).toBeLessThanOrEqual(100);
      if (i === 49) { await trial.addScriptTag({ path: '.cache/browser-generator/generator.js' }); expect(await trial.evaluate(() => window.d1Evidence.inspect())).toEqual(before); }
    } finally { await browser.close(); }
    console.log(`D1 benchmark trial ${i + 1}: cold ${cold.at(-1)} ms; warm ${warm.at(-1)} ms`);
  }
  const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1] ?? Infinity;
  const evidence = { dataset, before, afterPrivateDiscard, queries, browserName, browserVersion, environment: { platform: platform(), osRelease: release(), cpu: cpus()[0]?.model, memoryBytes: totalmem(), node: process.version }, source: '25,000 confirmPlan commands, native browser store; no executions or market observations', futureCapacityReserves: 'D1 plan budgets only; not fabricated domain records', cold, warm, percentile: 'nearest rank ceil(0.95*n)', coldP95: p95(cold), warmP95: p95(warm) };
  await writeFile(`implementation/evidence/bug-001/cumulative/${process.env.BUG001_EVIDENCE_RUN ?? 'manual'}/d02/d01-cumulative-benchmark.json`, JSON.stringify(evidence, null, 2));
  expect(p95(cold)).toBeLessThanOrEqual(2500);
  expect(p95(warm)).toBeLessThanOrEqual(1500);
});
