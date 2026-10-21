import { test } from '@playwright/test';
test('diagnose native command growth without replacing application results', async ({ playwright, baseURL }) => {
  const profile = process.env.D1_PROBE_PROFILE;
  if (!profile) { test.skip(true, 'Optional diagnostic requires an explicit preserved native profile'); return; }
  const context = await playwright.webkit.launchPersistentContext(profile, { headless: true, baseURL });
  try {
    const page = await context.newPage(); await page.goto('/');
    await page.getByRole('button', { name: 'Check for application updates' }).click();
    if (await page.getByRole('button', { name: 'Reload to update' }).isVisible()) {
      await page.getByRole('button', { name: 'Reload to update' }).click();
      await page.getByRole('heading', { name: 'Trades', exact: true }).waitFor();
    }
    await page.addScriptTag({ path: '.cache/browser-generator/generator.js' });
    const result = await page.evaluate(async () => {
      const observed: Record<string, { calls: number; ms: number; events: number }> = {};
      function observe(prototype: object, key: string, label: string) {
        const original = Reflect.get(prototype, key) as (...args: unknown[]) => unknown;
        Reflect.set(prototype, key, function (this: unknown, ...args: unknown[]) {
          const start = performance.now(); const result = original.apply(this, args);
          const record = observed[label] ??= { calls: 0, ms: 0, events: 0 }; record.calls++;
          if (result instanceof IDBRequest) result.addEventListener('success', () => { record.ms += performance.now() - start; record.events++; });
          else if (result instanceof Promise) void result.then(() => { record.ms += performance.now() - start; record.events++; });
          return result;
        });
      }
      for (const key of ['openCursor', 'getAll', 'get', 'count']) observe(IDBIndex.prototype, key, `index.${key}`);
      for (const key of ['get', 'put', 'add']) observe(IDBObjectStore.prototype, key, `store.${key}`);
      observe(StorageManager.prototype, 'estimate', 'estimate');
      const dataset = await window.d1Evidence.generate(10);
      return { dataset, observed };
    });
    console.log(JSON.stringify(result, null, 2));
  } finally { await context.close(); }
});
