import { EXPLANATION, expect, fillPlan, onboardedPage, probe, test, workspaceOf } from './support.ts';

test.describe('B1.9 mid-session failure (faults build)', () => {
  for (const check of ['inventory', 'diagnostic'] as const) {
    test(`should explain RuntimeNotWritable, keep the form values, and switch to Recovery Only when ${check} starts failing before Confirm`, async ({ server, profile }) => {
      void server;
      const context = await profile.launch();
      const page = await onboardedPage(context);
      await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'New Plan' }).click();
      await fillPlan(page);

      await page.evaluate((failing) => window.__tjFaults?.set([failing]), check);
      await page.getByRole('button', { name: 'Confirm Plan' }).click();

      const banner = page.getByRole('region', { name: "Read only: this browser can't save right now" });
      await expect(banner).toBeVisible();
      await expect(banner.getByRole('listitem')).toHaveText([EXPLANATION[check]]);
      await expect(page.getByLabel('Symbol')).toHaveValue('XYZ');
      await expect(page.getByLabel('Why this trade, why now?')).toHaveValue('Breakout above the 50-day on volume.');
      await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'New Plan' })).toHaveCount(0);
      expect(workspaceOf(await probe(page))!.stores['trades']).toEqual([]);
      await context.close();
    });
  }
});
