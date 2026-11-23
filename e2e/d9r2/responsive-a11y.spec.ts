import type { Locator } from '@playwright/test';
import { expectNoSidewaysScroll, setWidth } from '../d7p/support.ts';
import { marksPanelOf, copyGapFixture, openGapFixture, expect, expectMarksSaved, expectAccessible, firstPage, launchTouchAt, MONDAY_1700, observationsOf, OCT_12, OCT_7, OCT_8, OCT_9, openReview, probe, saveMarksButton, tabTo, test, workspaceOf } from './support.ts';

test.use({ actionTimeout: 15_000 });

const grid = (marks: Locator): Locator => marks.getByRole('region', { name: 'Marks by session' });
const input = (marks: Locator, date: string): Locator => marks.getByRole('textbox', { name: `XYZ Mark, ${date}`, exact: true });

// Types a price into the Marks step's cell, opening the cell's editor where it has one (a focused input is the chosen cell, P160).
async function typeIn(marks: Locator, date: string, price: string): Promise<void> {
  await input(marks, date).fill(price);
}

test.describe('B9R2.5 Responsive and accessible', () => {
  test('should keep drafts, the chosen cell and the focus through a live resize, show no sideways scroll at 390 px and report no WCAG 2.1 AA violations in each state', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page, tA } = await openGapFixture(profile, copySetup);

    // Wide: every kind of cell (inputs, an acknowledged press), with a draft and an open editor.
    const marks = await marksPanelOf(page, tA);
    await marks.getByRole('button', { name: 'Add the skipped sessions' }).click();
    await typeIn(marks, OCT_12, '51.20');
    await typeIn(marks, OCT_9, '50.40');
    await expect(marks.getByRole('region', { name: `XYZ Mark, ${OCT_9}`, exact: true })).toBeVisible();
    await expectAccessible(page, 'Marks step wide: drafts held, the Fri Oct 9 editor open, an acknowledged cell');
    await marks.getByRole('button', { name: 'Next page' }).click();
    await expectAccessible(page, 'Marks step wide, second page of sessions');
    await marks.getByRole('button', { name: 'Previous page' }).click();

    // The 40rem edge: the rows stack below it, and nothing is lost on the way.
    await setWidth(page, 900);
    await input(marks, OCT_9).focus();
    for (const width of [700, 390]) {
      await setWidth(page, width);
      await expect(input(marks, OCT_12)).toHaveValue('51.20');
      await expect(input(marks, OCT_9)).toHaveValue('50.40');
      await expect(input(marks, OCT_9)).toBeFocused();
      await expect(marks.getByRole('region', { name: `XYZ Mark, ${OCT_9}`, exact: true })).toBeVisible();
      await expect(saveMarksButton(page)).toHaveText('Save Marks (2)');
    }
    await expectNoSidewaysScroll(page, 'Review, Marks step at 390 px');
    const overflow = await grid(marks).evaluate((region) => region.scrollWidth - region.clientWidth);
    expect(overflow, "the Marks step's grid scrolls sideways at 390 px").toBeLessThanOrEqual(1);
    await expectAccessible(page, 'Marks step at 390 px: drafts held, an open editor');

    // Back to wide with the focus in the Fri Oct 9 cell: the same drafts, the same chosen cell, the focus kept.
    await setWidth(page, 1280);
    await expect(input(marks, OCT_12)).toHaveValue('51.20');
    await expect(input(marks, OCT_9)).toHaveValue('50.40');
    await expect(input(marks, OCT_9)).toBeFocused();
    await expect(marks.getByRole('region', { name: `XYZ Mark, ${OCT_9}`, exact: true })).toBeVisible();
    await expect(saveMarksButton(page)).toHaveText('Save Marks (2)');
    await context.close();
  });

  for (const width of [390, 375, 320]) {
    test(`should fit the Marks step at ${width} px with no sideways scroll, no clipped text and 44 px cells on a touch screen`, async ({ profile, copySetup }) => {
      test.setTimeout(300_000);
      const { tA } = await copyGapFixture(copySetup);
      const context = await launchTouchAt(profile, MONDAY_1700, width);
      const page = await firstPage(context);
      await page.goto('/');
      await openReview(page);
      const marks = await marksPanelOf(page, tA);
      await marks.getByRole('button', { name: 'Add the skipped sessions' }).click();
      // Choose the acknowledged cell: its pressed state must not clip or shrink it either.
      await marks.getByRole('button', { name: `XYZ Mark, ${OCT_7}`, exact: true }).click();
      const measure = () =>
        grid(marks).evaluate((region) => ({
          overflow: region.scrollWidth - region.clientWidth,
          // The column headers are read by assistive technology and not drawn below 40rem, so only the rows are measured.
          clipped: [...region.querySelectorAll<HTMLElement>('tbody th, tbody td, tbody button, tbody input')].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)),
          short: [...region.querySelectorAll<HTMLElement>('tbody td, tbody td button, tbody td input')].filter((el) => el.getBoundingClientRect().height < 44).map((el) => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)),
        }));
      const result = await measure();
      expect(result.overflow, `the grid region scrolls sideways at ${width} px`).toBeLessThanOrEqual(1);
      expect(result.clipped, `text clipped at ${width} px`).toEqual([]);
      expect(result.short, `cells under 44 px at ${width} px`).toEqual([]);
      await expectNoSidewaysScroll(page, `Review, Marks step at ${width} px`);
      await expectAccessible(page, `Marks step on a touch screen at ${width} px`);
      await context.close();
    });
  }

  test('should take the whole flow by keyboard: choose a cell, type, Enter through the cells, add the skipped sessions, press an acknowledged cell and save, with a visible focus ring', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page, tA } = await openGapFixture(profile, copySetup);
    const marks = await marksPanelOf(page, tA);

    // Tab to the Review Date cell, type, Enter to the previous session's cell, type again.
    await tabTo(page, input(marks, OCT_12));
    await page.keyboard.type('51.20');
    await page.keyboard.press('Enter');
    await expect(input(marks, OCT_9)).toBeFocused();
    await page.keyboard.type('50.40');
    await expect(marks.getByRole('region', { name: `XYZ Mark, ${OCT_9}`, exact: true })).toBeVisible();
    // The skipped sessions are added with the keyboard too, and the focus goes to the first of them.
    await tabTo(page, marks.getByRole('button', { name: 'Add the skipped sessions' }));
    await page.keyboard.press('Enter');
    await expect(input(marks, OCT_8)).toBeFocused();
    // An acknowledged cell is a button: Shift+Tab reaches it (the columns run oldest to newest), Enter chooses it and opens its editor.
    const acknowledged = marks.getByRole('button', { name: `XYZ Mark, ${OCT_7}`, exact: true });
    await page.keyboard.press('Shift+Tab');
    await expect(acknowledged).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(acknowledged).toHaveAttribute('aria-pressed', 'true');
    await expect(marks.getByRole('region', { name: `XYZ Mark, ${OCT_7}`, exact: true })).toBeVisible();
    await expectAccessible(page, 'Marks step by keyboard: the acknowledged cell chosen, drafts held');
    // Tab on to Save Marks and press it.
    await tabTo(page, saveMarksButton(page));
    await page.keyboard.press('Enter');
    await expectMarksSaved(page);
    const saved = observationsOf(workspaceOf(await probe(page))!).filter((o) => o.marks.some((m) => m.price === '51.2' || m.price === '50.4'));
    expect(saved.map((o) => o.tradingDate).sort()).toEqual(['2026-10-09', '2026-10-12']);
    await context.close();
  });
});
