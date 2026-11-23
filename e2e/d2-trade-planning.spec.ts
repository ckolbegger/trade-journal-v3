import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('D2 Trade Planning — Long Stock & C. Cockpit Planned', () => {
  test('plans a Long Stock trade with live 1R preview, rejects incoherent plans with zero writes, inspects C. Cockpit drawers, passes axe WCAG AA, and persists offline', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Initialize Local Workspace' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByLabel('IANA Time Zone').fill('America/New_York');
    await page.getByRole('button', { name: 'Initialize Workspace' }).click();
    await expect(page.getByRole('heading', { name: 'Institutions & Accounts' })).toBeVisible();

    // Add Institution + Account
    await page.getByLabel('Institution name').fill('Fidelity');
    await page.getByRole('button', { name: 'Add Institution' }).click();
    await page.getByLabel('Add account under Fidelity').fill('Taxable Margin');
    await page.getByRole('button', { name: 'Add Account' }).click();
    await expect(page.getByText('Taxable Margin', { exact: true })).toBeVisible();

    // Open New Plan
    await page
      .getByRole('navigation', { name: 'Workspace sections' })
      .getByRole('button', { name: 'New Plan' })
      .click();
    await expect(page.getByRole('heading', { name: 'New Trade Plan' })).toBeVisible();

    // Verify incoherent Stop >= Entry is rejected with zero writes
    await page.getByLabel('Symbol').fill('AAPL');
    await page.getByLabel('Shares').fill('100');
    await page.getByLabel('Intended Entry ($)').fill('185.50');
    await page.getByLabel('Stop Price ($)').fill('190.00');
    await page.getByLabel('Target Price ($)').fill('208.00');
    await page.getByLabel(/Why this trade, why now/).fill('Base breakout on volume.');
    await page.getByLabel(/What would invalidate/).fill('Closes below 178 support.');
    await page.getByRole('button', { name: 'Confirm Plan' }).click();
    await expect(page.getByRole('alert')).toContainText('Stop price must be below Intended Entry');

    // Fix Stop -> verify live 1R, Planned Reward, and R:R preview
    await page.getByLabel('Stop Price ($)').fill('178.00');
    await expect(page.getByTestId('preview-1r')).toHaveText('$750.00');
    await expect(page.getByTestId('preview-reward')).toHaveText('$2,250.00');
    await expect(page.getByTestId('preview-rr')).toHaveText('3.00R');

    await page.getByLabel(/Conviction/).selectOption('4');
    await page.getByLabel(/Primary emotion/).selectOption('Calm');

    const newPlanAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(newPlanAxe.violations).toEqual([]);

    // Confirm Plan -> lands directly in C. Cockpit Planned view
    await page.getByRole('button', { name: 'Confirm Plan' }).click();
    await expect(page.getByRole('heading', { name: 'AAPL', exact: true })).toBeVisible();
    await expect(page.getByText('0 of 100 shares open')).toBeVisible();
    await expect(page.getByText('Base breakout on volume.')).toBeVisible();

    // Switch to Journal drawer -> verify immutable Plan Reflection
    await page.getByRole('tab', { name: /Journal/ }).click();
    await expect(page.getByText('PlanConfirmation')).toBeVisible();
    await expect(page.getByText('Closes below 178 support.')).toBeVisible();

    const cockpitAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(cockpitAxe.violations).toEqual([]);

    // Back to Trades browse -> verify AAPL appears
    await page.getByRole('button', { name: /Back to Trades/ }).click();
    await expect(page.getByRole('heading', { name: 'Trades', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: /AAPL/ })).toBeVisible();

    // Verify offline cold restart preserves Planned Trade
    await context.setOffline(true);
    await page.reload();
    await page
      .getByRole('navigation', { name: 'Workspace sections' })
      .getByRole('button', { name: 'Trades' })
      .click();
    await expect(page.getByRole('cell', { name: /AAPL/ })).toBeVisible({ timeout: 15_000 });
    await context.setOffline(false);
  });
});
