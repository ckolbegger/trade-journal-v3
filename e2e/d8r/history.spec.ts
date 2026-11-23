import type { Locator, Page } from '@playwright/test';
import { buildOc3, CORRECTION_REASON, detail, expect, fillDebtAnswers, openDetailAt, openDrawer, test, THURSDAY_1800 } from './support.ts';

test.use({ actionTimeout: 15_000 });

// B8R.6 (plan section 7.2): O-C3 with Wednesday's XYZ Mark corrected (57.40 to 57.45, saved at 17:00 with a reason), clock Thu 10-15 18:00. W33: each Price History
// Mark cell carries its provenance in its accessible name and hover text, and a corrected Mark adds "Corrected: <reason>". W27: each Journal entry is one dated line,
// with "· written Thu Oct 15" when it was written later. Paging the Journal by keyboard keeps focus on a paging button (tech debt item 24, fixed by T8R.16;
// its own case in e2e/d8p/history.spec.ts was removed as a duplicate of this step).
const journal = (page: Page): Locator => page.locator('#drawer-panel-journal');
const earlier = (page: Page): Locator => journal(page).getByRole('button', { name: 'Earlier sessions' });
const newer = (page: Page): Locator => journal(page).getByRole('button', { name: 'Newer sessions' });
const card = (page: Page, heading: RegExp): Locator => journal(page).locator('article.journal-card').filter({ hasText: heading });

test.describe('B8R.6 Journal and Price History', () => {
  test('should show each Mark cell with its provenance and the corrected one with its reason, then one dated line per Journal entry, paged by keyboard with focus kept on a paging button', async ({ profile }) => {
    test.setTimeout(540_000);
    const trade = await buildOc3(profile, { thursdayHold: true, correctedWednesdayXyz: '57.45' });
    const { context, page } = await openDetailAt(profile, THURSDAY_1800, trade);

    await test.step('Price History (W33): "Manual · saved 2026-10-14 17:00", then "Corrected: <reason>" on the corrected Mark', async () => {
      await openDrawer(page, 'Price History');
      const table = page.locator('#drawer-panel-price-history table.price-history');
      const wednesdayXyz = table.locator('tbody tr').nth(0).locator('td').nth(1);
      await expect(wednesdayXyz).toContainText('57.45');
      await expect(wednesdayXyz).toContainText('Corrected');
      await expect(wednesdayXyz).toHaveAttribute('title', new RegExp(`^Manual · saved 2026-10-14 17:00\\b.*Corrected: ${CORRECTION_REASON}$`));
      await expect(table.getByRole('cell', { name: new RegExp(`^57\\.45\\. Manual · saved 2026-10-14 17:00\\b.*Corrected: ${CORRECTION_REASON}$`) })).toHaveCount(1);
      // The uncorrected cells carry the provenance alone, and nothing is a tab stop.
      const thursdayXyz = table.locator('tbody tr').nth(0).locator('td').nth(0);
      await expect(thursdayXyz).toHaveAttribute('title', 'Manual · saved 2026-10-15 17:00');
      await expect(table.getByRole('cell', { name: '57.90. Manual · saved 2026-10-15 17:00' })).toHaveCount(1);
      await expect(table.locator('tbody td[tabindex]')).toHaveCount(0);
      // Tuesday had no Marks, so its cells have no provenance.
      await expect(table.locator('tbody tr').nth(0).locator('td').nth(2)).not.toHaveAttribute('title');
    });

    await test.step('Journal (W27): one dated line per entry, with "· written Thu Oct 15" once a reflection is answered later', async () => {
      await openDrawer(page, 'Journal');
      await expect(card(page, /^\s*Today, Thu Oct 15/)).toContainText('Daily Review · Thu Oct 15, 4:00 pm');
      await expect(card(page, /^\s*Today, Thu Oct 15/)).not.toContainText('· written');
      const wednesday = card(page, /^\s*Yesterday, Wed Oct 14/);
      await wednesday.getByRole('button', { name: 'Reflect now' }).click();
      await fillDebtAnswers(page);
      await wednesday.getByRole('form', { name: 'Reflection' }).getByRole('button', { name: 'Answer', exact: true }).click();
      await expect(wednesday.getByRole('region', { name: 'Saved reflection' })).toBeVisible();
      await expect(wednesday).toContainText('Position Change · Wed Oct 14, 11:00 am · written Thu Oct 15');
      // The rows the dated line replaced stay gone from the whole drawer, hidden cards included.
      for (const word of ['Review Date', 'Anchor', 'Moment', 'Authored']) await expect(journal(page).getByText(word, { exact: true })).toHaveCount(0);
    });

    await test.step('paging by keyboard to either end keeps focus on a paging button', async () => {
      await earlier(page).focus();
      await page.keyboard.press('Enter');
      await expect(earlier(page)).toBeDisabled();
      await expect(newer(page)).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(newer(page)).toBeDisabled();
      await expect(earlier(page)).toBeFocused();
      await expect(detail.heading(page, 'XYZ')).toBeVisible();
    });
    await context.close();
  });
});
