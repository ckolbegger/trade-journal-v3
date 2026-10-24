import { test, expect } from './fixtures';
import { onboard, confirmPlan } from './helpers';
test('D1-T03 native resource receipt accounts for stored bytes and complete cache growth', async ({ page }) => {
  await onboard(page); await confirmPlan(page);
  await page.addScriptTag({ path: '.cache/browser-generator/generator.js' });
  const result = await page.evaluate(() => window.d1Evidence.measure());
  expect(result).toMatchObject({ status: 'Writable', capacityEvidence: { method: 'SerializedActiveLowerBound' } });
  const evidence = Reflect.get(result, 'capacityEvidence') as { M: number; L: number; C: number; Q: number; H: number; quota: number; usage: number } | undefined;
  if (!evidence) throw new Error('Native capacity evidence required');
  const { M, L, C, Q, H, quota, usage } = evidence;
  expect(M).toBe(553648128); expect(L).toBeGreaterThan(1000); expect(C).toBeGreaterThan(500000);
  expect(Q).toBe(quota - usage);
  expect(H).toBe((Math.max(0, M - L) + C) * 1.25);
  expect(Q).toBeGreaterThanOrEqual(H);
  const before = await page.evaluate(() => window.d1Evidence.inspect());
  await page.evaluate(() => window.d1Evidence.discardPrivateReceipts());
  expect(await page.evaluate(() => window.d1Evidence.inspect())).toEqual(before);
  console.log('Native resource receipt', evidence);
});
