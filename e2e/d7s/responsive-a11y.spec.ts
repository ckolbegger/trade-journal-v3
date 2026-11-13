import type { Locator, Page } from '@playwright/test';
import {
  createOs2Trade, detail, expect, expectAccessible, firstPage, launchAt, MONDAY_0900, onboardedAt, openDrawer, openReview, reachCard, READY, saveSessionMarks, stopOptionLabel, tabTo, targetOptionLabel, test, TUESDAY,
  TUESDAY_1030, TUESDAY_1700, OS2,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

const nav = (page: Page): Locator => page.getByRole('navigation', { name: 'Primary' });
const NARROW = { width: 390, height: 844 };
const WIDE = { width: 1280, height: 900 };
const UNDERLYING_STOP = /^Stop \((?!option price)/;
const UNDERLYING_TARGET = /^Target \((?!option price)/;

// Axe at 1280 px and again at 390 px, returning to 1280.
async function accessibleAtBothWidths(page: Page, state: string): Promise<void> {
  await expectAccessible(page, state);
  await page.setViewportSize(NARROW);
  await expectAccessible(page, `${state}, narrow`);
  await page.setViewportSize(WIDE);
}

test.describe('B7S.5 Responsive and accessible', () => {
  test('should keep a half-filled option Plan through 390 px and back, report no WCAG 2.1 AA violations on the option Plan form, Detail conditions and Review card conditions, and show every condition status as text', async ({ profile }) => {
    test.setTimeout(420_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, TUESDAY_1030);
    const trade = await createOs2Trade(setupPage);
    await setup.close();

    const context = await launchAt(profile, TUESDAY_1700);
    const page = await firstPage(context);
    await page.goto('/');

    // Half-fill the four price fields at 1280 px (one Underlying and one option price); resize to 390 px and back; the values stay.
    await nav(page).getByRole('link', { name: 'New Plan' }).click();
    await expect(page.getByRole('heading', { name: 'New Plan' })).toBeVisible(READY);
    await page.getByLabel('Strategy').selectOption({ label: 'Cash-Secured Put' });
    await page.getByLabel('Underlying', { exact: true }).fill('MNO');
    await page.getByLabel(UNDERLYING_STOP).fill('41.00');
    await page.getByLabel(targetOptionLabel(OS2), { exact: true }).fill('0.30');
    await page.setViewportSize(NARROW);
    await expect(nav(page)).toHaveAttribute('data-placement', 'bottom');
    await page.setViewportSize(WIDE);
    await expect(nav(page)).toHaveAttribute('data-placement', 'sidebar');
    await expect(page.getByLabel(UNDERLYING_STOP)).toHaveValue('41.00');
    await expect(page.getByLabel(targetOptionLabel(OS2), { exact: true })).toHaveValue('0.30');
    await expect(page.getByLabel(stopOptionLabel(OS2), { exact: true })).toHaveValue('');
    await expect(page.getByLabel(UNDERLYING_TARGET)).toHaveValue('');
    await expect(page.getByLabel('Underlying', { exact: true })).toHaveValue('MNO');
    await accessibleAtBothWidths(page, 'option Plan form with both kinds, half filled');

    // Detail's conditions: every status is a word in its row.
    await page.goto(`/trades/${trade.tradeId}`);
    await expect(detail.heading(page, 'MNO')).toBeVisible(READY);
    const conditions = detail.conditionBlocks(page);
    await expect(conditions.first()).toBeVisible(READY);
    await expect(conditions).toHaveCount(4);
    for (const condition of await conditions.all()) await expect(condition).toContainText(/(Stop|Target)[\s\S]*(−\$|\+\$|Breached|Reached|Mark missing)/);
    await accessibleAtBothWidths(page, 'Detail conditions');

    // The Review card's conditions, after the Tuesday Marks: each line names its status in words.
    await openReview(page);
    await saveSessionMarks(page, trade, TUESDAY, '44.00', '1.80');
    const card = await reachCard(page, trade);
    const lines = card.getByRole('list', { name: 'Conditions' }).locator('li');
    await expect(lines).toHaveCount(4);
    for (const line of await lines.all()) await expect(line).toHaveText(/: (Active|Breached|Reached)/);
    await accessibleAtBothWidths(page, 'Review card conditions');
    await context.close();
  });

  test('should plan O-S2 by keyboard alone, with a visible focus ring on every stop, and show 1R $480.00', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await onboardedAt(profile, MONDAY_0900);
    await tabTo(page, nav(page).getByRole('link', { name: 'New Plan' }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'New Plan' })).toBeVisible(READY);
    await tabTo(page, page.getByLabel('Strategy'));
    await page.keyboard.type('Cash');
    await expect(page.getByLabel('Strategy').locator('option:checked')).toHaveText('Cash-Secured Put');
    const values: [Locator, string][] = [
      [page.getByLabel('Underlying', { exact: true }), OS2.underlying],
      // A date input takes its segments in the browser's locale order, here month, day, year (BUG-2).
      [page.getByLabel('Expiration date'), OS2.expiration.replace(/^(\d{4})-(\d\d)-(\d\d)$/, '$2$3$1')],
      [page.getByLabel('Strike'), OS2.strike],
      [page.getByLabel('Contracts'), OS2.contracts],
      [page.getByLabel('Intended entry price (per share)'), OS2.entry],
      [page.getByLabel(UNDERLYING_STOP), OS2.stop],
      [page.getByLabel(stopOptionLabel(OS2), { exact: true }), OS2.stopOption],
      [page.getByLabel(UNDERLYING_TARGET), OS2.target],
      [page.getByLabel(targetOptionLabel(OS2), { exact: true }), OS2.targetOption],
      [page.getByLabel('Why this trade, why now?'), 'Earnings run-up with defined risk.'],
      [page.getByLabel('What would invalidate the thesis?'), 'A close below the Stop.'],
    ];
    for (const [field, value] of values) {
      await tabTo(page, field);
      await page.keyboard.type(value);
    }
    const conviction = page.getByRole('radiogroup', { name: 'Conviction' });
    await tabTo(page, conviction.getByLabel('1', { exact: true }));
    await page.keyboard.press('Space');
    for (let n = 0; n < 3; n++) await page.keyboard.press('ArrowRight');
    await expect(conviction.getByLabel('4')).toBeChecked();
    const emotion = page.getByRole('radiogroup', { name: 'Primary emotion' });
    await tabTo(page, emotion.getByLabel('Calm'));
    await page.keyboard.press('Space');
    await tabTo(page, page.getByRole('button', { name: 'Confirm Plan' }));
    await page.keyboard.press('Enter');
    await expect(detail.heading(page, 'MNO')).toBeVisible(READY);
    await openDrawer(page, 'Plan and Risk');
    await expect(detail.oneR(page)).toHaveText('$480.00');
    await context.close();
  });
});
