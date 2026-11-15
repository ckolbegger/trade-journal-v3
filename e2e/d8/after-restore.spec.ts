import { chooseRestoreFile, declineSafetyBackup, EXPLANATION, expect, FIXTURE_BACKUP, firstPage, launchAt, MONDAY_1005, openBackup, primaryNav, probe, READY, replaceEntire, restoreComplete, rootOf, scratch, seedJournal, test, understood } from './support.ts';

test.use({ actionTimeout: 15_000 });

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
    await expect.poll(async () => rootOf(await probe(page)).current, READY).not.toBe(oldDatabase);
    await page.evaluate(() => window.__tjFaults?.set(['inventory']));
    await page.evaluate(() => window.__tjFaults?.release());

    await expect(restoreComplete(page)).toBeVisible(READY);
    const banner = page.getByRole('region', { name: "Read only: this browser can't save right now" });
    await expect(banner).toBeVisible(READY).catch(async (error: unknown) => {
      // The summary screen a trader is left on, kept for the bug report.
      await page.screenshot({ path: scratch('summary-without-recovery-only.png') });
      throw error;
    });
    await expect(banner.getByRole('listitem')).toHaveText([EXPLANATION.inventory]);
    await expect(primaryNav(page).getByRole('link', { name: 'New Plan' })).toHaveCount(0);
    await expect(primaryNav(page).getByRole('link', { name: 'Backup' })).toBeVisible();
    await primaryNav(page).getByRole('link', { name: 'Trades' }).click();
    await expect(page.getByRole('tablist', { name: 'Trades by lifecycle' })).toBeVisible(READY);
    await expect(page.getByRole('link', { name: /Record (entry|exit|expiration)/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Record (entry|exit|expiration)|Confirm Plan/ })).toHaveCount(0);
    await context.close();
  });
});
