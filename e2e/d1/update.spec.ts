import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { OfflineReleaseInventory } from '../../src/delivery/inventory.ts';
import { expect, fillPlan, onboardedPage, probe, READY, test, workspaceOf } from './support.ts';

const identity = (release: string) =>
  (JSON.parse(readFileSync(`dist-releases/${release}/inventory.json`, 'utf8')) as OfflineReleaseInventory).releaseId;

// The release identity the controlling service worker reports.
function controllerRelease(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      new Promise<string | null>((resolve) => {
        const worker = navigator.serviceWorker.controller;
        if (!worker) return resolve(null);
        const channel = new MessageChannel();
        channel.port1.onmessage = (event: MessageEvent<{ releaseId?: string }>) => resolve(event.data.releaseId ?? null);
        worker.postMessage({ type: 'ReleaseIdentity' }, [channel.port2]);
      }),
  );
}

// Asks the browser to look for a newer release, as "Check for updates" does, and waits for the
// attempt to settle (installed and waiting, or discarded).
async function checkForUpdate(page: Page): Promise<{ waiting: string | null }> {
  return page.evaluate(async () => {
    const registration = (await navigator.serviceWorker.getRegistration())!;
    await registration.update().catch(() => undefined);
    for (let i = 0; i < 100 && registration.installing; i++) await new Promise((resolve) => setTimeout(resolve, 100));
    return { waiting: registration.waiting?.state ?? null };
  });
}

async function openNewPlan(page: Page): Promise<void> {
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'New Plan' }).click();
  await expect(page.getByRole('heading', { name: 'New Plan' })).toBeVisible();
}

const notice = (page: Page) => page.getByRole('region', { name: 'Update' });

test.describe('B1.10 update with unsaved work', () => {
  test('should notify only once v2 is waiting, defer Reload while the form is unsaved, then activate v2 with the Workspace unchanged', async ({ server, profile }) => {
    server.use('dist-releases/v1');
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await openNewPlan(page);
    await page.getByLabel('Symbol').fill('XYZ');
    const before = workspaceOf(await probe(page));
    await expect(notice(page)).toHaveCount(0);

    server.use('dist-releases/v2');
    expect(await checkForUpdate(page)).toEqual({ waiting: 'installed' });
    await expect(notice(page)).toContainText('An update is ready');
    await expect(notice(page)).toContainText('The update waits until you save or cancel the open form.');
    await expect(notice(page).getByRole('button', { name: 'Reload' })).toBeDisabled();
    expect(await controllerRelease(page)).toBe(identity('v1'));

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(notice(page).getByRole('button', { name: 'Reload' })).toBeEnabled();
    await notice(page).getByRole('button', { name: 'Reload' }).click();
    await page.waitForEvent('load');
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'About' }).click(READY);
    await expect(page.locator('.identity')).toHaveText(identity('v2'));
    for (const check of ['Test save and read-back', 'Storage space', 'Offline component in control', 'Offline copy complete']) {
      await expect(page.getByRole('listitem').filter({ hasText: `${check}: passed` })).toBeVisible();
    }
    expect(await controllerRelease(page)).toBe(identity('v2'));
    expect(workspaceOf(await probe(page))).toEqual(before);
    await context.close();
  });
});

test.describe('B1.11 corrupt update', () => {
  test('should show no notice, keep v1 in control, and leave no v2 cache when the update fails verification', async ({ server, profile }) => {
    server.use('dist-releases/v1');
    const context = await profile.launch();
    const page = await onboardedPage(context);

    server.use('dist-releases/v2-corrupt');
    expect(await checkForUpdate(page)).toEqual({ waiting: null });
    await expect(notice(page)).toHaveCount(0);
    expect(await controllerRelease(page)).toBe(identity('v1'));
    const cacheNames: string[] = await page.evaluate(() => caches.keys());
    expect(cacheNames).toEqual([`tj-release-${identity('v1')}`]);
    await context.close();
  });
});

test.describe('B1.12 offline keeps the installed release', () => {
  test('should show no notice offline and keep v1 running and Writable', async ({ server, profile }) => {
    server.use('dist-releases/v1');
    const context = await profile.launch();
    const page = await onboardedPage(context);

    server.use('dist-releases/v2');
    // Offline: emulation alone does not cover the service worker's own fetches, so the origin's
    // server is stopped as well.
    await context.setOffline(true);
    await server.close();
    expect(await checkForUpdate(page)).toEqual({ waiting: null });
    await expect(notice(page)).toHaveCount(0);
    await page.reload();
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'About' }).click(READY);
    await expect(page.locator('.identity')).toHaveText(identity('v1'));
    await expect(page.getByRole('region', { name: /Read only/ })).toHaveCount(0);
    await context.close();
  });
});

test.describe('B1.13 two tabs, one unsaved', () => {
  test('should explain in the clean tab that another tab has unsaved work, keeping Reload disabled until that form is cancelled', async ({ server, profile }) => {
    server.use('dist-releases/v1');
    const context = await profile.launch();
    const editing = await onboardedPage(context);
    const clean = await context.newPage();
    await clean.goto('/');
    await expect(clean.getByRole('heading', { name: /Trades|Planned/ }).or(clean.getByText('No planned trades yet'))).toBeVisible(READY);
    await openNewPlan(editing);
    await fillPlan(editing);

    server.use('dist-releases/v2');
    expect(await checkForUpdate(clean)).toEqual({ waiting: 'installed' });
    await expect(notice(clean)).toContainText('The update waits because another tab has unsaved work.');
    await expect(notice(clean).getByRole('button', { name: 'Reload' })).toBeDisabled();

    await editing.getByRole('button', { name: 'Cancel' }).click();
    await expect(notice(clean).getByRole('button', { name: 'Reload' })).toBeEnabled();
    await context.close();
  });
});

test.describe('B1.13 two tabs, the clean one opened after the form became unsaved (critic-1)', () => {
  test('should defer Reload and explain in a tab opened later, where "Check for updates" reports the waiting update once', async ({ server, profile }) => {
    server.use('dist-releases/v1');
    const context = await profile.launch();
    const editing = await onboardedPage(context);
    await openNewPlan(editing);
    await fillPlan(editing);

    const about = await context.newPage();
    await about.goto('/about');
    await expect(about.locator('.identity')).toHaveText(identity('v1'), READY);
    server.use('dist-releases/v2');
    await about.getByRole('button', { name: 'Check for updates' }).click();
    await expect(notice(about)).toHaveCount(1, READY);
    await expect(notice(about)).toContainText('The update waits because another tab has unsaved work.');
    await expect(notice(about).getByRole('button', { name: 'Reload' })).toBeDisabled();
    await expect(about.getByText('No update')).toHaveCount(0);
    await context.close();
  });
});
