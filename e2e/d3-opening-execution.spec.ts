import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('D3 Opening Execution — Long Stock Open Lots, Entry Quality, & Deferred Debt', () => {
  test('records opening and scale-in fills with Defer preselected, transitions Planned -> Open, shows Position/Entry Quality/Debt, filters Trades, and passes axe WCAG AA', async ({
    page,
  }) => {
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

    // Confirm a 100-share NVDA Long Stock Plan
    await page
      .getByRole('navigation', { name: 'Workspace sections' })
      .getByRole('button', { name: 'New Plan' })
      .click();
    await page.getByLabel('Symbol').fill('NVDA');
    await page.getByLabel('Shares').fill('100');
    await page.getByLabel('Intended Entry ($)').fill('140.00');
    await page.getByLabel('Stop Price ($)').fill('132.00');
    await page.getByLabel('Target Price ($)').fill('164.00');
    await page.getByLabel(/Why this trade, why now/).fill('Breakout above 6-week base.');
    await page.getByLabel(/What would invalidate/).fill('Daily close below 132.');
    await page.getByRole('button', { name: 'Confirm Plan' }).click();

    await expect(page.getByText('0 of 100 shares open')).toBeVisible();

    // Record first 60-share opening fill with Defer preselected
    await page.getByRole('button', { name: 'Record entry' }).click();
    const entryPanel = page.getByRole('region', { name: /Record Opening Entry/ });
    await expect(entryPanel.getByLabel(/Defer \(due in next Review\)/)).toBeChecked();
    await entryPanel.getByLabel(/^Shares/).fill('60');
    await entryPanel.getByLabel('Fill Price ($)').fill('140.50');
    await entryPanel.getByLabel('Fee ($)').fill('1.20');
    await entryPanel.getByRole('button', { name: 'Save Opening Entry' }).click();

    // Verify Planned -> Open transition, Position drawer, Open Lots, and Deferred Debt badge
    await expect(page.getByText('60 of 100 shares open')).toBeVisible();
    await expect(page.getByText(/Needs you · 1 reflection deferred/)).toBeVisible();
    await expect(page.getByText('No Marks yet')).toBeVisible();
    await expect(page.getByText('PartiallyFilled')).toBeVisible();

    // Scale in remaining 40 shares with Complete now (verifies Debt does not block execution)
    await page.getByRole('button', { name: 'Record entry' }).click();
    await entryPanel.getByLabel(/^Shares/).fill('40');
    await entryPanel.getByLabel('Fill Price ($)').fill('139.25');
    await entryPanel.getByLabel('Fee ($)').fill('0.80');
    await entryPanel.getByLabel('Complete now').check();
    await entryPanel.getByLabel('Decision mode').selectOption('As Planned');
    await entryPanel.getByLabel('Primary emotion').selectOption('Calm');
    await entryPanel.getByLabel(/Decision confidence/).selectOption('4');
    await entryPanel.getByLabel(/Note/).fill('Added final tranche on pullback.');
    await entryPanel.getByRole('button', { name: 'Save Opening Entry' }).click();

    await expect(page.getByText('100 of 100 shares open')).toBeVisible();
    await expect(page.getByText('FilledAsPlanned')).toBeVisible();
    await expect(page.getByText('$2.00')).toBeVisible(); // total opening fees

    // Check Plan and Risk drawer -> Entry Quality
    await page.getByRole('tab', { name: 'Plan and Risk' }).click();
    await expect(page.getByRole('heading', { name: 'Entry Quality vs. Plan' })).toBeVisible();
    await expect(page.getByText('100% (100 / 100)')).toBeVisible();

    // Check Journal drawer -> Deferred Debt + Position Change Reflection + Plan Reflection
    await page.getByRole('tab', { name: /Journal/ }).click();
    await expect(page.getByText('Deferred · Due in next Review')).toBeVisible();
    await expect(page.getByText('Added final tranche on pullback.')).toBeVisible();

    const cockpitAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(cockpitAxe.violations).toEqual([]);

    // Verify Trades lifecycle filter (Open shows NVDA, Planned shows empty)
    await page.getByRole('button', { name: /Back to Trades/ }).click();
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(page.getByRole('cell', { name: /NVDA/ })).toBeVisible();
    await page.getByRole('button', { name: 'Planned', exact: true }).click();
    await expect(page.getByText('No Planned Trades yet.')).toBeVisible();
  });
});
