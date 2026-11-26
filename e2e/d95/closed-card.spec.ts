import type { Locator, Page } from '@playwright/test';
import { closeReasonGroup, enterMark, expect, fillRows, openReview, reachPanel, saveAction, sell, test } from '../d6/support.ts';
import { expectNoSidewaysScroll } from '../d7p/support.ts';
import { atBothWidths, openAbcDef } from './support.ts';

test.use({ actionTimeout: 15_000 });

const GROUP = 'Trades with owed reflections';
const planOf = (card: Locator): Locator => card.getByRole('table', { name: 'Plan and what happened' });
const cell = (card: Locator, row: string, column: 'Plan' | 'What happened'): Locator => planOf(card).getByRole('row').filter({ has: card.page().getByRole('rowheader', { name: row, exact: true }) }).getByRole('cell').nth(column === 'Plan' ? 0 : 1);

// Closes ABC with a sale of the whole Position at the Stop in the Review, and comes back to the Review with the closed card in the owed group.
async function closeAbc(page: Page): Promise<void> {
  await openReview(page);
  await enterMark(page, 'ABC', 'Mon Oct 12', '27.50');
  await saveAction(page, 'Exit', undefined, 'ABC');
  const panel = await reachPanel(page, 'ABC', 'Action');
  await panel.getByRole('button', { name: 'Record the sale', exact: true }).click();
  await fillRows(page, [sell('100', '27.60', '1.00', '2026-10-12T11:00')]);
  await closeReasonGroup(page).getByRole('radio', { name: 'Stop Triggered', exact: true }).check();
  await page.locator('form.plan-form').getByRole('button', { name: 'Save exit' }).click();
  await expect(page.getByText('Recorded. ABC is closed. Its Close Review is due in the next Review.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to the Review' }).click();
}

test.describe('B95.58 The closed card (W103, W150, W151)', () => {
  test('should say how ABC ended, set the Plan beside what happened, label the Close Review and stack the two columns at 375 wide', async ({ profile, copySetup }) => {
    test.setTimeout(120_000);
    const { context, page, ids } = await openAbcDef(profile, copySetup);
    await closeAbc(page);
    await atBothWidths(page, async (width) => {
      const where = `at ${width}`;
      await expect(page.getByRole('heading', { name: GROUP, level: 2 }), `the group ${where}`).toBeVisible();
      const card = page.getByRole('list', { name: GROUP }).locator(`li.review-card[data-trade-id="${ids.ABC}"]`);
      const header = card.getByRole('button', { name: /^Review ABC/ });
      await expect(header, `labelled by its Close Review ${where}`).toContainText('Close Review · next Review');
      if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
      await expect(card.getByText('How it ended: sold all 100 shares, Mon Oct 12. Stop Triggered.', { exact: true }), `how it ended ${where}`).toBeVisible();
      await expect(card.getByText('Lifecycle', { exact: true }), `no Lifecycle ${where}`).toHaveCount(0);
      await expect(card.getByText('Terminal Disposition', { exact: true }), `no Terminal Disposition ${where}`).toHaveCount(0);
      await expect(cell(card, 'Entry', 'Plan')).toHaveText('100 shares at $30.00');
      await expect(cell(card, 'Entry', 'What happened')).toHaveText('Bought 100 at $30.00, Mon Oct 12');
      await expect(cell(card, 'Stop', 'Plan')).toHaveText('$28.00');
      await expect(cell(card, 'Target', 'Plan')).toHaveText('$36.00');
      await expect(cell(card, 'Exit', 'What happened')).toHaveText('Sold 100 at $27.60, Mon Oct 12');
      await expect(cell(card, 'Result', 'What happened')).toHaveText('−$242.00 · −1.21R');
      await expect(card.getByRole('button', { name: 'Write the Close Review' })).toBeVisible();
      await expect(card.getByText('Not due until the next Review.', { exact: true })).toBeVisible();
      await expectNoSidewaysScroll(page, `the closed card ${where}`);      // The same information, side by side when wide and one above the other at 375.
      const plan = (await cell(card, 'Entry', 'Plan').boundingBox())!;
      const happened = (await cell(card, 'Entry', 'What happened').boundingBox())!;
      if (width === 375) {
        expect(happened.y, 'what happened sits below the Plan at 375').toBeGreaterThan(plan.y + plan.height - 1);
        expect(Math.abs(happened.x - plan.x), 'both start at the same left edge at 375').toBeLessThan(130);
      } else {
        expect(Math.abs(happened.y - plan.y), 'the two columns share a row at 1280').toBeLessThan(4);
        expect(happened.x, 'what happened is to the right of the Plan at 1280').toBeGreaterThan(plan.x + plan.width - 1);
      }
    });
    await context.close();
  });
});
