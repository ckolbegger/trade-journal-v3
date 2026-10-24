import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir, platform, release, cpus, totalmem } from 'node:os';
import { join } from 'node:path';
import { test, expect } from '../browser/fixtures';
import { onboard, confirmPlan } from '../browser/helpers';
const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1] ?? Infinity;
test('D2-T07 25000 historical command-created Plans, native staged migration, 200 Open Trades and 50+50 offline trials', async ({ page, context, playwright, profilePath, baseURL }) => {
  test.setTimeout(1800000);
  const targetRelease = (JSON.parse(await readFile('dist/offline-inventory.json', 'utf8')) as { releaseId: string }).releaseId;
  const backup = await mkdtemp(join(tmpdir(), 'd02-scale-dist-')); await cp('dist', backup, { recursive: true });
  const heap: unknown[] = []; let sample: ReturnType<typeof setInterval> | undefined;
  let source: { digest: string; count: number; membership: number; serializedBytes: number; root: unknown } | undefined;
  try {
    await rm('dist', { recursive: true, force: true }); await cp('.cache/d1-release', 'dist', { recursive: true });
    await onboard(page); await confirmPlan(page);
    await page.addScriptTag({ path: '.cache/browser-generator/generator.js' });
    expect(await page.evaluate(() => window.d2Evidence.releaseId)).toBe(targetRelease);
    await page.addScriptTag({ path: '.cache/d1-release-source/.cache/browser-generator/generator.js' });
    page.on('console', message => { if (message.text().startsWith('D1 command-created')) console.log(message.text()); });
    const d1 = await page.evaluate(() => window.d1Evidence.generate(24999)); expect(d1.counts.plans).toBe(25000);
    await page.addScriptTag({ path: '.cache/browser-generator/generator.js' });
    source = await page.evaluate(async () => {
      const raw = await window.d2Evidence.oldD1Digest();
      const rows = (raw.rows as { id: string; kind: string; tradeId: string; economicTime: string; saveTime: string; sequence: number; commitOrdinal: number; value: unknown }[]).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : a.kind.localeCompare(b.kind)).map(({ id, kind, tradeId, economicTime, saveTime, sequence, commitOrdinal, value }) => ({ id, kind, tradeId, economicTime, saveTime, sequence, commitOrdinal, value }));
      const membership = (raw.membership as { tradeId: string; lifecycle: string; accountId: string; symbol: string; economicTime: string; economicOrder: string; sequence: number; revision: string }[]).sort((a, b) => a.tradeId < b.tradeId ? -1 : a.tradeId > b.tradeId ? 1 : 0).map(({ tradeId, lifecycle, accountId, symbol, economicTime, economicOrder, sequence, revision }) => ({ tradeId, lifecycle, accountId, symbol, economicTime, economicOrder, sequence, revision }));
      const bytes = new TextEncoder().encode(JSON.stringify({ rows, membership })); const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
      return { digest, count: rows.length, membership: membership.length, serializedBytes: bytes.length, root: raw.root };
    });
    expect(source.count).toBe(50005); expect(source.membership).toBe(25000);
    const cdp = await context.newCDPSession(page); await cdp.send('HeapProfiler.collectGarbage');
    sample = setInterval(() => { void cdp.send('Runtime.getHeapUsage').then((value: unknown) => heap.push({ at: Date.now(), value })).catch(() => {}); }, 100);
    await rm('dist', { recursive: true, force: true }); await cp(backup, 'dist', { recursive: true });
    await page.getByRole('button', { name: 'Check for application updates' }).click(); await expect(page.getByRole('button', { name: 'Reload to update' })).toBeVisible({ timeout: 20000 });
    const migrationStarted = performance.now();
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Reload to update' }).click()]);
    await expect(page.locator('ul li button')).toHaveCount(50, { timeout: 180000 });
    const migrationElapsedMs = performance.now() - migrationStarted;
    clearInterval(sample); sample = undefined;
    await page.addScriptTag({ path: '.cache/browser-generator/generator.js' });
    const migrated = await page.evaluate(() => window.d2Evidence.d1Digest()); expect(migrated.digest).toBe(source.digest); expect(migrated.root.schema).toBe(2);
    await writeFile('implementation/evidence/d02/d02-migration-scale.json', JSON.stringify({ source, migrated, d1, migrationElapsedMs, heap }, null, 2));
    await context.close();
    const phases: Record<string, unknown> = {};
    for (const phase of ['Planned', 'Open'] as const) {
      if (phase === 'Open') {
        const population = await playwright.chromium.launchPersistentContext(profilePath, { headless: true, baseURL });
        try { const actor = await population.newPage(); await actor.goto('/'); await expect(actor.locator('ul li button')).toHaveCount(50); await actor.addScriptTag({ path: '.cache/browser-generator/generator.js' }); const opened = await actor.evaluate(() => window.d2Evidence.openDataset(200)); expect(opened.counts.Execution).toBe(400); expect(opened.counts.PositionChange).toBe(200); const before = await actor.evaluate(() => window.d2Evidence.inspectOpen()); expect(before.items).toHaveLength(200); expect(before.debt).toHaveLength(33); await actor.evaluate(() => window.d1Evidence.discardPrivateReceipts()); expect(await actor.evaluate(() => window.d2Evidence.inspectOpen())).toEqual(before); await writeFile('implementation/evidence/d02/d02-scale-population.json', JSON.stringify({ opened, before }, null, 2)); } finally { await population.close(); }
      }
      const cold: number[] = []; const warm: number[] = []; const storage: unknown[] = [];
      for (let trial = 0; trial < 50; trial++) {
        const browser = await playwright.chromium.launchPersistentContext(profilePath, { headless: true, baseURL, offline: true, viewport: { width: 1440, height: 900 } });
        try {
          const tab = await browser.newPage(); const start = performance.now(); await tab.goto('/'); await expect(tab.locator('ul li button')).toHaveCount(50); cold.push(performance.now() - start);
          if (phase === 'Open') await tab.addScriptTag({ path: '.cache/browser-generator/generator.js' });
          const warmStart = performance.now(); await tab.getByRole('button', { name: phase === 'Open' ? 'Open' : 'Trades', exact: true }).click(); await expect(tab.locator('ul li button')).toHaveCount(50);
          if (phase === 'Open') expect((await tab.evaluate(() => window.d2Evidence.inspectOpen())).items).toHaveLength(200);
          warm.push(performance.now() - warmStart);
          if (trial === 0 || trial === 49) storage.push(await tab.evaluate(() => navigator.storage.estimate()));
        } finally { await browser.close(); }
        console.log(`D2 ${phase} trial ${trial + 1}: cold ${cold.at(-1)} ms warm ${warm.at(-1)} ms`);
      }
      phases[phase] = { cold, warm, storage, coldP95: p95(cold), warmP95: p95(warm) };
      await writeFile(`implementation/evidence/d02/d02-${phase.toLowerCase()}-scale-trials.json`, JSON.stringify(phases[phase], null, 2));
      expect(p95(cold)).toBeLessThanOrEqual(2500); expect(p95(warm)).toBeLessThanOrEqual(1500);
    }
    await writeFile('implementation/evidence/d02/d02-benchmark.json', JSON.stringify({ source, migrated, d1, migrationElapsedMs, heap, phases, profilePath, environment: { platform: platform(), os: release(), cpu: cpus()[0]?.model, memory: totalmem(), node: process.version }, provenance: 'Historical D1 commands under original release; normal verified D2 update; native generation migration; current D2 opening commands; stopped isolated Chromium and offline launches; nearest-rank percentiles. Open warm includes UI first page plus exhaustive 200-Trade public read.' }, null, 2));
  } finally { if (sample) clearInterval(sample); await rm('dist', { recursive: true, force: true }); await cp(backup, 'dist', { recursive: true }); }
});
