import type { Locator, Page } from '@playwright/test';
import { buildOc3, detail, expect, fillDebtAnswers, openDetailAt, openDrawer, READY, test, THURSDAY_1800 } from './support.ts';

test.use({ actionTimeout: 15_000 });

// B8P.2 (plan section 7.2): O-C3 as in B8P.1, clock Thu 2026-10-15 18:00. Figures are section 5's table; the Journal items sit where A213 puts them:
// the Plan Reflection (Mon 09:00) before the first exposure, the entry reflection (Mon 10:05) in Monday's session, the Hold for Review Date Tue 10-13
// in Tuesday's, the owed exit reflection (Wed 11:05) in Wednesday's (the first session closing at or after it), the Thursday Hold in Thursday's.
const journal = (page: Page): Locator => page.locator('#drawer-panel-journal');
const card = (page: Page, heading: RegExp): Locator => journal(page).locator('article.journal-card').filter({ hasText: heading });
const shownHeadings = (page: Page) => journal(page).locator('li:not([hidden]) > article.journal-card > h3');
const earlier = (page: Page): Locator => journal(page).getByRole('button', { name: 'Earlier sessions' });
const newer = (page: Page): Locator => journal(page).getByRole('button', { name: 'Newer sessions' });
const WEDNESDAY = /^\s*Yesterday, Wed Oct 14/;

test.describe('B8P.2 Price History and Journal', () => {
  test('should show sessions newest left with Tuesday as a gap and the Review link, the cards newest first and paged with the arrows, Wednesday owed reflection answered on its card, and the answer still shown after a reload', async ({ profile }) => {
    test.setTimeout(420_000);
    const trade = await buildOc3(profile, { thursdayHold: true });
    const { context, page } = await openDetailAt(profile, THURSDAY_1800, trade);

    await test.step('Price History (W9, P99): newest on the left, Tuesday "—" with the accessible name No Mark', async () => {
      await openDrawer(page, 'Price History');
      const table = page.locator('#drawer-panel-price-history table.price-history');
      await expect(table.locator('thead th')).toHaveCount(5);
      await expect(table.locator('thead th').first()).toHaveText('Session');
      for (const [index, [weekday, date]] of [['Thu', 'Oct 15'], ['Wed', 'Oct 14'], ['Tue', 'Oct 13'], ['Mon', 'Oct 12']].entries())
        await expect(table.locator('thead th').nth(index + 1).locator('span')).toHaveText([weekday!, date!]);
      await expect(table.locator('tbody th')).toHaveText(['XYZ Mark', 'Call Mark', 'Trade P&L']);
      // Section 5's table: Thursday 57.90, 3.20, $218.05; Wednesday 57.40, 2.90, $188.05; Monday 56.00, 2.10, $18.70; Tuesday has no Mark at all.
      await expect(table.locator('tbody tr').nth(0).locator('td')).toHaveText(['57.90', '57.40', '—', '56.00']);
      await expect(table.locator('tbody tr').nth(1).locator('td')).toHaveText(['$3.20', '$2.90', '—', '$2.10']);
      await expect(table.locator('tbody tr').nth(2).locator('td')).toHaveText(['$218.05', '$188.05', '—', '$18.70']);
      await expect(table.getByRole('img', { name: 'No Mark' })).toHaveCount(3);
      for (const row of await table.locator('tbody tr').all()) await expect(row.locator('td').nth(2).getByRole('img', { name: 'No Mark' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Price History', exact: true })).toHaveText('Price History 1');
      await expect(page.locator('#drawer-panel-price-history .price-history-gaps')).toContainText('1 session without Marks.');
      // Gone: no Wednesday-style gap count of "2", and no empty-state sentence, anywhere in the DOM.
      await expect(page.locator('.trade-detail').getByText('No sessions yet', { exact: false })).toHaveCount(0);
    });

    await test.step('the Review link opens the Review, and the Detail comes back on Price History', async () => {
      const link = detail.root(page).getByRole('link', { name: 'Enter Marks in the Review' });
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(/\/review/, READY);
      await expect(page.getByRole('heading', { name: 'Review', level: 1 })).toBeVisible(READY);
      await page.goto(`/trades/${trade.tradeId}`);
      await expect(detail.heading(page, 'XYZ')).toBeVisible(READY);
    });

    await test.step('Journal (W10 to W12): cards newest first, three to a screen, paged with the arrows', async () => {
      await openDrawer(page, 'Journal');
      await expect(journal(page).getByRole('heading', { name: 'Sessions, newest first', level: 2 })).toBeVisible();
      await expect(shownHeadings(page)).toHaveText(['Fri Oct 16', 'Today, Thu Oct 15', 'Yesterday, Wed Oct 14']);
      await expect(newer(page)).toBeDisabled();
      await expect(earlier(page)).toBeEnabled();
      // The session not ended yet (W12) and the later cards are in the DOM and hidden, not gone.
      await expect(journal(page).locator('li[hidden] > article.journal-card')).toHaveCount(3);
      await expect(journal(page).locator('li[hidden] > article.journal-card').first()).toBeHidden();
      await expect(card(page, /^\s*Fri Oct 16/)).toContainText('Session not ended yet');
      await expect(card(page, /^\s*Fri Oct 16/)).toContainText('Its Marks are due once this session ends.');
      await expect(card(page, /^\s*Today, Thu Oct 15/)).toContainText('$218.05');
      await expect(card(page, /^\s*Today, Thu Oct 15/)).toContainText('+$30.00 since Wed Oct 14');
      await expect(card(page, /^\s*Today, Thu Oct 15/).locator('.journal-card-marks')).toContainText('XYZ Mark57.90');
      await expect(card(page, /^\s*Today, Thu Oct 15/)).toContainText('Review DateThu Oct 15');
      await expect(card(page, WEDNESDAY)).toContainText('$188.05');
      await expect(card(page, WEDNESDAY)).toContainText('+$169.35 since Mon Oct 12');
      await expect(card(page, WEDNESDAY)).toContainText('Reflection owed');

      await earlier(page).click();
      await expect(shownHeadings(page)).toHaveText(['Tue Oct 13 without Marks', 'Mon Oct 12', 'Plan']);
      await expect(earlier(page)).toBeDisabled();
      await expect(newer(page)).toBeEnabled();
      // Tuesday: no Marks of its own (gone from the DOM) but its Hold, by Review Date. Monday: the first Mark. The Plan card: the Plan Reflection.
      const tuesday = card(page, /^\s*Tue Oct 13 without Marks/);
      await expect(tuesday.locator('.journal-card-marks')).toHaveCount(0);
      await expect(tuesday.locator('.journal-card-change')).toHaveCount(0);
      await expect(tuesday).toContainText('Review DateTue Oct 13');
      await expect(card(page, /^\s*Mon Oct 12/)).toContainText('$18.70');
      await expect(card(page, /^\s*Mon Oct 12/)).toContainText('First Mark');
      await expect(card(page, /^\s*Mon Oct 12/)).toContainText('Position Change Reflection');
      await expect(card(page, /^\s*Plan/)).toContainText('Planned Mon Oct 12, 9:00 am');
      await expect(card(page, /^\s*Plan/)).toContainText('Plan Reflection');
      await newer(page).click();
      await expect(shownHeadings(page)).toHaveText(['Fri Oct 16', 'Today, Thu Oct 15', 'Yesterday, Wed Oct 14']);
    });

    await test.step('Reflect now on Wednesday card opens its form, and the answer replaces the owed item', async () => {
      const wednesday = card(page, WEDNESDAY);
      await wednesday.getByRole('button', { name: 'Reflect now' }).click();
      const form = wednesday.getByRole('form', { name: 'Reflection' });
      await expect(form).toBeVisible();
      await expect(journal(page).getByRole('form', { name: 'Reflection' })).toHaveCount(1);
      await fillDebtAnswers(page);
      await form.getByRole('button', { name: 'Answer', exact: true }).click();
      await expect(wednesday.getByRole('region', { name: 'Saved reflection' })).toBeVisible();
      await expect(wednesday).toContainText('Deferred, answered');
      await expect(wednesday).toContainText('Decision modeAs Planned');
      // Gone: no owed item, form or Reflect now button remains anywhere in the Journal, and the rail has nothing owed.
      await expect(journal(page).getByText('Reflection owed', { exact: true })).toHaveCount(0);
      await expect(detail.anywhere(() => detail.debtForm(page))).toHaveCount(0);
      await expect(detail.journalReflectNowButton(page)).toHaveCount(0);
      await expect(detail.needsYouCard(page).getByText('Nothing needs you now.')).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Journal', exact: true })).toHaveText('Journal');
    });

    await test.step('after a reload the reflection is still answered and shown on Wednesday card', async () => {
      await page.reload();
      await expect(detail.heading(page, 'XYZ')).toBeVisible(READY);
      await openDrawer(page, 'Journal');
      const wednesday = card(page, WEDNESDAY);
      await expect(wednesday).toBeVisible();
      await expect(wednesday).toContainText('Deferred, answered');
      await expect(wednesday).toContainText('Answered2026-10-15 18:00');
      await expect(wednesday).toContainText('Decision modeAs Planned');
      await expect(wednesday).toContainText('Primary emotionCalm');
      await expect(wednesday).toContainText('Decision confidence4');
      await expect(journal(page).getByText('Reflection owed', { exact: true })).toHaveCount(0);
      await expect(detail.needsYouCard(page).getByText('Nothing needs you now.')).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Journal', exact: true })).toHaveText('Journal');
    });
    await context.close();
  });

  test('should select the Journal drawer from Reflect now in Needs you and open the form on Wednesday card, from any page of cards', async ({ profile }) => {
    test.setTimeout(420_000);
    const trade = await buildOc3(profile, { thursdayHold: true });
    const { context, page } = await openDetailAt(profile, THURSDAY_1800, trade);
    // Start on the second page of the Journal, so that the request has to bring the page back to Wednesday's card.
    await openDrawer(page, 'Journal');
    await earlier(page).click();
    await expect(shownHeadings(page)).toHaveText(['Tue Oct 13 without Marks', 'Mon Oct 12', 'Plan']);
    await openDrawer(page, 'Today');
    await expect(page.locator('#drawer-panel-journal')).toBeHidden();
    await detail.reflectNowButton(page).click();
    await expect(page.getByRole('tab', { name: 'Journal', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(journal(page)).toBeVisible();
    await expect(shownHeadings(page)).toHaveText(['Fri Oct 16', 'Today, Thu Oct 15', 'Yesterday, Wed Oct 14']);
    await expect(card(page, WEDNESDAY).getByRole('form', { name: 'Reflection' })).toBeVisible();
    await context.close();
  });
});
