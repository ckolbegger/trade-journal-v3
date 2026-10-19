import { assetDigest, type OfflineReleaseInventory } from '../../src/delivery/inventory.ts';
import { BASE_URL, expect, onboardedPage, test } from './support.ts';

test.describe('B1.1 identity and Writable tab', () => {
  for (const userAgent of [undefined, 'UnknownBrowser/0.1 (unrecognized)']) {
    test(`should serve a complete manifest and digest-valid inventory and reach Writable with all four checks passing${userAgent ? ' under an unknown user agent' : ''}`, async ({
      server,
      profile,
    }) => {
      void server;
      const context = await profile.launch({ userAgent });
      const page = await onboardedPage(context);

      const manifest = (await (await page.request.get(`${BASE_URL}/manifest.webmanifest`)).json()) as Record<string, unknown> & {
        icons: { sizes: string }[];
      };
      for (const field of ['id', 'name', 'short_name', 'start_url', 'scope']) expect(manifest[field], field).toBeTruthy();
      expect(manifest['display']).toBe('browser');
      expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));

      const inventory = (await (await page.request.get(`${BASE_URL}/inventory.json`)).json()) as OfflineReleaseInventory;
      for (const asset of inventory.assets) {
        const bytes = new Uint8Array(await (await page.request.get(`${BASE_URL}${asset.path}`)).body());
        expect(await assetDigest(bytes, inventory.releaseId), asset.path).toBe(asset.digest);
      }

      await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'About' }).click();
      await expect(page.locator('.identity')).toHaveText(inventory.releaseId);
      for (const check of ['Test save and read-back', 'Storage space', 'Offline component in control', 'Offline copy complete']) {
        await expect(page.getByRole('listitem').filter({ hasText: `${check}: passed` })).toBeVisible();
      }
      await expect(page.getByRole('heading', { name: /Read only/ })).toHaveCount(0);
      await context.close();
    });
  }
});
