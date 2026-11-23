import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('D5 Daily Review Core — 3-Step Coach, Gauge Walk, Due Debt, OV-02 Strict Hold, & Day Summary', () => {
  test('walks Marks -> Due Debt -> attention-ranked Trade cards with Gauge meter, strict vs one-click Hold, unsaved-note guard, Complete summary, Journal trail, offline cold restart, and passes axe WCAG AA', async ({
    page,
    context,
  }) => {
    await page.clock.setFixedTime(new Date('2026-11-20T22:00:00Z'));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Initialize Local Workspace' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByLabel('IANA Time Zone').fill('America/New_York');
    await page.getByRole('button', { name: 'Initialize Workspace' }).click();

    // Create Institution + Account
    await page.getByLabel('Institution name').fill('Fidelity');
    await page.getByRole('button', { name: 'Add Institution' }).click();
    await page.getByLabel('Add account under Fidelity').fill('Margin');
    await page.getByRole('button', { name: 'Add Account' }).click();

    const nav = page.getByRole('navigation', { name: 'Workspace sections' });

    // Trade 1: AXIO (100 sh @ $50, Stop $47, Target $56) with DEFERRED reflection -> creates due Debt
    await nav.getByRole('button', { name: 'New Plan' }).click();
    await page.getByLabel('Symbol').fill('AXIO');
    await page.getByLabel('Shares').fill('100');
    await page.getByLabel('Intended Entry ($)').fill('50.00');
    await page.getByLabel('Stop Price ($)').fill('47.00');
    await page.getByLabel('Target Price ($)').fill('56.00');
    await page.getByLabel(/Why this trade, why now/).fill('Base breakout above 50.');
    await page.getByLabel(/What would invalidate/).fill('Daily close below 47.');
    await page.getByRole('button', { name: 'Confirm Plan' }).click();

    await page.getByRole('button', { name: 'Record entry' }).click();
    const entryPanel = page.getByRole('region', { name: /Record Opening Entry/ });
    await entryPanel.getByLabel(/^Shares/).fill('100');
    await entryPanel.getByLabel('Fill Price ($)').fill('50.00');
    await entryPanel.getByLabel('Fee ($)').fill('0.00');
    await entryPanel.getByRole('button', { name: 'Save Opening Entry' }).click();
    await expect(page.getByText('100 of 100 shares open')).toBeVisible();

    // Trade 2: NVDA (100 sh @ $140, Stop $132, Target $164) with COMPLETE NOW reflection
    await nav.getByRole('button', { name: 'New Plan' }).click();
    await page.getByLabel('Symbol').fill('NVDA');
    await page.getByLabel('Shares').fill('100');
    await page.getByLabel('Intended Entry ($)').fill('140.00');
    await page.getByLabel('Stop Price ($)').fill('132.00');
    await page.getByLabel('Target Price ($)').fill('164.00');
    await page.getByLabel(/Why this trade, why now/).fill('Breakout above 6-week base.');
    await page.getByLabel(/What would invalidate/).fill('Daily close below 132.');
    await page.getByRole('button', { name: 'Confirm Plan' }).click();

    await page.getByRole('button', { name: 'Record entry' }).click();
    await entryPanel.getByLabel(/^Shares/).fill('100');
    await entryPanel.getByLabel('Fill Price ($)').fill('140.00');
    await entryPanel.getByLabel('Fee ($)').fill('0.00');
    await entryPanel.getByLabel('Complete now').check();
    await entryPanel.getByLabel('Decision mode').selectOption('As Planned');
    await entryPanel.getByLabel('Primary emotion').selectOption('Calm');
    await entryPanel.getByLabel(/Decision confidence/).selectOption('4');
    await entryPanel.getByRole('button', { name: 'Save Opening Entry' }).click();
    await expect(page.getByText('100 of 100 shares open')).toBeVisible();

    // Go to Review
    await nav.getByRole('button', { name: 'Review' }).click();
    const dayRegion = page.getByRole('region', { name: 'The day' });
    await expect(dayRegion).toBeVisible();
    await expect(dayRegion.getByText(/2 Trades · 2 Marks, 1 deferred reflection, 2 Actions to go/)).toBeVisible();

    // Marks-before-Action gate: expanding AXIO before Marks are entered locks Action
    const tradesRegion = page.getByRole('region', { name: 'Open trades to review' });
    await tradesRegion.getByRole('button', { name: /AXIO/ }).click();
    await expect(tradesRegion.getByText(/No Action until today's Mark is in/)).toBeVisible();

    // Enter Marks: AXIO = $45.50 (Past Stop -> -9% outlier confirm), NVDA = $144.00 (Inside lines)
    await page.getByLabel('AXIO closing mark').fill('45.50');
    await page.getByRole('button', { name: 'Confirm 45.50' }).click();
    await page.getByLabel('NVDA closing mark').fill('144.00');
    await page.getByRole('button', { name: 'Save Marks' }).click();

    await expect(page.getByText(/1 · Marks saved for/)).toBeVisible();

    // Attention ranking: AXIO (Past Stop) is #1 ahead of NVDA
    const cardButtons = tradesRegion.locator('button[aria-expanded]');
    await expect(cardButtons.nth(0)).toContainText('AXIO');
    await expect(cardButtons.nth(0)).toContainText('Past Stop');
    await expect(cardButtons.nth(1)).toContainText('NVDA');

    // Click Next: AXIO -> OV-02 strict rule (nothing preselected, reason required)
    await dayRegion.getByRole('button', { name: 'Next: AXIO' }).click();
    const axioForm = tradesRegion.getByRole('form', { name: 'Action, AXIO' });
    await expect(axioForm).toBeVisible();
    await expect(axioForm.getByText('Nothing is chosen for you here.')).toBeVisible();
    await axioForm.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(axioForm.getByText('Choose an Action.')).toBeVisible();

    await axioForm.getByRole('button', { name: 'Hold', exact: true }).click();
    await axioForm.getByRole('button', { name: 'Save Hold' }).click();
    await expect(axioForm.getByText('Say why you are holding past your Plan line.')).toBeVisible();

    // Type reason on AXIO, then click NVDA header -> triggers unsaved-note refusal bar!
    await axioForm.getByLabel('AXIO action reason').fill('Oversold; waiting for bounce.');
    await cardButtons.nth(1).click();
    await expect(tradesRegion.getByText("AXIO's note isn't saved.")).toBeVisible();
    await tradesRegion.getByRole('button', { name: 'Save it' }).click();

    // Now NVDA is open (inside lines -> Hold preselected -> one-click Save Hold with no reason!)
    const nvdaForm = tradesRegion.getByRole('form', { name: 'Action, NVDA' });
    await expect(nvdaForm).toBeVisible();
    await expect(nvdaForm.getByRole('button', { name: 'Hold', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await nvdaForm.getByRole('button', { name: 'Save Hold' }).click();

    // Review is STILL Incomplete until AXIO's due deferred reflection is settled!
    await expect(dayRegion.getByText(/1 deferred reflection to go/)).toBeVisible();

    const debtRegion = page.getByRole('region', { name: 'Due reflections' });
    await debtRegion.getByLabel('AXIO debt decision mode').selectOption('As Planned');
    await debtRegion.getByLabel('AXIO debt primary emotion').selectOption('Calm');
    await debtRegion.getByLabel('AXIO debt confidence').selectOption('4');
    await debtRegion.getByLabel('AXIO debt note').fill('Clean breakout entry.');
    await debtRegion.getByRole('button', { name: 'Save Reflection' }).click();

    // Now Review transitions to Complete Day Summary!
    const doneRegion = page.getByRole('region', { name: 'The day, complete' });
    await expect(doneRegion).toBeVisible();
    await expect(doneRegion.getByText('Complete', { exact: true })).toBeVisible();
    await expect(doneRegion.getByText(/Past Stop:/)).toBeVisible();
    await expect(doneRegion.getByText(/Hold.*AXIO, NVDA/)).toBeVisible();

    // WCAG AA check on Complete Daily Review screen
    const reviewAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(reviewAxe.violations).toEqual([]);

    // Inspect AXIO -> C. Cockpit Journal drawer shows Daily Trade Review + settled Position Change Reflection
    await cardButtons.nth(0).click();
    await tradesRegion.getByRole('button', { name: 'Inspect' }).click();
    await page.getByRole('tab', { name: /Journal/ }).click();
    const journalPanel = page.getByRole('tabpanel', { name: 'Journal' });
    await expect(journalPanel.getByText('Daily Trade Review')).toBeVisible();
    await expect(journalPanel.getByText('Oversold; waiting for bounce.')).toBeVisible();
    await expect(journalPanel.getByText('Clean breakout entry.')).toBeVisible();

    // Offline cold restart resumes derived Complete state cleanly
    await context.setOffline(true);
    await page.reload();
    await nav.getByRole('button', { name: 'Review' }).click();
    await expect(page.getByRole('region', { name: 'The day, complete' })).toBeVisible({
      timeout: 15_000,
    });
    await context.setOffline(false);
  });
});
