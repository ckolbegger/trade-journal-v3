import type { Locator, Page } from '@playwright/test';
import { createGapFixture, detail, enterMark, expect, OCT_9, openDrawer, reachCard, READY, test, tradeCard } from './support.ts';

test.use({ actionTimeout: 15_000 });

const history = (page: Page): Locator => page.locator('#drawer-panel-price-history');
const journal = (page: Page): Locator => page.locator('#drawer-panel-journal');

// The colour a design token paints, as the browser computes it (a probe element, so the token's own format does not matter).
const tokenColour = (page: Page, token: string): Promise<string> =>
  page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, token);

test.describe('B9R2.1 Price History and Journal: acknowledged sessions', () => {
  test('should show an acknowledged session as Acknowledged Unavailable, count only Missing sessions on the tab, name both counts under the table, colour gains and losses, show the acknowledged Mark on a Journal card and head the Review card At the Fri Oct 9 Marks', async ({ profile }) => {
    test.setTimeout(300_000);
    // The gap fixture: Wed Oct 7 acknowledged, Tue Oct 6 Marked (a loss), and Fri Oct 9 Marked here (a gain).
    const { context, page, tA } = await createGapFixture(profile);
    await enterMark(page, tA, OCT_9, '50.50');

    await test.step('the Review card heading says Marks, not close (W79)', async () => {
      await reachCard(page, tA);
      await expect(tradeCard(page, tA).getByRole('group', { name: 'At the Fri Oct 9 Marks' })).toBeVisible();
      await expect(tradeCard(page, tA)).not.toContainText('Fri Oct 9 close');
    });

    await page.goto(`/trades/${tA.tradeId}`);
    await expect(detail.heading(page, 'XYZ')).toBeVisible(READY);

    await test.step('Price History: the acknowledged session is words, not a gap (W78); the line names both counts (W81); the tab counts Missing only', async () => {
      await openDrawer(page, 'Price History');
      const table = history(page).getByRole('table');
      // The header row's cells and the body row's line up, the row label being the first of each.
      const at = await table.locator('thead th').evaluateAll((heads, text) => heads.findIndex((head) => (head.textContent ?? '').includes(text)), 'Oct 7');
      const cell = table.locator('tbody tr').first().locator(`td:nth-child(${at + 1})`);
      await expect(cell).toHaveText('Acknowledged Unavailable');
      await expect(cell.getByRole('img', { name: 'No Mark' })).toHaveCount(0);
      // Missing sessions: every gap from Aug 31, Thu Oct 8 and the Review Date's session; Tue Oct 6 and Fri Oct 9 hold Marks, Wed Oct 7 is acknowledged.
      const missing = await table.locator('tbody tr').first().getByRole('img', { name: 'No Mark' }).count();
      expect(missing).toBeGreaterThan(20);
      await expect(history(page).locator('.price-history-gaps')).toHaveText(`${missing} sessions without Marks. 1 session acknowledged unavailable. Enter Marks in the Review`);
      await expect(page.getByRole('tab', { name: 'Price History', exact: true })).toHaveText(`Price History ${missing}`);
    });

    await test.step('gain and loss figures take the Target and Stop colours', async () => {
      const gain = history(page).locator('td.gain');
      const loss = history(page).locator('td.loss');
      await expect(gain).toHaveCount(1);
      await expect(loss).toHaveCount(1);
      const colourOf = (cell: Locator) => cell.evaluate((el) => getComputedStyle(el).color);
      expect(await colourOf(gain)).toBe(await tokenColour(page, '--target'));
      expect(await colourOf(loss)).toBe(await tokenColour(page, '--stop'));
      // The sign stays in the text, so colour is never the only cue.
      await expect(gain).toHaveText(/^\+?\$/);
      await expect(loss).toHaveText(/^[−-]\$/);
    });

    await test.step('a Journal card shows the acknowledged Mark', async () => {
      await openDrawer(page, 'Journal');
      const card = journal(page).locator('li:not([hidden]) > article.journal-card').filter({ hasText: 'Wed Oct 7' });
      // The cards are paged newest first: go back until the Wed Oct 7 session's card shows.
      for (let pages = 0; pages < 10 && (await card.count()) === 0; pages++) await journal(page).getByRole('button', { name: 'Earlier sessions' }).click();
      await expect(card).toHaveCount(1);
      await expect(card.getByText('XYZ Mark', { exact: true })).toBeVisible();
      await expect(card).toContainText('Acknowledged Unavailable');
      await expect(card.getByRole('img', { name: 'No Mark' })).toHaveCount(0);
    });
    await context.close();
  });
});
