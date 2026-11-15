import type { Locator } from '@playwright/test';
import { expectNoSidewaysScroll, setWidth } from '../d7p/support.ts';
import {
  chooseFile, chooseRestoreFile, completeLine, confirmStep, declineSafetyBackup, downloadBackup, downloadSection, expect, expectAccessible, firstPage, FIXTURE_BACKUP, installDump, launchAt, MONDAY_1005, openBackup,
  primaryNav, profileAt, READY, replaceEntire, restoreComplete, restoreSection, safetyBackup, scratch, seedJournal, tabTo, test, understood, verifyWith, WARNING, writeFlipped, writeTruncated,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

const FIXTURE_V6_BLOCKED = 'tests/fixtures/backup-v6-blocked/backup.tjbackup';
const BACKUP_LINK = { name: 'Backup' } as const;

// B8.16 (AC-UI-001, AC-UI-002): the Restore flow at 1280 px, resized to 390 px and back; axe (the WCAG 2.1 A and AA tags the earlier responsive specs use) on the Backup page in every state and on
// every Restore step; the same on first run and the blocked views; the Restore complete by keyboard alone.
test.describe('B8.16 Responsive and accessible', () => {
  test('should keep the flow state and ticked checkboxes across 390 px and back, switch the layout at 960 px, and show no WCAG 2.1 AA violations on the Backup page in every state and on every Restore step', async ({ profile }) => {
    test.setTimeout(300_000);
    await seedJournal(profile);
    const flipped = scratch('r-flip.tjbackup');
    writeFlipped(FIXTURE_BACKUP, flipped);
    const context = await launchAt(profile, MONDAY_1005);
    const page = await firstPage(context);
    await page.goto('/');
    await openBackup(page);

    // The Backup page: initial, making (held), made, Not Verified, Completed, and Not Completed.
    await expectAccessible(page, 'Backup page: initial');
    const saved = scratch('page.tjbackup');
    await downloadBackup(page, saved);
    await expect(downloadSection(page).getByRole('button', { name: 'Verify backup' })).toBeVisible();
    await expectAccessible(page, 'Backup page: downloaded, not verified');
    const truncated = scratch('truncated.tjbackup');
    writeTruncated(saved, truncated);
    await verifyWith(page, truncated);
    await expect(downloadSection(page).getByRole('alert')).toBeVisible(READY);
    await expectAccessible(page, 'Backup page: not verified');
    await verifyWith(page, saved);
    await expect(completeLine(page)).toBeVisible(READY);
    await expectAccessible(page, 'Backup page: completed');
    await page.evaluate(() => window.__tjFaults?.set(['backup:read']));
    await downloadSection(page).getByRole('button', { name: 'Download backup' }).click();
    await expect(downloadSection(page).getByRole('alert')).toContainText('The backup could not be made.', READY);
    await expectAccessible(page, 'Backup page: not completed');
    await page.evaluate(() => window.__tjFaults?.set([]));

    // Restore steps: choose, rejected, checking (held), preview, confirm with each safety choice.
    await expectAccessible(page, 'Restore: choose');
    await chooseFile(page, () => page.getByRole('button', { name: 'Choose backup file' }).click(), flipped);
    await expect(restoreSection(page).getByRole('alert')).toContainText("This backup can't be restored.", READY);
    await expectAccessible(page, 'Restore: rejected');
    await page.evaluate(() => window.__tjFaults?.set(['restore:hold-prepare']));
    await chooseFile(page, () => page.getByRole('button', { name: 'Check the backup again' }).click(), FIXTURE_BACKUP);
    await expect(page.getByText('Checking the backup. Your current journal is not changed.')).toBeVisible(READY);
    await expectAccessible(page, 'Restore: checking');
    await page.evaluate(() => window.__tjFaults?.set([]));
    await page.evaluate(() => window.__tjFaults?.release());
    await expect(page.getByRole('heading', { name: 'Restoring replaces your entire current journal' })).toBeVisible(READY);
    await expectAccessible(page, 'Restore: preview and confirmation');

    // The safety choice is a labelled radio group; its choices and warning are text.
    const choice = safetyBackup(page);
    await expect(choice.getByRole('radio')).toHaveCount(2);
    await page.getByRole('radio', { name: 'Back up this journal first (recommended)' }).check();
    await expectAccessible(page, 'Restore: Back up first chosen');
    await downloadBackup(page, scratch('safety.tjbackup'), confirmStep(page));
    await expectAccessible(page, 'Restore: safety backup downloaded');
    await declineSafetyBackup(page);
    await expect(page.getByText(WARNING)).toBeVisible();
    await expectAccessible(page, 'Restore: Replace without a backup chosen');
    await understood(page).check();
    await expect(replaceEntire(page)).toBeEnabled();

    // 1280 to 390 and back: the preview, the chosen radio and both ticked checkboxes survive; no sideways scroll.
    for (const width of [390, 1280]) {
      await setWidth(page, width);
      await expect(page.getByRole('heading', { name: 'Restoring replaces your entire current journal' })).toBeVisible();
      await expect(understood(page)).toBeChecked();
      await expect(page.getByRole('radio', { name: 'Replace without a backup' })).toBeChecked();
      await expect(page.getByRole('checkbox', { name: WARNING })).toBeChecked();
      await expect(replaceEntire(page)).toBeEnabled();
    }
    await setWidth(page, 390);
    await expectAccessible(page, 'Restore: confirmation at 390');
    await setWidth(page, 1280);

    // The layout switches at 960: the sidebar lists Backup from 960, the bottom bar (and About's link) below it.
    await setWidth(page, 960);
    await expect(primaryNav(page).getByRole('link', BACKUP_LINK)).toBeVisible();
    await setWidth(page, 959);
    await expect(primaryNav(page).getByRole('link', BACKUP_LINK)).toHaveCount(0);
    await setWidth(page, 1280);

    await replaceEntire(page).click();
    await expect(restoreComplete(page)).toBeVisible(READY);
    await expectAccessible(page, 'Restore: complete');
    await context.close();
  });

  test('should show text warnings and migrations for an older backup, and no violations on the Backup page in Recovery Only', async ({ profile }) => {
    await seedJournal(profile);
    const context = await launchAt(profile, MONDAY_1005);
    const page = await firstPage(context);
    await page.goto('/');
    await openBackup(page);
    await chooseRestoreFile(page, FIXTURE_V6_BLOCKED);
    // Warnings and updates are sentences, not a colour or an icon alone.
    const notes = restoreSection(page).locator('.restore-notes li, .restore-warnings li');
    await expect(notes.filter({ hasText: "This backup was made by an earlier version and will be updated as it's restored." })).toBeVisible();
    await expect(notes.filter({ hasText: /^Updated from schema 6 to 7/ })).toBeVisible();
    await expectAccessible(page, 'Restore: preview of an older backup');

    await page.goto('/?faults=control');
    await expect(page.getByRole('region', { name: "Read only: this browser can't save right now" })).toBeVisible(READY);
    await openBackup(page);
    await expect(page.getByRole('heading', { name: 'Restore needs a browser that can save safely' })).toBeVisible();
    await expectAccessible(page, 'Backup page: Recovery Only');
    const saved = scratch('recovery.tjbackup');
    await downloadBackup(page, saved);
    await verifyWith(page, saved);
    await expect(completeLine(page)).toBeVisible(READY);
    await expectAccessible(page, 'Backup page: Recovery Only, completed');
    await context.close();
  });

  test('should show no violations on first run, on its Restore steps, and on the blocked views', async ({ profile }) => {
    test.setTimeout(240_000);
    const fresh = await profile.launch();
    const first = await firstPage(fresh);
    await first.goto('/');
    await expect(first.getByRole('heading', { name: 'Start your journal' })).toBeVisible(READY);
    await expectAccessible(first, 'first run');
    await first.getByRole('button', { name: 'Restore from a backup' }).click();
    await expectAccessible(first, 'first run: Restore choose');
    await chooseRestoreFile(first, FIXTURE_BACKUP);
    await expect(safetyBackup(first)).toHaveCount(0);
    await expectAccessible(first, 'first run: Restore preview');
    await understood(first).check();
    await replaceEntire(first).click();
    await expect(restoreComplete(first)).toBeVisible(READY);
    await expectAccessible(first, 'first run: Restore complete');
    await fresh.close();

    // Migration Blocked, with and without a downloaded copy.
    const blockedDir = `${profile.dir}-blocked`;
    await installDump(blockedDir, { brokenCloseReason: true });
    const blocked = await profileAt(blockedDir).launch();
    const view = await firstPage(blocked);
    await view.goto('/');
    await expect(view.getByRole('heading', { name: 'Your journal could not be converted to this release' })).toBeVisible(READY);
    await expectAccessible(view, 'Migration Blocked');
    const [download] = await Promise.all([view.waitForEvent('download'), view.getByRole('button', { name: 'Download a copy' }).click()]);
    await download.saveAs(scratch('blocked.tjbackup'));
    await expect(view.getByText('Downloaded, not verified yet.')).toBeVisible(READY);
    await expectAccessible(view, 'Migration Blocked: copy downloaded');
    await chooseFile(view, () => view.getByRole('button', { name: 'Verify' }).click(), scratch('blocked.tjbackup'));
    await expect(view.getByText('Backup complete', { exact: true })).toBeVisible(READY);
    await expectAccessible(view, 'Migration Blocked: copy verified');
    await blocked.close();

    // AwaitingMigration.
    const waitingDir = `${profile.dir}-waiting`;
    await installDump(waitingDir, { brokenCloseReason: false });
    const waiting = await profileAt(waitingDir).launch();
    const held = await firstPage(waiting);
    await held.goto('/?faults=capacity');
    await expect(held.getByRole('heading', { name: 'This release must convert your journal before you can use it' })).toBeVisible(READY);
    await expectAccessible(held, 'AwaitingMigration');
    await waiting.close();
  });

  // T8.22-B4 (AC-UI-001): a backup made by this build names a 64-character release; the preview shows it in full, and the page must not scroll sideways at 375 or 320 px.
  test('should show the Restore preview without sideways scroll at 375 and 320 px on the Backup page and on first run', async ({ profile }) => {
    test.setTimeout(240_000);
    await seedJournal(profile);
    const saved = scratch('narrow.tjbackup');
    const context = await launchAt(profile, MONDAY_1005);
    const page = await firstPage(context);
    await page.goto('/');
    await openBackup(page);
    await downloadBackup(page, saved);
    await chooseRestoreFile(page, saved);
    await expect(page.getByText(/\(release [0-9a-f]{64}, schema \d+\)/)).toBeVisible();
    for (const width of [375, 320]) {
      await setWidth(page, width);
      await expectNoSidewaysScroll(page, `Backup page: Restore preview at ${width} px`);
    }
    await context.close();

    const fresh = await profileAt(`${profile.dir}-first-run`).launch();
    const first = await firstPage(fresh);
    await first.goto('/');
    await expect(first.getByRole('heading', { name: 'Start your journal' })).toBeVisible(READY);
    await first.getByRole('button', { name: 'Restore from a backup' }).click();
    await chooseRestoreFile(first, saved);
    for (const width of [375, 320]) {
      await setWidth(first, width);
      await expectNoSidewaysScroll(first, `first run: Restore preview at ${width} px`);
    }
    await fresh.close();
  });

  // T8.22-B6 (AC-UI-001): on the confirm step each checkbox and radio sits at its natural size on its label's line, not stretched across the card.
  test('should keep each confirm-step checkbox and radio small and on the same line as its label at 1280 and 320 px, on the Backup page and on first run', async ({ profile }) => {
    test.setTimeout(240_000);
    const expectControlsBesideLabels = async (scope: Locator, label: string): Promise<void> => {
      const boxes = await scope.locator('input[type="checkbox"], input[type="radio"]').evaluateAll((inputs) =>
        inputs.map((input) => {
          const control = input.getBoundingClientRect();
          // The label's own text, not its whole box (which contains the control and so always overlaps it).
          const wrapper = input.closest('label');
          const lines: DOMRect[] = [];
          if (wrapper) {
            const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              if (!node.textContent?.trim()) continue;
              const range = document.createRange();
              range.selectNodeContents(node);
              lines.push(...Array.from(range.getClientRects()));
            }
          } else {
            const named = document.getElementById(input.getAttribute('aria-labelledby') ?? '');
            if (named) lines.push(named.getBoundingClientRect());
          }
          const textTop = lines.length > 0 ? Math.min(...lines.map((line) => line.top)) : 0;
          const textBottom = lines.length > 0 ? Math.max(...lines.map((line) => line.bottom)) : 0;
          return { name: (input as HTMLInputElement).type, width: control.width, top: control.top, bottom: control.bottom, textTop, textBottom };
        }),
      );
      expect(boxes.length, `${label}: controls found`).toBeGreaterThan(0);
      for (const box of boxes) {
        expect(box.width, `${label}: ${box.name} width`).toBeLessThanOrEqual(32);
        expect(Math.min(box.bottom, box.textBottom) - Math.max(box.top, box.textTop), `${label}: ${box.name} shares its label's line`).toBeGreaterThan(0);
      }
    };
    await seedJournal(profile);
    const saved = scratch('controls.tjbackup');
    const context = await launchAt(profile, MONDAY_1005);
    const page = await firstPage(context);
    await page.goto('/');
    await openBackup(page);
    await downloadBackup(page, saved);
    await chooseRestoreFile(page, saved);
    await page.getByRole('radio', { name: 'Replace without a backup' }).check();
    for (const width of [1280, 320]) {
      await setWidth(page, width);
      await expectControlsBesideLabels(confirmStep(page), `Backup page at ${width} px`);
    }
    await context.close();

    const fresh = await profileAt(`${profile.dir}-first-run`).launch();
    const first = await firstPage(fresh);
    await first.goto('/');
    await expect(first.getByRole('heading', { name: 'Start your journal' })).toBeVisible(READY);
    await first.getByRole('button', { name: 'Restore from a backup' }).click();
    await chooseRestoreFile(first, saved);
    for (const width of [1280, 320]) {
      await setWidth(first, width);
      await expectControlsBesideLabels(confirmStep(first), `first run at ${width} px`);
    }
    await fresh.close();
  });

  test('should complete a Restore with the keyboard only, every focused control showing a focus ring', async ({ profile }) => {
    await seedJournal(profile);
    const context = await launchAt(profile, MONDAY_1005);
    const page = await firstPage(context);
    await page.goto('/backup');
    await expect(page.getByRole('heading', { name: 'Backup', level: 1 })).toBeVisible(READY);

    await tabTo(page, page.getByRole('button', { name: 'Choose backup file' }));
    await chooseFile(page, () => page.keyboard.press('Enter'), FIXTURE_BACKUP);
    await expect(page.getByRole('heading', { name: 'Restoring replaces your entire current journal' })).toBeVisible(READY);
    await tabTo(page, understood(page));
    await page.keyboard.press('Space');
    await expect(understood(page)).toBeChecked();
    // The radio group takes one Tab stop; the arrow key moves to Replace without a backup and chooses it.
    await tabTo(page, page.getByRole('radio', { name: 'Back up this journal first (recommended)' }));
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio', { name: 'Replace without a backup' })).toBeChecked();
    await tabTo(page, page.getByRole('checkbox', { name: WARNING }));
    await page.keyboard.press('Space');
    await expect(page.getByRole('checkbox', { name: WARNING })).toBeChecked();
    await tabTo(page, replaceEntire(page));
    await page.keyboard.press('Enter');
    await expect(restoreComplete(page)).toBeVisible(READY);
    await tabTo(page, page.getByRole('link', { name: 'Go to Trades' }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tablist', { name: 'Trades by lifecycle' })).toBeVisible(READY);
    await context.close();
  });
});
