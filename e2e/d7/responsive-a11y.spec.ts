import type { Locator, Page } from '@playwright/test';
import {
  closeReviewGroup, closingSection, completion, createSettlementFixture, createShortPutTrade, currentTradeId, expect, expectAccessible, expectPayoffChart, expectPayoffNotApplicable,
  fillOptionPlan, firstPage, FRIDAY_NOV_1700, launchAt, onboardedAt, openEntryForm, openReview, openSettlement, receiptResult, READY, test, tabTo, TUESDAY_1030, valueOf,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

const nav = (page: Page): Locator => page.getByRole('navigation', { name: 'Primary' });
const NARROW = { width: 390, height: 844 };
const WIDE = { width: 1280, height: 900 };
const NO_OPTION = /^Not applicable: no option expiration$/;

// Axe at 1280 px and again at 390 px, returning to 1280.
async function accessibleAtBothWidths(page: Page, state: string): Promise<void> {
  await expectAccessible(page, state);
  await page.setViewportSize(NARROW);
  await expectAccessible(page, `${state}, narrow`);
  await page.setViewportSize(WIDE);
}

test.describe('B7.13 Responsive and accessible', () => {
  test('should keep a half-filled option Plan through 390 px and back, switching layout at 960 px, report no WCAG 2.1 AA violations on the option Plan, Execution and expiration forms, both payoff views in every state, option Detail with and without Settlement Due, and the Review settlement panel, and show Settlement Due and Not applicable as text with a table beside every chart', async ({ profile }) => {
    test.setTimeout(540_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, TUESDAY_1030);
    // T-1 the Long Call (one contract left), T-2 Long Stock, T-3 the short Put.
    const { t1, t2, t3 } = await createSettlementFixture(setupPage);
    await setup.close();

    const context = await launchAt(profile, TUESDAY_1030);
    const page = await firstPage(context);
    await page.goto('/');

    // Half-fill the option Plan at 1280 px: resize to 390 px and back; layout switches at 960 px; the values stay.
    await nav(page).getByRole('link', { name: 'New Plan' }).click();
    await expect(page.getByRole('heading', { name: 'New Plan' })).toBeVisible(READY);
    await page.getByLabel('Strategy').selectOption({ label: 'Long Put' });
    await page.getByLabel('Underlying', { exact: true }).fill('ABC');
    await page.getByLabel('Strike').fill('50');
    await page.getByLabel('Why this trade, why now?').fill('Half-written thesis that must survive resizing.');
    await expect(nav(page)).toHaveAttribute('data-placement', 'sidebar');
    await page.setViewportSize(NARROW);
    await expect(nav(page)).toHaveAttribute('data-placement', 'bottom');
    await page.setViewportSize({ width: 959, height: 844 });
    await expect(nav(page)).toHaveAttribute('data-placement', 'bottom');
    await page.setViewportSize({ width: 960, height: 844 });
    await expect(nav(page)).toHaveAttribute('data-placement', 'sidebar');
    await page.setViewportSize(WIDE);
    await expect(page.getByLabel('Strategy')).toHaveValue(/./);
    await expect(page.getByLabel('Strategy').locator('option:checked')).toHaveText('Long Put');
    await expect(page.getByLabel('Underlying', { exact: true })).toHaveValue('ABC');
    await expect(page.getByLabel('Strike')).toHaveValue('50');
    await expect(page.getByLabel('Why this trade, why now?')).toHaveValue('Half-written thesis that must survive resizing.');
    await accessibleAtBothWidths(page, 'option Plan form, half filled');

    // The full option Plan form, then its confirmation: the Planned view has a chart and its table; the Current view does not apply.
    await fillOptionPlan(page, { strategy: 'Long Put', underlying: 'ABC', expiration: '2026-11-20', strike: '50', contracts: '1', entry: '1.50', stop: '55', target: '45', planTime: '2026-10-13T09:00' });
    await accessibleAtBothWidths(page, 'option Plan form');
    await page.getByRole('button', { name: 'Confirm Plan' }).click();
    await expect(page.getByRole('heading', { name: 'ABC', level: 1 })).toBeVisible(READY);
    await expectPayoffChart(page, 'Planned');
    await expectPayoffNotApplicable(page, 'Current', /^Not applicable/);
    await accessibleAtBothWidths(page, 'Planned Long Put Detail, Planned payoff');
    const abcId = await currentTradeId(page);

    // Open Long Call Detail without Settlement Due: both payoff views have chart and table; the Current one offsets the realized amount.
    await page.goto(`/trades/${t1.tradeId}`);
    await expect(page.getByRole('heading', { name: 'XYZ', level: 1 })).toBeVisible(READY);
    await expect(page.getByRole('heading', { name: /^Settlement Due/ })).toHaveCount(0);
    await expectPayoffChart(page, 'Planned');
    await expectPayoffChart(page, 'Current');
    await expect(page.getByRole('table', { name: /^Current payoff at expiration by XYZ price, including \+\$88\.70 realized to date$/ })).toBeVisible();
    await accessibleAtBothWidths(page, 'option Detail without Settlement Due');

    // The Execution forms: entry and exit.
    await openEntryForm(page);
    await accessibleAtBothWidths(page, 'option entry form');
    await page.goto(`/trades/${t1.tradeId}`);
    await page.getByRole('link', { name: 'Record exit' }).click();
    await expect(page.getByRole('heading', { name: 'Record exit', level: 1 })).toBeVisible(READY);
    await accessibleAtBothWidths(page, 'option exit form');

    // Long Stock Detail: both payoff views say Not applicable in text, with no chart.
    await page.goto(`/trades/${t2.tradeId}`);
    await expect(page.getByRole('heading', { name: 'XYZ', level: 1 })).toBeVisible(READY);
    await expectPayoffNotApplicable(page, 'Planned', NO_OPTION);
    await expectPayoffNotApplicable(page, 'Current', NO_OPTION);
    await accessibleAtBothWidths(page, 'Long Stock Detail, payoff Not applicable');
    await context.close();

    // Friday 17:00: Settlement Due on Detail and in the Review's settlement panel, and the expiration form.
    const friday = await launchAt(profile, FRIDAY_NOV_1700);
    const due = await firstPage(friday);
    await due.goto(`/trades/${t3.tradeId}`);
    const panel = due.getByRole('region', { name: /^Settlement Due/ });
    await expect(panel).toBeVisible(READY);
    await expect(panel.getByRole('heading', { name: /^Settlement Due/ })).toBeVisible();
    await expect(valueOf(panel, 'Contract')).toHaveText('MNO 20 Nov 2026 45 Put');
    await expectPayoffChart(due, 'Planned');
    await expectPayoffChart(due, 'Current');
    await accessibleAtBothWidths(due, 'option Detail with Settlement Due');
    await due.goto(`/trades/${abcId}`);
    await expect(due.getByRole('heading', { name: 'ABC', level: 1 })).toBeVisible(READY);
    await due.goto(`/trades/${t3.tradeId}`);
    await due.getByRole('link', { name: 'Record expiration' }).click();
    await expect(due.getByRole('heading', { name: 'Expiration', level: 1 })).toBeVisible(READY);
    await accessibleAtBothWidths(due, 'expiration form');

    await openReview(due);
    await expect(completion(due)).toHaveText('Incomplete');
    const settlement = await openSettlement(due, t3);
    await expect(settlement).toContainText('MNO 20 Nov 2026 45 Put');
    await expect(settlement.getByRole('link', { name: 'Record expiration' })).toBeVisible();
    await accessibleAtBothWidths(due, 'Review settlement panel');
    await friday.close();
  });

  test('should record an Expiration by keyboard alone, with a visible focus ring on every stop', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, FRIDAY_NOV_1700);
    const tradeId = await createShortPutTrade(setupPage);
    await setup.close();

    const context = await launchAt(profile, FRIDAY_NOV_1700);
    const page = await firstPage(context);
    await page.goto(`/trades/${tradeId}`);
    await expect(page.getByRole('heading', { name: 'MNO', level: 1 })).toBeVisible(READY);
    await tabTo(page, page.getByRole('link', { name: 'Record expiration' }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Expiration', level: 1 })).toBeVisible(READY);
    const reflection = page.getByRole('region', { name: 'Reflection on this expiration' });
    await tabTo(page, reflection.getByRole('radiogroup', { name: 'Decision mode' }).getByLabel('As Planned'));
    await page.keyboard.press('Space');
    await tabTo(page, reflection.getByRole('radiogroup', { name: 'Primary emotion' }).getByLabel('Calm'));
    await page.keyboard.press('Space');
    await tabTo(page, reflection.getByRole('radiogroup', { name: 'Decision confidence' }).getByLabel('1', { exact: true }));
    for (let n = 0; n < 3; n++) await page.keyboard.press('ArrowRight');
    await expect(reflection.getByRole('radiogroup', { name: 'Decision confidence' }).getByLabel('4')).toBeChecked();
    await tabTo(page, closingSection(page).getByRole('radiogroup', { name: 'Would you take this Trade again under similar conditions?' }).getByLabel('Yes, as planned'));
    await page.keyboard.press('Space');
    await expect(closeReviewGroup(page).getByLabel('Reflect now')).toBeChecked();
    await tabTo(page, page.getByRole('button', { name: 'Save expiration' }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Expiration recorded', level: 1 })).toBeVisible(READY);
    await expect(valueOf(receiptResult(page), 'Lifecycle')).toHaveText('Closed');

    // The Closed option Detail: the Current view does not apply, in text; the Planned one keeps its chart and table.
    await page.getByRole('link', { name: 'Back to the Trade' }).click();
    await expect(page.getByRole('heading', { name: 'MNO', level: 1 })).toBeVisible(READY);
    await expectPayoffChart(page, 'Planned');
    await expectPayoffNotApplicable(page, 'Current', /^Not applicable/);
    await expectAccessible(page, 'Closed option Detail');
    await context.close();
  });
});
