import { test, expect } from './fixtures';
test('D1-T09 withholds Writable until a complete verified release controls the page', async ({ page }) => {
  await page.goto('/');
  console.log('native host evidence', await page.evaluate(async () => ({ secure: isSecureContext, storage: await navigator.storage.estimate(), controller: navigator.serviceWorker.controller?.scriptURL, caches: await caches.keys() })));
  await expect(page.getByLabel('Workspace time zone')).toBeVisible();
  expect(await page.evaluate(() => isSecureContext)).toBe(true);
  const manifest = await page.request.get('/manifest.webmanifest');
  const identity = await manifest.json() as { display: string; icons: { src: string; sizes: string; type: string }[] };
  expect(identity.display).toBe('standalone');
  expect(identity.icons).toEqual(expect.arrayContaining([{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }]));
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toContain('/sw.js');
});
