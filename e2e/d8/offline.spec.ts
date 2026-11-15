import {
  chooseRestoreFile, completeLine, downloadBackup, expect, firstPage, FIXTURE_BACKUP, launchAt, MONDAY_1005, openBackup, profileAt, READY, replaceEntire, restoreComplete, scratch, seedJournal, test, understood, verifyWith,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// B8.14 (AC-DEL-001): two profiles each launched once online; the network is then gone for both.
test.describe('B8.14 Offline', () => {
  test('should download and verify a backup and restore a local file into a second profile with no network', async ({ server, profile }) => {
    test.setTimeout(240_000);
    await seedJournal(profile);
    const second = profileAt(`${profile.dir}-second`);
    const prepared = await second.launch();
    const setup = await firstPage(prepared);
    await setup.goto('/');
    await expect(setup.getByRole('heading', { name: 'Start your journal' })).toBeVisible(READY);
    await prepared.close();
    // Network disabled: offline emulation plus no server for the origin at all.
    await server.close();

    const offline = await launchAt(profile, MONDAY_1005, { offline: true });
    const page = await firstPage(offline);
    await page.goto('/');
    await openBackup(page);
    const saved = scratch('offline.tjbackup');
    await downloadBackup(page, saved);
    await verifyWith(page, saved);
    await expect(completeLine(page)).toBeVisible(READY);
    await offline.close();

    const other = await second.launch({ offline: true });
    const fresh = await firstPage(other);
    await fresh.goto('/');
    await expect(fresh.getByRole('heading', { name: 'Start your journal' })).toBeVisible(READY);
    await fresh.getByRole('button', { name: 'Restore from a backup' }).click();
    await chooseRestoreFile(fresh, FIXTURE_BACKUP);
    await understood(fresh).check();
    await replaceEntire(fresh).click();
    await expect(restoreComplete(fresh)).toBeVisible(READY);
    await other.close();
  });
});
