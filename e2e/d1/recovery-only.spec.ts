import { confirmPlan, EXPLANATION, expect, FAULT_SETS, firstPage, onboardedPage, PLANNED, probe, READY, test } from './support.ts';

test.describe('B1.6 Recovery Only matrix (existing Workspace, faults build)', () => {
  test('should open Recovery Only with the failed checks for each fault set, keeping the Plan readable and the stores unchanged', async ({ server, profile }) => {
    test.setTimeout(180_000);
    void server;
    const setup = await profile.launch();
    const first = await onboardedPage(setup);
    await confirmPlan(first);
    const before = await probe(first);
    await setup.close();

    for (const failing of FAULT_SETS) {
      const context = await profile.launch();
      const page = await firstPage(context);
      await page.goto(`${PLANNED}&faults=${failing.join(',')}`);
      const banner = page.getByRole('region', { name: "Read only: this browser can't save right now" });
      await expect(banner, failing.join(',')).toBeVisible(READY);
      await expect(banner.getByRole('listitem')).toHaveText(failing.map((check) => EXPLANATION[check]));
      await expect(banner.getByText('Another browser has its own separate storage')).toBeVisible();
      const nav = page.getByRole('navigation', { name: 'Primary' });
      await expect(nav.getByRole('link', { name: 'New Plan' })).toHaveCount(0);

      await page.getByRole('row', { name: /XYZ/ }).getByRole('link', { name: 'XYZ' }).click();
      await expect(page.getByText('Breakout above the 50-day on volume.')).toBeVisible();
      await nav.getByRole('link', { name: 'Accounts' }).click();
      await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Add (Account|Institution)/ })).toHaveCount(0);

      expect(await probe(page), failing.join(',')).toEqual(before);
      await context.close();
    }
  });
});
