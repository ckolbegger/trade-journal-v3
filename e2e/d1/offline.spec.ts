import { confirmPlan, expect, firstPage, onboardedPage, PLAN, READY, test } from './support.ts';

test.describe('B1.4 offline cold restart', () => {
  test('should open Writable without a network, confirm a second Plan and add an Account, and keep both across another offline restart', async ({ server, profile }) => {
    const online = await profile.launch();
    await confirmPlan(await onboardedPage(online));
    await online.close();
    // Network disabled: offline emulation plus no server for the origin at all.
    await server.close();

    const offline = await profile.launch({ offline: true });
    const page = await firstPage(offline);
    await page.goto('/');
    await expect(page.getByRole('row', { name: /XYZ/ })).toBeVisible(READY);
    await expect(page.getByRole('heading', { name: /Read only/ })).toHaveCount(0);
    await confirmPlan(page, { ...PLAN, symbol: 'ABC' });
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Accounts' }).click();
    await page.getByRole('button', { name: 'Add Account' }).click();
    await page.getByLabel('Account name').fill('Taxable');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Taxable' })).toBeVisible();
    await offline.close();

    const again = await profile.launch({ offline: true });
    const reopened = await firstPage(again);
    await reopened.goto('/');
    await expect(reopened.getByRole('row', { name: /XYZ/ })).toBeVisible(READY);
    await expect(reopened.getByRole('row', { name: /ABC/ })).toBeVisible();
    await reopened.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Accounts' }).click();
    await expect(reopened.getByRole('listitem').filter({ hasText: 'Taxable' })).toBeVisible();
    await again.close();
  });
});
