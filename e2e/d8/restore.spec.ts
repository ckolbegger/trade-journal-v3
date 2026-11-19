import type { Page } from '@playwright/test';
import {
  BASE_URL, backUpFirst, buildOc3, chooseFile, chooseRestoreFile, completeLine, confirmStep, declineSafetyBackup, detail, downloadBackup, expect, FIXTURE_BACKUP, fillPlan, firstPage,
  launchAt, MONDAY_1005, onboardedPage, openBackup, openDrawer, pinClock, PLAN, probe, profileAt, READY, readSaved, replaceEntire, restoreComplete, restoreSection, restoreWithoutBackup, rootOf,
  safetyBackup, scratch, seedJournal, spawnedBrowser, test, THURSDAY_1800, understood, verifyWith, watchOutgoing, withoutEmptyCandidateList, workspaceNames, workspaceOf, writeFlipped, writeNewer, type ProbedDatabase,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

const FIXTURE_TRADES = readSaved(FIXTURE_BACKUP).manifest.counts['trades']!;

// The Open list and four drawers of a Trade's Detail, as text: what a trader sees of the Trade (B8.3 compares them across a Restore).
async function viewsOf(page: Page, tradeId: string): Promise<Record<string, string>> {
  await page.goto('/');
  await expect(page.getByRole('row', { name: /XYZ/ })).toBeVisible(READY);
  const views: Record<string, string> = { list: await page.getByRole('table').first().innerText() };
  await page.goto(`/trades/${tradeId}`);
  await expect(detail.heading(page, 'XYZ')).toBeVisible(READY);
  // The Detail shows before its replay is read (W20); the Marks are built from the replay, so wait until no drawer still says it is loading.
  await expect(page.locator('[role="status"]', { hasText: 'Loading the Trade' })).toHaveCount(0, READY);
  for (const drawer of ['Today', 'Position', 'Plan and Risk', 'Journal'] as const) {
    await openDrawer(page, drawer);
    views[drawer] = await page.locator(`#drawer-panel-${drawer.toLowerCase().replaceAll(' ', '-')}`).innerText();
  }
  return views;
}

// The stored stores of a database, without its IndexedDB version number.
const storesOf = (db: ProbedDatabase | undefined) => (db ? { stores: db.stores, indexes: db.indexes } : undefined);

// B8.3 (AC-REST-001, AC-REST-002): profile A holds O-C3 (as B8.1); profile B holds another Plan; both launch at Thu 2026-10-15 18:00 New York.
test.describe('B8.3 Restore with a safety backup', () => {
  test('should show the preview with counts, enable Replace only after both steps, render the summary, and after relaunch show lists and Details equal to profile A with a new pointer target and the old database gone', async ({ profile }) => {
    test.setTimeout(600_000);
    const a = profileAt(`${profile.dir}-a`);
    const b = profileAt(`${profile.dir}-b`);
    const trade = await buildOc3(a, { thursdayHold: true });
    const fileA = scratch('from-a.tjbackup');
    const contextA = await launchAt(a, THURSDAY_1800);
    const pageA = await firstPage(contextA);
    const viewsA = await viewsOf(pageA, trade.tradeId);
    await openBackup(pageA);
    await downloadBackup(pageA, fileA);
    await verifyWith(pageA, fileA);
    await expect(completeLine(pageA)).toBeVisible(READY);
    await contextA.close();

    await seedJournal(b, MONDAY_1005, { ...PLAN, symbol: 'ABC' });
    const context = await launchAt(b, THURSDAY_1800);
    const page = await firstPage(context);
    await page.goto('/');
    await openBackup(page);
    const before = await probe(page);
    const oldDatabase = rootOf(before).current;

    await chooseRestoreFile(page, fileA);
    const section = restoreSection(page);
    await expect(section.getByRole('heading', { name: 'Restoring replaces your entire current journal' })).toBeVisible();
    // The counts of the backup beside the counts of this journal: A's Open Trade against B's Planned one.
    const counts = section.getByRole('table');
    await expect(counts.getByRole('columnheader')).toHaveText(['In the backup', 'In your current journal']);
    await expect(counts.getByRole('row', { name: /^Open Trades/ }).getByRole('cell')).toHaveText(['1', '0']);
    await expect(counts.getByRole('row', { name: /^Planned Trades/ }).getByRole('cell')).toHaveText(['0', '1']);

    // Replace needs the replacement checkbox and a complete safety choice (a verified backup).
    await expect(replaceEntire(page)).toBeDisabled();
    await understood(page).check();
    await expect(replaceEntire(page)).toBeDisabled();
    await expect(safetyBackup(page)).toBeVisible();
    const safety = scratch('safety.tjbackup');
    await page.getByRole('radio', { name: 'Back up this journal first (recommended)' }).check();
    await downloadBackup(page, safety, confirmStep(page));
    await expect(replaceEntire(page)).toBeDisabled();
    await verifyWith(page, safety, confirmStep(page));
    await expect(completeLine(confirmStep(page))).toBeVisible(READY);
    await expect(replaceEntire(page)).toBeEnabled();

    await replaceEntire(page).click();
    await expect(restoreComplete(page)).toBeVisible(READY);
    await expect(section.getByText('Your journal now holds the restored backup.')).toBeVisible();
    await expect(section.getByRole('table').getByRole('row', { name: /^Open Trades/ }).getByRole('cell')).toHaveText(['1']);
    await context.close();

    const relaunched = await launchAt(b, THURSDAY_1800);
    const reopened = await firstPage(relaunched);
    expect(await viewsOf(reopened, trade.tradeId)).toEqual(viewsA);
    const after = await probe(reopened);
    expect(rootOf(after).current).not.toBe(oldDatabase);
    expect(after[oldDatabase]).toBeUndefined();
    expect(workspaceNames(after)).toEqual([rootOf(after).current]);
    expect(rootOf(after).candidates).toEqual([]);
    await relaunched.close();
  });
});

// B8.4: profile B again (a journal with data) restores the frozen schema-7 backup without a safety backup; a fresh profile C restores it on first run.
test.describe('B8.4 Decline and first run', () => {
  test('should require the warning and its acknowledgment to replace without a backup, then complete, and on a fresh profile offer no safety choice and land on the summary and then Trades', async ({ profile }) => {
    await seedJournal(profile);
    const context = await launchAt(profile, MONDAY_1005);
    const page = await firstPage(context);
    await page.goto('/');
    await openBackup(page);
    await chooseRestoreFile(page, FIXTURE_BACKUP);
    await expect(replaceEntire(page)).toBeDisabled();
    await understood(page).check();
    await expect(replaceEntire(page)).toBeDisabled();
    await page.getByRole('radio', { name: 'Replace without a backup' }).check();
    await expect(page.getByText('If this backup is wrong or incomplete, your current journal cannot be recovered.')).toBeVisible();
    await expect(replaceEntire(page)).toBeDisabled();
    await declineSafetyBackup(page);
    await expect(replaceEntire(page)).toBeEnabled();
    await replaceEntire(page).click();
    await expect(restoreComplete(page)).toBeVisible(READY);
    await context.close();

    const fresh = await profileAt(`${profile.dir}-c`).launch();
    const first = await firstPage(fresh);
    await first.goto('/');
    await expect(first.getByRole('heading', { name: 'Start your journal' })).toBeVisible(READY);
    await first.getByRole('button', { name: 'Restore from a backup' }).click();
    await chooseRestoreFile(first, FIXTURE_BACKUP);
    await expect(safetyBackup(first)).toHaveCount(0);
    await understood(first).check();
    await expect(replaceEntire(first)).toBeEnabled();
    await replaceEntire(first).click();
    await expect(restoreComplete(first)).toBeVisible(READY);
    await first.getByRole('link', { name: 'Go to Trades' }).click();
    await expect(first.getByRole('tablist', { name: 'Trades by lifecycle' })).toBeVisible(READY).catch(async (error: unknown) => {
      // The screen a trader is left on, kept for the bug report.
      await first.screenshot({ path: scratch('after-go-to-trades.png') });
      throw error;
    });
    await fresh.close();
  });
});

// B8.6 (AC-REST-001): R-flip is the frozen backup with one stored value changed and no digest recomputed; R-new claims a schema newer than this release's.
test.describe('B8.6 Rejected artifact', () => {
  test('should list the issues with Your current journal is unchanged, leave every store and every database as it was, and send no request out of the origin', async ({ profile }) => {
    const flipped = scratch('r-flip.tjbackup');
    const newer = scratch('r-new.tjbackup');
    writeFlipped(FIXTURE_BACKUP, flipped);
    writeNewer(FIXTURE_BACKUP, newer);
    await seedJournal(profile);
    const context = await launchAt(profile, MONDAY_1005);
    const outgoing = watchOutgoing(context);
    const page = await firstPage(context);
    await page.goto('/');
    await openBackup(page);
    const before = await probe(page);

    await chooseFile(page, () => page.getByRole('button', { name: 'Choose backup file' }).click(), flipped);
    const alert = restoreSection(page).getByRole('alert');
    await expect(alert).toBeVisible(READY);
    await expect(alert).toContainText("This backup can't be restored.");
    await expect(alert).toContainText('Your current journal is unchanged.');
    await expect(alert.getByRole('listitem')).toHaveText([/section doesn't match its checksum, so the file was changed or damaged\.$/]);
    expect(withoutEmptyCandidateList(await probe(page))).toEqual(before);

    await chooseFile(page, () => alert.getByRole('button', { name: 'Check the backup again' }).click(), newer);
    await expect(alert.getByRole('listitem')).toHaveText(['This backup was made by a newer version of the app.'], READY);
    await expect(alert).toContainText('Your current journal is unchanged.');

    const after = await probe(page);
    expect(withoutEmptyCandidateList(after)).toEqual(before);
    expect(workspaceNames(after)).toEqual([rootOf(before).current]);
    expect(rootOf(after).candidates).toEqual([]);
    expect(outgoing.leaving()).toEqual([]);
    await context.close();
  });
});

// B8.7 (faults build, AC-REST-003): the recheck of the `journalEntries` store fails once, so the apply is refused after a verified safety backup.
test.describe('B8.7 Apply failure', () => {
  test('should say Your current journal is unchanged with the old pointer and no candidate, and complete the second attempt without the fault', async ({ profile }) => {
    await seedJournal(profile);
    const context = await launchAt(profile, MONDAY_1005);
    const page = await firstPage(context);
    await page.goto('/?faults=restore:apply:journalEntries');
    await openBackup(page);
    const before = await probe(page);

    await chooseRestoreFile(page, FIXTURE_BACKUP);
    await understood(page).check();
    await backUpFirst(page, scratch('safety-1.tjbackup'));
    await replaceEntire(page).click();
    const alert = restoreSection(page).getByRole('alert');
    await expect(alert).toContainText('Your current journal is unchanged.', READY);
    await expect(alert.getByRole('button', { name: 'Check the backup again' })).toBeVisible();
    const refused = await probe(page);
    expect(rootOf(refused)).toEqual(rootOf(before));
    expect(workspaceNames(refused)).toEqual([rootOf(before).current]);
    expect(storesOf(workspaceOf(refused))).toEqual(storesOf(workspaceOf(before)));

    await page.evaluate(() => window.__tjFaults?.set([]));
    await chooseFile(page, () => alert.getByRole('button', { name: 'Check the backup again' }).click(), FIXTURE_BACKUP);
    await expect(page.getByRole('heading', { name: 'Restoring replaces your entire current journal' })).toBeVisible(READY);
    await understood(page).check();
    await backUpFirst(page, scratch('safety-2.tjbackup'));
    await replaceEntire(page).click();
    await expect(restoreComplete(page)).toBeVisible(READY);
    const after = await probe(page);
    expect(rootOf(after).current).not.toBe(rootOf(before).current);
    expect(workspaceOf(after)!.stores['trades']).toHaveLength(FIXTURE_TRADES);
    await context.close();
  });
});

// B8.11 (A136): tab 2 holds an unsaved Plan form while tab 1 restores.
test.describe('B8.11 Other tab', () => {
  test('should warn in tab 1 about unsaved work in another tab, show Replaced by a Restore in another tab in tab 2 with its values on screen, and refuse Confirm there', async ({ profile }) => {
    await seedJournal(profile);
    const context = await launchAt(profile, MONDAY_1005);
    const tab1 = await firstPage(context);
    await tab1.goto('/');
    await openBackup(tab1);
    const tab2 = await context.newPage();
    await tab2.goto('/plans/new');
    await fillPlan(tab2, { ...PLAN, symbol: 'QQQ' });

    await chooseRestoreFile(tab1, FIXTURE_BACKUP);
    // Soft, so that the rest of the case still runs when the warning is missing.
    await expect.soft(restoreSection(tab1).getByText('Another tab has unsaved changes. They will be lost when the journal is replaced.')).toBeVisible();
    await tab1.screenshot({ path: scratch('preview-in-tab-1.png') });
    await understood(tab1).check();
    await declineSafetyBackup(tab1);
    await replaceEntire(tab1).click();
    await expect(restoreComplete(tab1)).toBeVisible(READY);

    await expect(tab2.getByText('This journal was replaced by a Restore in another tab. Reload to continue.')).toBeVisible(READY);
    await expect(tab2.getByLabel('Symbol')).toHaveValue('QQQ');
    await expect(tab2.getByLabel('Why this trade, why now?')).toHaveValue(PLAN.thesis);
    // The shell has already turned the form read only, so Confirm cannot even be pressed (the plan says its commit returns RuntimeNotWritable; reported with B8.11).
    await expect(tab2.getByRole('button', { name: 'Confirm Plan' })).toBeDisabled();
    // Nothing is recorded, the values stay, and the notice stays.
    await expect(tab2.getByText('This journal was replaced by a Restore in another tab. Reload to continue.')).toBeVisible(READY);
    await expect(tab2.getByLabel('Symbol')).toHaveValue('QQQ');
    await expect(tab2.getByRole('heading', { name: 'New Plan' })).toBeVisible();
    const after = await probe(tab1);
    expect(workspaceOf(after)!.stores['trades']).toHaveLength(FIXTURE_TRADES);
    expect(JSON.stringify(workspaceOf(after)!.stores['trades'])).not.toContain('QQQ');
    await context.close();
  });
});

const PORT_BEFORE = 9341;
const PORT_AFTER = 9342;

// B8.13 (faults build, AC-REST-003, AC-DEL-003): a browser killed with SIGKILL while a preparation is held, and again right after the summary renders.
test.describe('B8.13 Kill during Restore', () => {
  test('should keep the live journal and leave no candidate after a kill during preparation, and open the restored journal Ready with the old database gone after a kill right after the summary', async ({ profile }) => {
    test.setTimeout(240_000);
    let before: Record<string, ProbedDatabase>;
    const first = await spawnedBrowser(profile.dir, PORT_BEFORE);
    try {
      await pinClock(first.context, MONDAY_1005);
      const page = await onboardedPage(first.context);
      await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'New Plan' }).click();
      await fillPlan(page);
      await page.getByRole('button', { name: 'Confirm Plan' }).click();
      await expect(detail.heading(page, PLAN.symbol)).toBeVisible(READY);
      await page.goto(`${BASE_URL}/backup?faults=restore:hold-prepare`);
      await expect(page.getByRole('heading', { name: 'Backup', level: 1 })).toBeVisible(READY);
      before = await probe(page);
      await chooseFile(page, () => page.getByRole('button', { name: 'Choose backup file' }).click(), FIXTURE_BACKUP);
      await expect(page.getByText('Checking the backup. Your current journal is not changed.')).toBeVisible(READY);
      // The preparation has staged its candidate and waits.
      await expect.poll(async () => workspaceNames(await probe(page)).length, READY).toBe(2);
    } finally {
      await first.kill();
    }

    const second = await spawnedBrowser(profile.dir, PORT_AFTER);
    try {
      await pinClock(second.context, MONDAY_1005);
      const page = await firstPage(second.context);
      await page.goto(`${BASE_URL}/`);
      await expect(page.getByRole('tablist', { name: 'Trades by lifecycle' })).toBeVisible(READY);
      const after = await probe(page);
      const { current, candidates } = rootOf(after);
      expect(current).toBe(rootOf(before).current);
      expect(candidates).toEqual([]);
      expect(workspaceNames(after)).toEqual([current]);
      expect(storesOf(after[current])).toEqual(storesOf(before[current]));

      await openBackup(page);
      await restoreWithoutBackup(page, FIXTURE_BACKUP);
    } finally {
      await second.kill();
    }

    const third = await spawnedBrowser(profile.dir, PORT_BEFORE);
    try {
      await pinClock(third.context, MONDAY_1005);
      const page = await firstPage(third.context);
      await page.goto(`${BASE_URL}/`);
      await expect(page.getByRole('tablist', { name: 'Trades by lifecycle' })).toBeVisible(READY);
      await expect(page.getByRole('region', { name: /Read only/ })).toHaveCount(0);
      const after = await probe(page);
      const { current, candidates } = rootOf(after);
      expect(current).not.toBe(rootOf(before).current);
      expect(candidates).toEqual([]);
      expect(workspaceNames(after)).toEqual([current]);
      expect(after[rootOf(before).current]).toBeUndefined();
      expect(after[current]!.stores['trades']).toHaveLength(FIXTURE_TRADES);
    } finally {
      await third.kill();
    }
  });
});
