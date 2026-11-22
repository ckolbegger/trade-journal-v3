import type { Page } from '@playwright/test';
import { chooseRestoreFile, declineSafetyBackup, detail, EXPLANATION, expect, FIXTURE_BACKUP, firstPage, launchAt, MONDAY_1005, openBackup, primaryNav, probe, LAUNCH, replaceEntire, restoreComplete, rootOf, scratch, seedJournal, test, understood } from './support.ts';

test.use({ actionTimeout: 15_000 });

// Moves to a route inside the running application. A page load would start a fresh runtime and drop the inventory fault the case set, and the shell offers
// no link to these routes while read only.
async function goInApp(page: Page, to: string): Promise<void> {
  await page.evaluate((path) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, to);
  // One frame, so the route has rendered before the case looks for what it offers.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

// B8.10 (faults build, AC-DEL-006): the activation has switched the pointer and the Restore is held before its readiness rerun.
test.describe('B8.10 Readiness after Restore', () => {
  test('should show the Restore completed with the shell in Recovery Only naming the inventory check, and no Plan or Record controls', async ({ profile }) => {
    await seedJournal(profile);
    const context = await launchAt(profile, MONDAY_1005);
    const page = await firstPage(context);
    await page.goto('/?faults=restore:hold-activated');
    await openBackup(page);
    const oldDatabase = rootOf(await probe(page)).current;

    await chooseRestoreFile(page, FIXTURE_BACKUP);
    await understood(page).check();
    await declineSafetyBackup(page);
    await replaceEntire(page).click();
    // The hold is reached once the pointer names the new database.
    await expect.poll(async () => rootOf(await probe(page)).current, LAUNCH).not.toBe(oldDatabase);
    await page.evaluate(() => window.__tjFaults?.set(['inventory']));
    await page.evaluate(() => window.__tjFaults?.release());

    await expect(restoreComplete(page)).toBeVisible(LAUNCH);
    const banner = page.getByRole('region', { name: "Read only: this browser can't save right now" });
    await expect(banner).toBeVisible().catch(async (error: unknown) => {
      // The summary screen a trader is left on, kept for the bug report.
      await page.screenshot({ path: scratch('summary-without-recovery-only.png') });
      throw error;
    });
    await expect(banner.getByRole('listitem')).toHaveText([EXPLANATION.inventory]);
    await expect(primaryNav(page).getByRole('link', { name: 'New Plan' })).toHaveCount(0);
    await expect(primaryNav(page).getByRole('link', { name: 'Backup' })).toBeVisible();
    await primaryNav(page).getByRole('link', { name: 'Trades' }).click();
    await expect(page.getByRole('tablist', { name: 'Trades by lifecycle' })).toBeVisible(LAUNCH);
    // The Trades list never offers these controls, so they are checked where a writable journal renders them: a Planned and an Open Trade's Detail (the
    // restored fixture's JKL and CSCO; Record entry and Record exit are links there) and the New Plan form (Confirm Plan is a button). No contract has
    // expired at this clock, so no Record expiration link would show even on a writable journal; it stays in the pattern for the check's completeness.
    for (const [tradeId, symbol] of [['fx-0217', 'JKL'], ['fx-0049', 'CSCO']] as const) {
      await goInApp(page, `/trades/${tradeId}`);
      await expect(detail.heading(page, symbol)).toBeVisible();
      await expect(page.getByRole('link', { name: /Record (entry|exit|expiration)/ })).toHaveCount(0);
    }
    await goInApp(page, '/plans/new');
    // While read only the shell drops this route and renders nothing for it, so the check is that no Confirm Plan button exists.
    await expect(page.getByRole('button', { name: 'Confirm Plan' })).toHaveCount(0);
    await context.close();
  });
});
