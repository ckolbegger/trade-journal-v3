import type { Locator } from '@playwright/test';
import { expectNoSidewaysScroll, setWidth } from '../d7p/support.ts';
import { marksPanelOf, createGapFixture, expect, expectAccessible, firstPage, launchTouchAt, MONDAY_1700, observationsOf, OCT_12, OCT_7, OCT_9, openReview, probe, status, tabTo, test, tradeCard, workspaceOf, cardHeader } from './support.ts';

test.use({ actionTimeout: 15_000 });

const grid = (marks: Locator): Locator => marks.getByRole('region', { name: 'Marks by session' });
const input = (marks: Locator, date: string): Locator => marks.getByRole('textbox', { name: `XYZ Mark, ${date}`, exact: true });

// Types a price into the card's cell, opening the cell's editor (a focused input is the chosen cell, P160).
async function typeIn(marks: Locator, date: string, price: string): Promise<void> {
  await input(marks, date).fill(price);
}

test.describe('B9R2.5 Responsive and accessible', () => {
  test('should turn the grid below 40rem, keep drafts, the chosen cell and the focus through a live resize, show no sideways scroll at 390 px and report no WCAG 2.1 AA violations in each state', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page, tA, tF } = await createGapFixture(profile);
    const turned = (marks: Locator): Locator => grid(marks).locator('table[data-layout="turned"]');

    // Wide: every kind of cell (inputs, an acknowledged press, a mirrored Unsaved press, Not held), with a draft and an open editor.
    let marks = await marksPanelOf(page, tA);
    await typeIn(marks, OCT_12, '51.20');
    await typeIn(marks, OCT_9, '50.40');
    await expect(marks.getByRole('region', { name: `XYZ Mark, ${OCT_9}`, exact: true })).toBeVisible();
    await expect(turned(marks)).toHaveCount(0);
    await expectAccessible(page, 'T-A grid wide: drafts held, the Fri Oct 9 editor open, an acknowledged cell');
    await marks.getByRole('button', { name: 'Next page' }).click();
    await expectAccessible(page, 'T-A grid wide, second page of sessions');
    await marks.getByRole('button', { name: 'Previous page' }).click();
    const marksF = await marksPanelOf(page, tF);
    await expect(marksF.getByRole('button', { name: `XYZ Mark, ${OCT_12}`, exact: true })).toContainText('Unsaved');
    await expect(grid(marksF).getByRole('img', { name: 'Not held' })).toHaveCount(1);
    await expectAccessible(page, 'T-F grid wide: a mirrored Unsaved cell and a Not held cell');
    marks = await marksPanelOf(page, tA);

    // The 40rem edge: wide at 900 px, turned at 700 px (the card's own width decides), turned at 390 px.
    await setWidth(page, 900);
    await expect(turned(marks)).toHaveCount(0);
    await input(marks, OCT_9).focus();
    await setWidth(page, 700);
    await expect(turned(marks)).toHaveCount(1);
    await setWidth(page, 390);
    await expect(turned(marks)).toHaveCount(1);
    // Turned: sessions down the side, one column per row label, the same cells and names.
    await expect(grid(marks).locator('thead th')).toHaveText(['Session', 'XYZ Mark']);
    await expect(grid(marks).locator('tbody th[data-session]').first()).toHaveAttribute('data-session', '2026-10-12');
    await expect(input(marks, OCT_12)).toHaveValue('51.20');
    await expect(input(marks, OCT_9)).toHaveValue('50.40');
    await expect(input(marks, OCT_9)).toBeFocused();
    await expect(marks.getByRole('region', { name: `XYZ Mark, ${OCT_9}`, exact: true })).toBeVisible();
    await expect(marks.getByRole('button', { name: /^Save Marks/ })).toHaveText('Save Marks (2)');
    await expect(status(page)).toContainText('2 unsaved Marks');
    // A one-leg Trade fits: the page does not scroll sideways, and T-F's grid (one input and one Not held cell, its Review Date cell showing a
    // mirrored Unsaved draft) does not either inside its own region.
    await expectNoSidewaysScroll(page, 'Review, T-A grid turned at 390 px');
    const marksOfF = await marksPanelOf(page, tF);
    await expectNoSidewaysScroll(page, 'Review, T-F grid turned at 390 px');
    const overflow = await grid(marksOfF).evaluate((region) => region.scrollWidth - region.clientWidth);
    expect(overflow, "T-F's grid region scrolls sideways at 390 px").toBeLessThanOrEqual(1);
    marks = await marksPanelOf(page, tA);
    await expectAccessible(page, 'T-A grid turned at 390 px: drafts held, an open editor');

    // Back to wide with the focus in the Fri Oct 9 cell: the same drafts, the same chosen cell, the focus kept.
    await input(marks, OCT_9).focus();
    await setWidth(page, 1280);
    await expect(turned(marks)).toHaveCount(0);
    await expect(input(marks, OCT_12)).toHaveValue('51.20');
    await expect(input(marks, OCT_9)).toHaveValue('50.40');
    await expect(input(marks, OCT_9)).toBeFocused();
    await expect(marks.getByRole('region', { name: `XYZ Mark, ${OCT_9}`, exact: true })).toBeVisible();
    await expect(status(page)).toContainText('2 unsaved Marks');
    await context.close();
  });

  test('should give every cell at least 44 px of height on a touch screen, at 390 px', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context: setup, tA, tF } = await createGapFixture(profile);
    await setup.close();
    const context = await launchTouchAt(profile, MONDAY_1700, 390);
    const page = await firstPage(context);
    await page.goto('/');
    await openReview(page);

    const heights = async (marks: Locator): Promise<number[]> => {
      const cells = grid(marks).locator('tbody td');
      const boxes = await cells.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
      return boxes;
    };
    // T-A: inputs, an acknowledged press, and (after a draft in T-F's key) the rest.
    const marksA = await marksPanelOf(page, tA);
    await expect(grid(marksA).locator('table[data-layout="turned"]')).toHaveCount(1);
    const a = await heights(marksA);
    expect(a.length).toBeGreaterThan(10);
    for (const height of a) expect(height, 'a T-A cell on touch').toBeGreaterThanOrEqual(44);
    await expectNoSidewaysScroll(page, 'Review on touch at 390 px');
    await expectAccessible(page, 'T-A grid on a touch screen at 390 px');
    await typeIn(marksA, OCT_12, '51.20');
    // T-F: a mirrored Unsaved press and a Not held cell.
    const marksF = await marksPanelOf(page, tF);
    await expect(marksF.getByRole('button', { name: `XYZ Mark, ${OCT_12}`, exact: true })).toContainText('Unsaved');
    await expect(grid(marksF).getByRole('img', { name: 'Not held' })).toHaveCount(1);
    for (const height of await heights(marksF)) expect(height, 'a T-F cell on touch').toBeGreaterThanOrEqual(44);
    await expectAccessible(page, 'T-F grid on a touch screen: a mirrored Unsaved cell and a Not held cell');
    await context.close();
  });

  for (const width of [390, 375, 320]) {
    test(`should fit a one-leg Trade's grid at ${width} px with no sideways scroll, no clipped text and 44 px cells on a touch screen`, async ({ profile }) => {
      test.setTimeout(300_000);
      const { context: setup, tA } = await createGapFixture(profile);
      await setup.close();
      const context = await launchTouchAt(profile, MONDAY_1700, width);
      const page = await firstPage(context);
      await page.goto('/');
      await openReview(page);
      const marks = await marksPanelOf(page, tA);
      await expect(grid(marks).locator('table[data-layout="turned"]')).toHaveCount(1);
      // Choose the acknowledged cell: its pressed state must not clip or shrink it either.
      await marks.getByRole('button', { name: `XYZ Mark, ${OCT_7}`, exact: true }).click();
      const measure = () =>
        grid(marks).evaluate((region) => ({
          overflow: region.scrollWidth - region.clientWidth,
          clipped: [...region.querySelectorAll<HTMLElement>('th, td, button, input')].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)),
          short: [...region.querySelectorAll<HTMLElement>('tbody td, tbody td button, tbody td input')].filter((el) => el.getBoundingClientRect().height < 44).map((el) => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)),
        }));
      const result = await measure();
      expect(result.overflow, `the grid region scrolls sideways at ${width} px`).toBeLessThanOrEqual(1);
      expect(result.clipped, `text clipped at ${width} px`).toEqual([]);
      expect(result.short, `cells under 44 px at ${width} px`).toEqual([]);
      await expectNoSidewaysScroll(page, `Review, T-A grid at ${width} px`);
      await context.close();
    });
  }

  test('should take the whole flow by keyboard: open a card, choose a cell, type, Enter through the cells, press an acknowledged cell and save, with a visible focus ring', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page, tA } = await createGapFixture(profile);
    await cardHeader(page, tA).focus();
    await page.keyboard.press('Enter');
    await expect(cardHeader(page, tA)).toHaveAttribute('aria-expanded', 'true');
    const marks = tradeCard(page, tA);
    await expect(marks).toBeVisible();

    // Tab to the Review Date cell, type, Enter to the previous session's cell, type again.
    await tabTo(page, input(marks, OCT_12));
    await page.keyboard.type('51.20');
    await page.keyboard.press('Enter');
    await expect(input(marks, OCT_9)).toBeFocused();
    await page.keyboard.type('50.40');
    await expect(marks.getByRole('region', { name: `XYZ Mark, ${OCT_9}`, exact: true })).toBeVisible();
    // An acknowledged cell is a button: Tab reaches it, Enter chooses it and opens its editor.
    const acknowledged = marks.getByRole('button', { name: `XYZ Mark, ${OCT_7}`, exact: true });
    await tabTo(page, acknowledged);
    await page.keyboard.press('Enter');
    await expect(acknowledged).toHaveAttribute('aria-pressed', 'true');
    await expect(marks.getByRole('region', { name: `XYZ Mark, ${OCT_7}`, exact: true })).toBeVisible();
    await expectAccessible(page, 'T-A grid by keyboard: the acknowledged cell chosen, drafts held');
    // Tab on to Save Marks and press it.
    await tabTo(page, marks.getByRole('button', { name: 'Save Marks (2)' }));
    await page.keyboard.press('Enter');
    await expect(tradeCard(page, tA).locator('section[aria-label="Marks"] button', { hasText: /^Save Marks/ })).toHaveText('Save Marks (0)');
    const saved = observationsOf(workspaceOf(await probe(page))!).filter((o) => o.marks.some((m) => m.price === '51.2' || m.price === '50.4'));
    expect(saved.map((o) => o.tradingDate).sort()).toEqual(['2026-10-09', '2026-10-12']);
    await context.close();
  });

  // T9R2.17-B7 (C9R2.1): fill, page once, save once, all by keyboard. The pager is a Tab stop after the last cell's editor, and Shift+Tab returns to it.
  test('should fill, page once and save once by keyboard, reaching Next page by Tab through the cells and Save Marks by Tab from the last cell on the page', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page, tA } = await createGapFixture(profile);
    await cardHeader(page, tA).focus();
    await page.keyboard.press('Enter');
    await expect(cardHeader(page, tA)).toHaveAttribute('aria-expanded', 'true');
    const marks = tradeCard(page, tA);
    await expect(marks).toBeVisible();

    await tabTo(page, input(marks, OCT_12));
    await page.keyboard.type('51.20');
    // Tab on through every cell and its editor: the pager is reached before Save Marks.
    const next = marks.getByRole('button', { name: 'Next page' });
    await tabTo(page, next);
    await page.keyboard.press('Enter');
    // The last page has no Next page, so focus goes to Previous page; Shift+Tab goes back to the last cell, the oldest session.
    await expect(marks.getByRole('button', { name: 'Previous page' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(input(marks, 'Mon Aug 31')).toBeFocused();
    await page.keyboard.type('50.10');
    // Tab from the last cell goes through its editor to Previous page, and on to Save Marks; Shift+Tab from Save Marks returns to Previous page.
    await tabTo(page, marks.getByRole('button', { name: 'Previous page' }));
    await page.keyboard.press('Tab');
    await expect(marks.getByRole('button', { name: 'Save Marks (2)' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(marks.getByRole('button', { name: 'Previous page' })).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(tradeCard(page, tA).locator('section[aria-label="Marks"] button', { hasText: /^Save Marks/ })).toHaveText('Save Marks (0)');
    const saved = observationsOf(workspaceOf(await probe(page))!).filter((o) => o.marks.some((m) => m.price === '51.2' || m.price === '50.1'));
    expect(saved.map((o) => o.tradingDate).sort()).toEqual(['2026-08-31', '2026-10-12']);
    await context.close();
  });
});
