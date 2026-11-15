import {
  buildOc3, chooseFile, completeLine, downloadBackup, DOWNLOADED_NOT_VERIFIED, downloadSection, expect, firstPage, fullDigestOf, installDump, launchAt, MONDAY_1005, openBackup, primaryNav,
  probe, profileAt, READY, readSaved, scratch, seedJournal, test, THURSDAY_1800, TUESDAY_NOON, verifyWith, writeTruncated,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// B8.1 (plan section 6.2, AC-BACK-001): O-C3 (the D8P browser cases' Trade, with its Marks, Journal and deferred reflection) created through the UI at Thu 2026-10-15 18:00
// New York; the Backup page; the saved file is read by the test itself, with its own gunzip and SHA-256.
test.describe('B8.1 Download and verify', () => {
  test('should show Downloaded not verified yet and then Backup complete with the time, name the file by A124, match the manifest digest in the saved file, and change no store', async ({ profile }) => {
    test.setTimeout(420_000);
    await buildOc3(profile, { thursdayHold: true });
    const context = await launchAt(profile, THURSDAY_1800);
    const page = await firstPage(context);
    await page.goto('/');
    await openBackup(page);
    const before = await probe(page);

    const saved = scratch('first.tjbackup');
    const fileName = await downloadBackup(page, saved);
    const section = downloadSection(page);
    await expect(section.getByText(DOWNLOADED_NOT_VERIFIED)).toBeVisible();
    await expect(section.getByText(fileName, { exact: true })).toBeVisible();

    // A124: the date and time in the Workspace zone, then the first 8 hex digits of the full digest.
    const artifact = readSaved(saved);
    expect(fileName).toMatch(/^trade-journal-2026-10-15-1800-[0-9a-f]{8}\.tjbackup$/);
    expect(artifact.gzip).toBe(true);
    expect(artifact.manifest.kind).toBe('manifest');
    expect(fullDigestOf(artifact)).toBe(artifact.manifest.fullDigest);
    expect(fileName.slice(-17, -9)).toBe(artifact.manifest.fullDigest.slice(0, 8));

    await verifyWith(page, saved);
    await expect(completeLine(section)).toHaveText('Backup complete. Checked Thu Oct 15, 18:00.');
    await expect(section.getByText(DOWNLOADED_NOT_VERIFIED)).toHaveCount(0);
    expect(await probe(page)).toEqual(before);
    await context.close();
  });
});

// B8.2: a journal with one Plan. The second download follows a clock step so that it is a different backup (its creation time differs).
test.describe('B8.2 Unverified and failed verification', () => {
  test('should offer no Verify for an earlier download after leaving the page, show the messages for a truncated and for a different backup, and never show Backup complete', async ({ profile }) => {
    await seedJournal(profile);
    const context = await launchAt(profile, MONDAY_1005);
    const page = await firstPage(context);
    await page.goto('/');
    await openBackup(page);
    const section = downloadSection(page);

    await downloadBackup(page, scratch('earlier.tjbackup'));
    await expect(section.getByText(DOWNLOADED_NOT_VERIFIED)).toBeVisible();
    await primaryNav(page).getByRole('link', { name: 'About' }).click();
    await expect(page.getByRole('heading', { name: 'About', level: 1 })).toBeVisible(READY);
    await openBackup(page);
    await expect(section.getByRole('button', { name: 'Download backup' })).toBeVisible();
    await expect(section.getByRole('button', { name: /^(Verify backup|Choose another file)$/ })).toHaveCount(0);
    await expect(section.getByText(DOWNLOADED_NOT_VERIFIED)).toHaveCount(0);

    // A later download: the clock has moved, so the earlier file is another backup of the same journal.
    await context.clock.setFixedTime(new Date(TUESDAY_NOON));
    const latest = scratch('latest.tjbackup');
    await downloadBackup(page, latest);
    const truncated = scratch('truncated.tjbackup');
    writeTruncated(latest, truncated);

    await verifyWith(page, truncated);
    await expect(section.getByRole('alert')).toHaveText("This file is incomplete or damaged, so it isn't a usable backup.");
    await expect(section.getByRole('button', { name: 'Choose another file' })).toBeVisible();
    await verifyWith(page, scratch('earlier.tjbackup'));
    await expect(section.getByRole('alert')).toHaveText('This is a different backup from the one you just downloaded.');
    await expect(completeLine(page)).toHaveCount(0);
    await context.close();
  });
});

// B8.5 (faults build, AC-BACK-001): the snapshot read fails at its first batch.
test.describe('B8.5 Read failure', () => {
  test('should say The backup could not be made with the Read stage, offer no download, and leave the probe unchanged', async ({ profile }) => {
    await seedJournal(profile);
    const context = await launchAt(profile, MONDAY_1005);
    const page = await firstPage(context);
    await page.goto('/backup?faults=backup:read');
    await expect(page.getByRole('heading', { name: 'Backup', level: 1 })).toBeVisible(READY);
    const before = await probe(page);
    let downloads = 0;
    page.on('download', () => (downloads += 1));

    await downloadSection(page).getByRole('button', { name: 'Download backup' }).click();
    const section = downloadSection(page);
    await expect(section.getByRole('alert')).toHaveText("The backup could not be made. Your journal couldn't be read. Nothing was changed.");
    await expect(section.getByRole('button', { name: 'Retry' })).toBeVisible();
    await expect(section.getByText(DOWNLOADED_NOT_VERIFIED)).toHaveCount(0);
    expect(downloads).toBe(0);
    expect(await probe(page)).toEqual(before);
    await context.close();
  });
});

// B8.9 (faults build, AC-REST-004): the fixture loader writes the frozen schema-5 Workspace into a fresh profile, once with a Close Reason naming an unknown
// Catalog identity (the conversion stops), once valid but launched with the capacity check failing (the conversion waits).
test.describe('B8.9 Blocked database copy', () => {
  test('should offer Download a copy and Verify on Migration Blocked and verify the copy, and Download a copy with the explanation and no Verify on AwaitingMigration, leaving the old stores unchanged', async ({ profile }) => {
    const blockedDir = `${profile.dir}-blocked`;
    await installDump(blockedDir, { brokenCloseReason: true });
    const blocked = await profileAt(blockedDir).launch();
    const page = await firstPage(blocked);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Your journal could not be converted to this release' })).toBeVisible(READY);
    await expect(page.getByRole('button')).toHaveText(['Retry', 'Download a copy', 'Verify']);
    const before = await probe(page);
    const copy = scratch('blocked-copy.tjbackup');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download a copy' }).click()]);
    await download.saveAs(copy);
    await expect(page.getByText(DOWNLOADED_NOT_VERIFIED)).toBeVisible(READY);
    await chooseFile(page, () => page.getByRole('button', { name: 'Verify' }).click(), copy);
    await expect(page.getByText('Backup complete', { exact: true })).toBeVisible(READY);
    expect(readSaved(copy).header).toMatchObject({ exportKind: 'BlockedDatabase', schemaVersion: 5 });
    expect(await probe(page)).toEqual(before);
    await blocked.close();

    const waitingDir = `${profile.dir}-waiting`;
    await installDump(waitingDir, { brokenCloseReason: false });
    const waiting = await profileAt(waitingDir).launch();
    const held = await firstPage(waiting);
    await held.goto('/?faults=capacity');
    await expect(held.getByRole('heading', { name: 'This release must convert your journal before you can use it' })).toBeVisible(READY);
    await expect(held.getByText("This release can't confirm the copy until your journal has been updated.")).toBeVisible();
    await expect(held.getByRole('button', { name: 'Verify' })).toHaveCount(0);
    const waitingBefore = await probe(held);
    const [offered] = await Promise.all([held.waitForEvent('download'), held.getByRole('button', { name: 'Download a copy' }).click()]);
    await offered.saveAs(scratch('waiting-copy.tjbackup'));
    await expect(held.getByText(DOWNLOADED_NOT_VERIFIED)).toBeVisible(READY);
    expect(await probe(held)).toEqual(waitingBefore);
    await waiting.close();
  });
});
