import { completeLine, downloadBackup, expect, firstPage, launchAt, MONDAY_1005, openBackup, probe, LAUNCH, scratch, seedJournal, test, verifyWith } from './support.ts';

test.use({ actionTimeout: 15_000 });

const READ_ONLY = { name: "Read only: this browser can't save right now" };
const SEPARATE_STORAGE =
  'Another browser has its own separate storage and would start an empty journal. To move this journal, download a backup here and verify it, then restore it in a browser that can save safely.';

// B8.8 (faults build, AC-DEL-005): the journal has data; the shell fails its checks singly (control) and then together (diagnostic and capacity).
test.describe('B8.8 Recovery Only backup', () => {
  test('should list Backup in the navigation with the A143 copy, complete a download and verification, offer Restore only as needs a browser that can save safely, and leave the probe unchanged', async ({ profile }) => {
    await seedJournal(profile);
    const context = await launchAt(profile, MONDAY_1005);
    const page = await firstPage(context);
    let before: Awaited<ReturnType<typeof probe>> | undefined;
    for (const faults of ['control', 'diagnostic,capacity']) {
      await page.goto(`/?faults=${faults}`);
      const banner = page.getByRole('region', READ_ONLY);
      await expect(banner).toBeVisible(LAUNCH);
      await expect(banner).toContainText(SEPARATE_STORAGE);
      await openBackup(page);
      before ??= await probe(page);

      const saved = scratch(`recovery-${faults.replace(',', '-')}.tjbackup`);
      await downloadBackup(page, saved);
      await verifyWith(page, saved);
      await expect(completeLine(page)).toBeVisible(LAUNCH);
      await expect(page.getByRole('heading', { name: 'Restore needs a browser that can save safely' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Choose backup file' })).toHaveCount(0);
      expect(await probe(page)).toEqual(before);
    }
    await context.close();
  });
});
