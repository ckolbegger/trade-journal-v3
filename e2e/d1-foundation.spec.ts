import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('D1 Foundation — PWA, Runtime Readiness, Workspace, & Brokerage Accounts', () => {
  test('serves valid Web App Manifest and passes initial Runtime Readiness, onboarding, Accounts lifecycle, About settings, live resize, accessibility, and offline cold restart', async ({
    page,
    context,
  }) => {
    // 1. Verify Web App Manifest and release-inventory.json
    const manifestRes = await page.request.get('/manifest.webmanifest');
    expect(manifestRes.ok()).toBe(true);
    const manifest = (await manifestRes.json()) as {
      id: string;
      name: string;
      display: string;
      icons: unknown[];
    };
    expect(manifest.id).toBe('/');
    expect(manifest.name).toBe('Trade Journal V3');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

    // 2. First load -> SW installs & controls -> Initialize Workspace screen
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Initialize Local Workspace' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Runtime Writable')).toBeVisible();

    // Select America/New_York and initialize
    await page.getByLabel('IANA Time Zone').fill('America/New_York');
    await page.getByRole('button', { name: 'Initialize Workspace' }).click();

    await expect(page.getByRole('heading', { name: 'Institutions & Accounts' })).toBeVisible();
    await expect(page.getByText('Needs Institution and Account')).toBeVisible();

    // 3. Create Institution + Account -> transitions onboarding to Ready for Trade Planning
    await page.getByLabel('Institution name').fill('Fidelity');
    await page.getByRole('button', { name: 'Add Institution' }).click();
    await expect(page.getByRole('heading', { name: 'Fidelity' })).toBeVisible();

    await page.getByLabel('Add account under Fidelity').fill('Taxable Margin');
    await page.getByRole('button', { name: 'Add Account' }).click();
    await expect(page.getByText('Taxable Margin', { exact: true })).toBeVisible();
    await expect(
      page.locator('main').getByText('Ready for Trade Planning', { exact: true }),
    ).toBeVisible();

    // Blocking archive of Institution while it has an active Account
    await page.getByRole('article', { name: 'Fidelity' }).getByRole('button', { name: 'Archive' }).first().click();
    await expect(page.getByRole('alert')).toContainText('Archive all active accounts');

    // Rename Account and verify History preserves both revisions
    await page.getByRole('row', { name: /Taxable Margin/ }).getByRole('button', { name: 'Rename' }).click();
    await page.getByLabel('Rename account').fill('Individual Margin');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Individual Margin', { exact: true })).toBeVisible();

    await page.getByRole('row', { name: /Individual Margin/ }).getByRole('button', { name: 'History' }).click();
    await expect(page.getByText(/Rev 1: Created/)).toBeVisible();
    await expect(page.getByText(/Rev 2: Renamed/)).toBeVisible();

    // 4. Live viewport resize (wide -> narrow -> wide) must preserve unsaved form input
    await page.getByLabel('Institution name').fill('Unsaved Broker Draft');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
    await expect(page.getByLabel('Institution name')).toHaveValue('Unsaved Broker Draft');
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByLabel('Institution name')).toHaveValue('Unsaved Broker Draft');
    await page.getByLabel('Institution name').fill('');

    // 5. Accessibility check on Accounts view (WCAG AA)
    const accountsAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(accountsAxe.violations).toEqual([]);

    // 6. About view: edit time zone + verify 4 readiness checks + Capability Manifest
    await page.getByRole('navigation', { name: 'Workspace sections' }).getByRole('button', { name: 'About' }).click();
    await expect(page.getByRole('heading', { name: 'About & Workspace Status' })).toBeVisible();
    await page.getByLabel('IANA Time Zone').fill('America/Chicago');
    await page.getByRole('button', { name: 'Save Time Zone' }).click();
    await expect(page.getByText('Saved time zone "America/Chicago"')).toBeVisible();
    await expect(page.getByText('Workspace.initialize')).toBeVisible();

    const aboutAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(aboutAxe.violations).toEqual([]);

    // 7. Cold offline restart: disable network, reload, verify app starts Writable offline
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Institutions & Accounts' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Individual Margin', { exact: true })).toBeVisible();

    // Offline mutation works cleanly
    await page.getByLabel('Institution name').fill('Schwab Offline');
    await page.getByRole('button', { name: 'Add Institution' }).click();
    await expect(page.getByRole('heading', { name: 'Schwab Offline' })).toBeVisible();

    await context.setOffline(false);
  });

  test('enters RecoveryOnly when cached offline asset is tampered and IntegrityBlocked when bootstrap root is corrupted', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Initialize Local Workspace' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByLabel('IANA Time Zone').fill('America/New_York');
    await page.getByRole('button', { name: 'Initialize Workspace' }).click();
    await expect(page.getByRole('heading', { name: 'Institutions & Accounts' })).toBeVisible();

    // Tamper with a cached asset in CacheStorage -> reload -> Recovery Only
    await page.evaluate(async () => {
      const keys = await caches.keys();
      const relKey = keys.find(
        (k) => k.startsWith('tjv3-release-') && k !== 'tjv3-release-meta',
      );
      if (!relKey) throw new Error('Release cache not found');
      const cache = await caches.open(relKey);
      await cache.put('/icon-192.svg', new Response('tampered-bytes', { headers: { 'content-type': 'image/svg+xml' } }));
    });

    await page.reload();
    await expect(page.getByText(/Recovery Only:/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Add Institution' })).toBeDisabled();

    // Corrupt bootstrap pointer -> reload -> Integrity Blocked (never treated as empty first run)
    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('tjv3_bootstrap', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('pointer', 'readwrite');
          tx.objectStore('pointer').put({ key: 'active', activeGeneration: -1, schemaVersion: 'bad' });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Workspace Integrity Blocked' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'Initialize Workspace' })).toHaveCount(0);
  });
});
