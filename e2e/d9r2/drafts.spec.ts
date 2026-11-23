import type { Locator, Page } from '@playwright/test';
import { chooseRestoreFile, FIXTURE_BACKUP, openBackup, restoreSection } from '../d8/support.ts';
import { expectMarksSaved, marksPanelOf, marksStepOf, saveMarksButton, openGapFixture, expect, observationsOf, OCT_12, OCT_8, OCT_9, probe, reachCard, status, test, workspaceOf, type StoredObservation, type TradeRef } from './support.ts';

test.use({ actionTimeout: 15_000 });

const AUG_31 = 'Mon Aug 31';
const input = (marks: Locator, date: string): Locator => marks.getByRole('textbox', { name: `XYZ Mark, ${date}`, exact: true });

// Types a price into a cell of the card's grid, on whichever page of sessions it is.
async function type(page: Page, card: TradeRef, date: string, price: string): Promise<void> {
  const marks = await marksPanelOf(page, card);
  // The skipped sessions are columns only once asked for.
  const add = marks.getByRole('button', { name: 'Add the skipped sessions' });
  if (date !== OCT_12 && date !== OCT_9 && (await add.count()) > 0) await add.click();
  const turn = marks.getByRole('button', { name: date === AUG_31 ? 'Next page' : 'Previous page' });
  if ((await turn.count()) > 0) await turn.click();
  await input(marks, date).fill(price);
}

// The observations whose saved facts changed in the one commit: a save's keys share one store revision and one savedAt.
type Stored = StoredObservation & { revision: number };
const storedOf = async (page: Page): Promise<Stored[]> => observationsOf(workspaceOf(await probe(page))!) as Stored[];

test.describe('B9R2.3 Drafts belong to the Review', () => {
  test('should keep drafts across cards and pages, count them on Save Marks and empty them all with Discard', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page, tA, tF } = await openGapFixture(profile, copySetup);

    await test.step('a price typed once, for XYZ, which both Trades hold, is one draft', async () => {
      await type(page, tA, OCT_12, '51.20');
      await expect(saveMarksButton(page)).toHaveText('Save Marks (1)');
      await expect(marksStepOf(page).getByRole('button', { name: 'Discard' })).toBeVisible();
      // T-F holds XYZ too: the one row is the page's, whichever card is open.
      const marksF = await marksPanelOf(page, tF);
      await expect(input(marksF, OCT_12)).toHaveValue('51.20');
      await expect(input(marksF, OCT_12)).toHaveCount(1);
    });

    await test.step('moving between cards and between pages keeps every draft, and the header counts them', async () => {
      await type(page, tA, OCT_9, '50.40');
      await expect(saveMarksButton(page)).toHaveText('Save Marks (2)');
      await type(page, tA, AUG_31, '48.00');
      await expect(saveMarksButton(page)).toHaveText('Save Marks (3)');
      const marks = await marksPanelOf(page, tA);
      // Page 2 holds Aug 31; page 1 holds the other two.
      await marks.getByRole('button', { name: 'Previous page' }).click();
      await expect(input(marks, OCT_9)).toHaveValue('50.40');
      await marks.getByRole('button', { name: 'Next page' }).click();
      await expect(input(marks, AUG_31)).toHaveValue('48.00');
      // Another card and back: the same.
      await reachCard(page, tF);
      await reachCard(page, tA);
      // The Marks step is the page's, so it is on the page it was left on; its drafts are all there.
      const back = await marksPanelOf(page, tA);
      await expect(input(back, AUG_31)).toHaveValue('48.00');
      await back.getByRole('button', { name: 'Previous page' }).click();
      await expect(input(back, OCT_12)).toHaveValue('51.20');
      await expect(input(back, OCT_9)).toHaveValue('50.40');
      await expect(saveMarksButton(page)).toHaveText('Save Marks (3)');
    });

    await test.step('Discard empties every draft at once', async () => {
      await marksStepOf(page).getByRole('button', { name: 'Discard' }).click();
      const marksA = await marksPanelOf(page, tA);
      await expect(input(marksA, OCT_12)).toHaveValue('');
      await expect(input(marksA, OCT_9)).toHaveValue('');
      await expect(marksA.getByRole('button', { name: /^Save Marks/ })).toHaveText('Save Marks (0)');
      await marksA.getByRole('button', { name: 'Next page' }).click();
      await expect(input(marksA, AUG_31)).toHaveValue('');
      const marksF = await marksPanelOf(page, tF);
      await expect(input(marksF, OCT_12)).toHaveValue('');
    });
    await context.close();
  });

  test('should save every draft of every session in one Save Marks, one Mark for the key two Trades share', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page, tA, tF } = await openGapFixture(profile, copySetup);
    const before = await storedOf(page);

    await type(page, tA, OCT_12, '51.20');
    await type(page, tA, OCT_9, '50.40');
    // A "Can't get a price" with its reason is a draft too: Thu Oct 8's.
    const marks = await marksPanelOf(page, tA);
    await marks.getByRole('button', { name: 'Add the skipped sessions' }).click();
    await input(marks, OCT_8).focus();
    await marks.getByRole('region', { name: `XYZ Mark, ${OCT_8}`, exact: true }).getByRole('button', { name: "Can't get a price" }).click();
    await marks.getByLabel('Reason (required)').fill('No quote that day');
    await type(page, tA, AUG_31, '48.00');
    await expect(saveMarksButton(page)).toHaveText('Save Marks (4)');

    await saveMarksButton(page).click();
    await expectMarksSaved(page);

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
    const marksF = await marksPanelOf(page, tF);
    await expect(marksF.getByRole('textbox', { name: `XYZ Mark, ${OCT_12}`, exact: true })).toHaveValue('51.20');
    await context.close();
  });

  test('should hold leaving the page while a draft exists, and store nothing when the page is reloaded with drafts typed (AC-JOUR-001)', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page, tA } = await openGapFixture(profile, copySetup);
    const before = JSON.stringify(workspaceOf(await probe(page)));
    await type(page, tA, OCT_12, '53.17');
    await type(page, tA, OCT_9, '52.83');
    await expect(saveMarksButton(page)).toHaveText('Save Marks (2)');

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
    await expectMarksSaved(page);
    const marks = await marksPanelOf(page, tA);
    await expect(input(marks, OCT_12)).toHaveValue('');
    await expect(input(marks, OCT_9)).toHaveValue('');
    const afterRaw = JSON.stringify(workspaceOf(await probe(page)));
    expect(afterRaw).toBe(before);
    for (const typed of ['53.17', '52.83']) expect(afterRaw).not.toContain(typed);
    const webStorage = JSON.stringify(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })));
    for (const typed of ['53.17', '52.83']) expect(webStorage).not.toContain(typed);
    await context.close();
  });

  test('should ask before a route change while a draft exists, stay on Cancel, leave on OK, and mark the page for the browser prompt (T9R2.17-B9)', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page, tA } = await openGapFixture(profile, copySetup);
    await type(page, tA, OCT_12, '53.17');
    await expect(saveMarksButton(page)).toHaveText('Save Marks (1)');
    const asked: string[] = [];
    let answer = false;
    page.on('dialog', (dialog) => {
      asked.push(dialog.message());
      void (answer ? dialog.accept() : dialog.dismiss());
    });
    const trades = page.getByRole('navigation').getByRole('link', { name: 'Trades' });

    await trades.click();
    await expect.poll(() => asked.length).toBe(1);
    await expect(saveMarksButton(page)).toHaveText('Save Marks (1)');
    expect(new URL(page.url()).pathname).not.toBe('/');

    // A reload or tab close shows the browser's own prompt: the page cancels the unload event.
    expect(await page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true })))).toBe(true);

    answer = true;
    await trades.click();
    await expect.poll(() => asked.length).toBe(2);
    await expect.poll(() => new URL(page.url()).pathname).toBe('/');
    await context.close();
  });

  test('should raise the browser leave prompt on a real page close while a draft exists, keep the page on dismiss, close on accept, and raise none without a draft (T9R2.17-B11)', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page, tA } = await openGapFixture(profile, copySetup);
    await type(page, tA, OCT_12, '53.17');
    await expect(saveMarksButton(page)).toHaveText('Save Marks (1)');
    const reviewUrl = page.url();
    const prompts: string[] = [];
    let accept = false;
    page.on('dialog', (dialog) => {
      prompts.push(dialog.type());
      void (accept ? dialog.accept() : dialog.dismiss());
    });

    // Dismissing the browser's prompt keeps the page and the typed draft.
    await page.close({ runBeforeUnload: true });
    await expect.poll(() => prompts).toEqual(['beforeunload']);
    expect(page.isClosed()).toBe(false);
    await expect(saveMarksButton(page)).toHaveText('Save Marks (1)');
    await expect(input(await marksPanelOf(page, tA), OCT_12)).toHaveValue('53.17');

    // A real reload meets the same prompt; accepting it drops the draft.
    accept = true;
    await page.reload();
    expect(prompts).toEqual(['beforeunload', 'beforeunload']);
    await expectMarksSaved(page);

    // Typed again, a page close accepted at the prompt leaves.
    await type(page, tA, OCT_12, '53.17');
    await expect(saveMarksButton(page)).toHaveText('Save Marks (1)');
    await page.close({ runBeforeUnload: true });
    await expect.poll(() => page.isClosed()).toBe(true);
    expect(prompts).toEqual(['beforeunload', 'beforeunload', 'beforeunload']);

    // With nothing unsaved there is no prompt.
    const clean = await context.newPage();
    const cleanPrompts: string[] = [];
    clean.on('dialog', (dialog) => {
      cleanPrompts.push(dialog.type());
      void dialog.dismiss();
    });
    await clean.goto(reviewUrl);
    await expect(status(clean)).toBeVisible();
    await clean.click('body');
    await clean.close({ runBeforeUnload: true });
    await expect.poll(() => clean.isClosed()).toBe(true);
    expect(cleanPrompts).toEqual([]);
    await context.close();
  });
});
