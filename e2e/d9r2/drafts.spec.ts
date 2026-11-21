import type { Locator, Page } from '@playwright/test';
import { chooseRestoreFile, FIXTURE_BACKUP, openBackup, restoreSection } from '../d8/support.ts';
import { createGapFixture, expect, observationsOf, OCT_12, OCT_8, OCT_9, probe, reachCard, reachPanel, READY, status, test, workspaceOf, type StoredObservation, type TradeRef } from './support.ts';

test.use({ actionTimeout: 15_000 });

const AUG_31 = 'Mon Aug 31';
const input = (marks: Locator, date: string): Locator => marks.getByRole('textbox', { name: `XYZ Mark, ${date}`, exact: true });
const headerButton = (page: Page, name: RegExp): Locator => status(page).getByRole('button', { name });

// Types a price into a cell of the card's grid, on whichever page of sessions it is.
async function type(page: Page, card: TradeRef, date: string, price: string): Promise<void> {
  const marks = await reachPanel(page, card, 'Marks');
  const turn = marks.getByRole('button', { name: date === AUG_31 ? 'Next page' : 'Previous page' });
  if ((await turn.count()) > 0) await turn.click();
  await input(marks, date).fill(price);
}

// The observations whose saved facts changed in the one commit: a save's keys share one store revision and one savedAt.
type Stored = StoredObservation & { revision: number };
const storedOf = async (page: Page): Promise<Stored[]> => observationsOf(workspaceOf(await probe(page))!) as Stored[];

test.describe('B9R2.3 Drafts belong to the Review', () => {
  test('should show a price typed in T-A as Unsaved in T-F, keep drafts across cards and pages, count them in the header and empty them all with Discard', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page, tA, tF } = await createGapFixture(profile);

    await test.step('a price typed in T-A shows Unsaved in T-F, which holds XYZ too (W73, W74)', async () => {
      await type(page, tA, OCT_12, '51.20');
      await expect(status(page)).toContainText('1 unsaved Mark');
      await expect(headerButton(page, /^Save Marks \(1\)$/)).toBeVisible();
      await expect(headerButton(page, /^Discard$/)).toBeVisible();
      const marksF = await reachPanel(page, tF, 'Marks');
      const mirrored = marksF.getByRole('button', { name: `XYZ Mark, ${OCT_12}`, exact: true });
      await expect(mirrored).toContainText('51.20');
      await expect(mirrored).toContainText('Unsaved');
      await expect(mirrored).toHaveAccessibleDescription('Typed in XYZ (Long 100 shares @ $50.10)');
      await expect(input(marksF, OCT_12)).toHaveCount(0);
      // Still one draft: the same key in two Trades.
      await expect(status(page)).toContainText('1 unsaved Mark');
    });

    await test.step('moving between cards and between pages keeps every draft, and the header counts them', async () => {
      await type(page, tA, OCT_9, '50.40');
      await expect(status(page)).toContainText('2 unsaved Marks');
      await type(page, tA, AUG_31, '48.00');
      await expect(status(page)).toContainText('3 unsaved Marks');
      const marks = await reachPanel(page, tA, 'Marks');
      // Page 2 holds Aug 31; page 1 holds the other two.
      await marks.getByRole('button', { name: 'Previous page' }).click();
      await expect(input(marks, OCT_9)).toHaveValue('50.40');
      await marks.getByRole('button', { name: 'Next page' }).click();
      await expect(input(marks, AUG_31)).toHaveValue('48.00');
      // Another card and back: the same.
      await reachCard(page, tF);
      await reachCard(page, tA);
      // The card opens on its first page again; its drafts are all there.
      const back = await reachPanel(page, tA, 'Marks');
      await expect(input(back, OCT_12)).toHaveValue('51.20');
      await expect(input(back, OCT_9)).toHaveValue('50.40');
      await back.getByRole('button', { name: 'Next page' }).click();
      await expect(input(back, AUG_31)).toHaveValue('48.00');
      await back.getByRole('button', { name: 'Previous page' }).click();
      await expect(status(page)).toContainText('3 unsaved Marks');
    });

    await test.step('pressing the mirrored cell in T-F moves the price to T-F (A293)', async () => {
      const marksF = await reachPanel(page, tF, 'Marks');
      await marksF.getByRole('button', { name: `XYZ Mark, ${OCT_12}`, exact: true }).click();
      await expect(input(marksF, OCT_12)).toHaveValue('51.20');
      await expect(input(marksF, OCT_12)).toBeFocused();
      const marksA = await reachPanel(page, tA, 'Marks');
      await expect(marksA.getByRole('button', { name: `XYZ Mark, ${OCT_12}`, exact: true })).toContainText('Unsaved');
      await expect(status(page)).toContainText('3 unsaved Marks');
    });

    await test.step('Discard empties every draft at once', async () => {
      await headerButton(page, /^Discard$/).click();
      await expect(status(page)).not.toContainText('unsaved Mark');
      const marksA = await reachPanel(page, tA, 'Marks');
      await expect(input(marksA, OCT_12)).toHaveValue('');
      await expect(input(marksA, OCT_9)).toHaveValue('');
      await expect(marksA.getByRole('button', { name: /^Save Marks/ })).toHaveText('Save Marks (0)');
      await marksA.getByRole('button', { name: 'Next page' }).click();
      await expect(input(marksA, AUG_31)).toHaveValue('');
      const marksF = await reachPanel(page, tF, 'Marks');
      await expect(input(marksF, OCT_12)).toHaveValue('');
    });
    await context.close();
  });

  test('should save every draft of every session in one Save Marks, one Mark for the key two Trades share', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page, tA, tF } = await createGapFixture(profile);
    const before = await storedOf(page);

    await type(page, tA, OCT_12, '51.20');
    await type(page, tA, OCT_9, '50.40');
    // A "Can't get a price" with its reason is a draft too: Thu Oct 8's.
    const marks = await reachPanel(page, tA, 'Marks');
    await input(marks, OCT_8).focus();
    await marks.getByRole('region', { name: `XYZ Mark, ${OCT_8}`, exact: true }).getByRole('button', { name: "Can't get a price" }).click();
    await marks.getByLabel('Reason (required)').fill('No quote that day');
    await type(page, tA, AUG_31, '48.00');
    await expect(status(page)).toContainText('4 unsaved Marks');

    await headerButton(page, /^Save Marks \(4\)$/).click();
    await expect(status(page)).not.toContainText('unsaved Mark', READY);

    const after = await storedOf(page);
    const changed = after.filter((o) => JSON.stringify(o) !== JSON.stringify(before.find((b) => b.tradingDate === o.tradingDate && b.instrumentKey === o.instrumentKey)));
    expect(changed.map((o) => o.tradingDate).sort()).toEqual(['2026-08-31', '2026-10-08', '2026-10-09', '2026-10-12']);
    const byDate = Object.fromEntries(changed.map((o) => [o.tradingDate, o]));
    expect(byDate['2026-10-12']!.marks.map((m) => m.price)).toEqual(['51.2']);
    expect(byDate['2026-10-09']!.marks.map((m) => m.price)).toEqual(['50.4']);
    expect(byDate['2026-08-31']!.marks.map((m) => m.price)).toEqual(['48']);
    expect(byDate['2026-10-08']!.acknowledgments.map((a) => a.reason)).toEqual(['No quote that day']);
    // One commit: the same store revision on every key. (The test clock is pinned, so the saved instants match whatever the number of saves.)
    expect(new Set(changed.map((o) => o.revision)).size).toBe(1);
    const savedAtOf = (fact: unknown): string => (fact as { savedAt: string }).savedAt;
    const savedAts = new Set(changed.flatMap((o) => [...o.marks.map(savedAtOf), ...o.acknowledgments.map(savedAtOf)]));
    expect(savedAts.size).toBe(1);

    // T-F holds XYZ too and shows the one Mark.
    const marksF = await reachPanel(page, tF, 'Marks');
    await expect(marksF.getByRole('button', { name: `XYZ Mark, ${OCT_12}`, exact: true })).toContainText('51.20');
    await context.close();
  });

  test('should hold leaving the page while a draft exists, and store nothing when the page is reloaded with drafts typed (AC-JOUR-001)', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page, tA } = await createGapFixture(profile);
    const before = JSON.stringify(workspaceOf(await probe(page)));
    await type(page, tA, OCT_12, '53.17');
    await type(page, tA, OCT_9, '52.83');
    await expect(status(page)).toContainText('2 unsaved Marks');

    // Another tab asks before it replaces the journal (the update and Restore both ask the open tabs): it is told this tab holds unsaved work.
    const other = await context.newPage();
    await other.goto('/');
    await openBackup(other);
    await chooseRestoreFile(other, FIXTURE_BACKUP);
    await expect(restoreSection(other).getByText('Another tab has unsaved changes. They will be lost when the journal is replaced.')).toBeVisible();
    await other.close();

    // A reload drops the drafts and stores none of them.
    await page.reload();
    await expect(status(page)).toBeVisible();
    await expect(status(page)).not.toContainText('unsaved Mark');
    const marks = await reachPanel(page, tA, 'Marks');
    await expect(input(marks, OCT_12)).toHaveValue('');
    await expect(input(marks, OCT_9)).toHaveValue('');
    const afterRaw = JSON.stringify(workspaceOf(await probe(page)));
    expect(afterRaw).toBe(before);
    for (const typed of ['53.17', '52.83']) expect(afterRaw).not.toContain(typed);
    const webStorage = JSON.stringify(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })));
    for (const typed of ['53.17', '52.83']) expect(webStorage).not.toContain(typed);
    await context.close();
  });
});
