import type { Locator, Page } from '@playwright/test';
import {
  AT_10, backToTrade, confirmReference, debtForm, declineDebt, deferEntry, enterMark, expect, expectAccessible, fillRows, MONDAY, MONDAY_1100, onboardedAt, openEntryForm, openReview, openTradeFromOpenList, READY,
  reflectionSection, reflectionsOf, markAndOpenCard, setClock, tabTo, test, TUESDAY, TUESDAY_1230, TUESDAY_1700, type Row,
} from './support.ts';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Primary' });
const at = (time: string, quantity = '10'): Row => ({ quantity, price: '50.00', fee: '1.00', time });

// An owed Debt item on Trade Detail for the Position Change at a local time, and a settled one (an Entry or a
// decline, which show the moment on its own line) for the same.
const owedItem = (page: Page, when: string): Locator => page.locator('li', { has: page.getByRole('heading', { level: 3 }), hasText: `Position Change at ${when}` }).last();
const settledItem = (page: Page, when: string): Locator =>
  page.locator('li', { has: page.getByRole('heading', { level: 3 }), hasText: new RegExp(`Moment\\s*${when}`) }).last();

test.describe('B5.12 Responsive and accessible', () => {
  test('should keep a half-filled Debt answer through 390 px and back, switching layout at 960 px', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1100);
    await confirmReference(page);
    await deferEntry(page, [AT_10]);
    await setClock(context, page, TUESDAY_1700);
    await openReview(page);
    await enterMark(page, 'XYZ', MONDAY, '52.00');
    await markAndOpenCard(page, 'XYZ', TUESDAY, '52.50');
    await reflectionsOf(page, 'XYZ').getByRole('button', { name: /^Reflect on / }).click();
    await debtForm(page).getByRole('radiogroup', { name: 'Primary emotion' }).getByLabel('Anxious').check();
    await debtForm(page).getByLabel('Note').fill('Half-written note that must survive resizing.');
    await expect(nav(page)).toHaveAttribute('data-placement', 'sidebar');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(nav(page)).toHaveAttribute('data-placement', 'bottom');
    await page.setViewportSize({ width: 959, height: 844 });
    await expect(nav(page)).toHaveAttribute('data-placement', 'bottom');
    await page.setViewportSize({ width: 960, height: 844 });
    await expect(nav(page)).toHaveAttribute('data-placement', 'sidebar');
    await page.setViewportSize({ width: 1280, height: 900 });

    await expect(debtForm(page).getByRole('radiogroup', { name: 'Primary emotion' }).getByLabel('Anxious')).toBeChecked();
    await expect(debtForm(page).getByLabel('Note')).toHaveValue('Half-written note that must survive resizing.');
    await context.close();
  });

  test('should report no WCAG 2.1 AA violations on the entry form in each disposition, the Review card, the Debt form, and Detail, name each reflection state in text, and resolve a reflection by keyboard alone', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1100);
    await confirmReference(page);
    // Monday: three deferred entries (10:00, 10:30, 10:45).
    await deferEntry(page, [AT_10]);
    await backToTrade(page);
    await deferEntry(page, [at('2026-10-12T10:30')]);
    await backToTrade(page);
    await deferEntry(page, [at('2026-10-12T10:45')]);
    await backToTrade(page);

    // The entry form in each disposition, with a row filled.
    await openEntryForm(page);
    await fillRows(page, [at('2026-10-12T10:50')]);
    const section = reflectionSection(page);
    await expect(section.getByLabel('Reflect now')).toBeChecked();
    await expectAccessible(page, 'Entry form, Reflect now');
    await section.getByLabel('Reflect later').check();
    await expectAccessible(page, 'Entry form, Reflect later');
    await section.getByLabel('Decline to reflect').check();
    await expectAccessible(page, 'Entry form, Decline to reflect');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectAccessible(page, 'Entry form, Decline to reflect, narrow');
    await page.setViewportSize({ width: 1280, height: 900 });

    // Tuesday 12:30: one more deferred entry at 10:00 is due in the Review after next.
    await setClock(context, page, TUESDAY_1230);
    await openTradeFromOpenList(page);
    await deferEntry(page, [at('2026-10-13T10:00')]);
    await backToTrade(page);
    await expect(owedItem(page, '2026-10-13 10:00')).toContainText('Due in the Review after next');

    // Keyboard only: reflect on the 10:30 Position Change, answer it, and press Answer.
    const reflectNow = owedItem(page, '2026-10-12 10:30').getByRole('button', { name: 'Reflect now' });
    await reflectNow.scrollIntoViewIfNeeded();
    await tabTo(page, reflectNow);
    await page.keyboard.press('Enter');
    const form = debtForm(page);
    await expect(form).toBeVisible();
    await expectAccessible(page, 'Debt form on Trade Detail');
    await tabTo(page, form.getByRole('radiogroup', { name: 'Decision mode' }).getByLabel('As Planned'));
    await page.keyboard.press('Space');
    await tabTo(page, form.getByRole('radiogroup', { name: 'Primary emotion' }).getByLabel('Calm'));
    await page.keyboard.press('Space');
    await tabTo(page, form.getByRole('radiogroup', { name: 'Decision confidence' }).getByLabel('1', { exact: true }));
    for (let n = 0; n < 3; n++) await page.keyboard.press('ArrowRight');
    await expect(form.getByRole('radiogroup', { name: 'Decision confidence' }).getByLabel('4')).toBeChecked();
    await tabTo(page, form.getByRole('button', { name: 'Answer', exact: true }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: 'Saved reflection' })).toBeVisible(READY);

    // Decline the 10:45 reflection, then read Detail with Outstanding, answered, and declined reflections.
    await owedItem(page, '2026-10-12 10:45').getByRole('button', { name: 'Decline', exact: true }).click();
    await declineDebt(page, 'No time to write it up.');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'XYZ', level: 1 })).toBeVisible(READY);
    await expect(settledItem(page, '2026-10-12 10:30')).toContainText('Deferred, answered');
    await expect(settledItem(page, '2026-10-12 10:45')).toContainText('Declined later');
    await expect(owedItem(page, '2026-10-12 10:00')).toContainText('Reflection owed');
    await expect(owedItem(page, '2026-10-12 10:00')).toContainText('Due in the next Review');
    await expect(owedItem(page, '2026-10-13 10:00')).toContainText('Due in the Review after next');
    await expectAccessible(page, 'Detail with Outstanding, answered, and declined reflections');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectAccessible(page, 'Detail with Outstanding, answered, and declined reflections, narrow');
    await page.setViewportSize({ width: 1280, height: 900 });

    // Tuesday 17:00: the Review card lists the 10:00 reflection as Due and the Tuesday one as due in the next Review.
    await setClock(context, page, TUESDAY_1700);
    await openReview(page);
    await enterMark(page, 'XYZ', MONDAY, '52.00');
    await markAndOpenCard(page, 'XYZ', TUESDAY, '52.50');
    const reflections = reflectionsOf(page, 'XYZ');
    await expect(reflections.getByText('Due', { exact: true })).toBeVisible();
    await expect(reflections.getByText('Due in the next Review', { exact: true })).toBeVisible();
    await expectAccessible(page, 'Review Trade card with due and later reflections');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectAccessible(page, 'Review Trade card with due and later reflections, narrow');
    await page.setViewportSize({ width: 1280, height: 900 });
    await reflections.getByRole('button', { name: /^Reflect on / }).first().click();
    await expectAccessible(page, 'Debt form in the Review card');
    await context.close();
  });
});
