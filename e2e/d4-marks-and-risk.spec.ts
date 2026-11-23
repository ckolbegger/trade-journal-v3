import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('D4 After-Close Marks (in Review) & Ongoing Risk/Reward', () => {
  test('enters Marks in Review with sanity checks, Unavailable/Undo, Saved collapse, live C. Cockpit Today & Price History drawers, offline reload, and passes axe WCAG AA', async ({
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

    // Plan and open a 100-share NVDA Long Stock Trade
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

    await page.getByRole('button', { name: 'Record entry' }).click();
    const entryPanel = page.getByRole('region', { name: /Record Opening Entry/ });
    await entryPanel.getByLabel(/^Shares/).fill('100');
    await entryPanel.getByLabel('Fill Price ($)').fill('140.00');
    await entryPanel.getByLabel('Fee ($)').fill('0.00');
    await entryPanel.getByRole('button', { name: 'Save Opening Entry' }).click();
    await expect(page.getByText('100 of 100 shares open')).toBeVisible();

    // Navigate to Review -> Marks grid
    await page
      .getByRole('navigation', { name: 'Workspace sections' })
      .getByRole('button', { name: 'Review' })
      .click();
    await expect(page.getByRole('heading', { name: /^Review ·/ })).toBeVisible();

    const nvdaInput = page.getByLabel('NVDA closing mark');
    await expect(nvdaInput).toBeVisible();

    // 1. $0.00 rejected inline for stock
    await nvdaInput.fill('0.00');
    await expect(page.getByText('Stock Mark must be greater than $0.00.')).toBeVisible();

    // 2. >5% outlier prompts confirmation (160.00 vs 140.00 entry is +14.3%)
    await nvdaInput.fill('160.00');
    await expect(page.getByRole('button', { name: 'Confirm 160.00' })).toBeVisible();

    // 3. Clear input -> Can't get a price + Undo
    await nvdaInput.fill('');
    await page.getByRole('button', { name: "Can't get a price" }).click();
    await expect(page.getByText(/NVDA No price today/)).toBeVisible();
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(nvdaInput).toBeVisible();

    // 4. Save normal Mark ($146.00 -> +$600.00, +0.75R) -> collapses to Saved · Edit
    await nvdaInput.fill('146.00');
    await page.getByRole('button', { name: 'Save Marks' }).click();
    await expect(page.getByText(/1 · Marks saved for/)).toBeVisible();
    await expect(page.getByText('NVDA $146.00')).toBeVisible();
    const openTradesTable = page.getByRole('table', { name: 'Open trades marked summary' });
    await expect(openTradesTable.getByText('+$600.00')).toBeVisible();
    await expect(openTradesTable.getByText('+0.75R')).toBeVisible();

    // Check axe WCAG AA on Review screen
    const reviewAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(reviewAxe.violations).toEqual([]);

    // 5. Inspect NVDA -> C. Cockpit live rail, Today drawer + PriceTrack, Price History drawer
    await page.getByRole('button', { name: 'Inspect' }).click();
    await expect(page.getByRole('heading', { name: /NVDA/ })).toBeVisible();

    // Left rail live P&L, Plan-R, Stop/Target Conditions, Worst case, Max reward
    const rail = page.getByLabel('Trade state of play');
    await expect(rail.getByText('+$600.00')).toBeVisible();
    await expect(rail.getByText('+0.75R')).toBeVisible();
    await expect(rail.getByText('-$1,400.00 (-1.75R)')).toBeVisible();
    await expect(rail.getByText('+$1,800.00 (+2.25R)')).toBeVisible();
    await expect(rail.getByText(/\$14,600\.00.*if NVDA goes to zero/)).toBeVisible();
    await expect(rail.getByText(/Max reward:.*no cap above/)).toBeVisible();

    // Today drawer -> Marks comparison + PriceTrack
    await page.getByRole('tab', { name: 'Today' }).click();
    await expect(page.getByRole('heading', { name: /^Marks:/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Where the price sits' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Today mark comparison' })).toBeVisible();

    // Price History drawer -> completed sessions + permanent Review link
    await page.getByRole('tab', { name: 'Price History' }).click();
    await expect(
      page.getByRole('heading', { name: 'Price History (Completed Sessions)' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enter Marks in the Review' })).toBeVisible();

    // Check axe WCAG AA on C. Cockpit
    const cockpitAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(cockpitAxe.violations).toEqual([]);

    // 6. Offline reload preserves Marks and live P&L
    await context.setOffline(true);
    await page.reload();
    await page
      .getByRole('navigation', { name: 'Workspace sections' })
      .getByRole('button', { name: 'Trades' })
      .click();
    await expect(page.getByRole('cell', { name: /\+\$600\.00/ })).toBeVisible({ timeout: 15_000 });
    await context.setOffline(false);
  });
});
