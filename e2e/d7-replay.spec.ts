import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

async function initWorkspaceWithMarginAccount(page: Page, fixedIso: string): Promise<Locator> {
  await page.clock.setFixedTime(new Date(fixedIso));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Initialize Local Workspace' })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel('IANA Time Zone').fill('America/New_York');
  await page.getByRole('button', { name: 'Initialize Workspace' }).click();

  await page.getByLabel('Institution name').fill('Fidelity');
  await page.getByRole('button', { name: 'Add Institution' }).click();
  await page.getByLabel('Add account under Fidelity').fill('Margin');
  await page.getByRole('button', { name: 'Add Account' }).click();
  return page.getByRole('navigation', { name: 'Workspace sections' });
}

async function createAndOpenTrade(
  page: Page,
  nav: Locator,
  params: {
    readonly symbol: string;
    readonly shares: string;
    readonly entry: string;
    readonly stop: string;
    readonly target: string;
    readonly why: string;
    readonly invalidation: string;
    readonly openNow?: boolean;
  },
): Promise<void> {
  await nav.getByRole('button', { name: 'New Plan' }).click();
  await page.getByLabel('Symbol').fill(params.symbol);
  await page.getByLabel('Shares').fill(params.shares);
  await page.getByLabel('Intended Entry ($)').fill(params.entry);
  await page.getByLabel('Stop Price ($)').fill(params.stop);
  await page.getByLabel('Target Price ($)').fill(params.target);
  await page.getByLabel(/Why this trade, why now/).fill(params.why);
  await page.getByLabel(/What would invalidate/).fill(params.invalidation);
  await page.getByRole('button', { name: 'Confirm Plan' }).click();

  if (!params.openNow) return;

  await page.getByRole('button', { name: 'Record entry' }).click();
  const entryPanel = page.getByRole('region', { name: /Record Opening Entry/ });
  await entryPanel.getByLabel(/^Shares/).fill(params.shares);
  await entryPanel.getByLabel('Fill Price ($)').fill(params.entry);
  await entryPanel.getByLabel('Fee ($)').fill('0.00');
  await entryPanel.getByLabel('Complete now').check();
  await entryPanel.getByLabel('Decision mode').selectOption('As Planned');
  await entryPanel.getByLabel('Primary emotion').selectOption('Calm');
  await entryPanel.getByLabel(/Decision confidence/).selectOption('4');
  await entryPanel.getByRole('button', { name: 'Save Opening Entry' }).click();
  await expect(entryPanel).toBeHidden();
  await expect(
    page.getByText(`${params.shares} of ${params.shares} shares open`, { exact: true }),
  ).toBeVisible();
}

function attachRuntimeErrorCollectors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });
  return { consoleErrors, pageErrors };
}

test.describe('D7 Interactive Trade Replay — Corridor, Gaps, Moments, Readout, & Continuity', () => {
  test('enforces Open positive control vs Planned exclusion, focus restore, and offline cold-restart Replay data reconstruction', async ({
    page,
    context,
  }) => {
    const { consoleErrors, pageErrors } = attachRuntimeErrorCollectors(page);
    const nav = await initWorkspaceWithMarginAccount(page, '2026-11-16T22:00:00Z');

    await test.step('Positive control: Open Trade Cockpit Card 1 exposes Replay and restores focus on close', async () => {
      await createAndOpenTrade(page, nav, {
        symbol: 'AXIO',
        shares: '100',
        entry: '50.00',
        stop: '47.00',
        target: '56.00',
        why: 'Base breakout above 50.',
        invalidation: 'Daily close below 47.',
        openNow: true,
      });

      const cockpitReplayBtn = page.getByRole('main').getByRole('button', {
        name: 'Replay',
        exact: true,
      });
      await expect(cockpitReplayBtn).toHaveCount(1);
      await cockpitReplayBtn.click();

      const dialog = page.getByRole('dialog', { name: 'Replay, AXIO' });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('Replay · AXIO · Long 100 shares');
      await dialog.getByRole('button', { name: 'Back to Trade' }).click();
      await expect(dialog).toBeHidden();
      await expect(cockpitReplayBtn).toBeFocused();
    });

    await test.step('Planned exclusion: Planned Trade Cockpit omits Replay trigger', async () => {
      await createAndOpenTrade(page, nav, {
        symbol: 'PLND',
        shares: '50',
        entry: '30.00',
        stop: '28.00',
        target: '34.00',
        why: 'Watchlist setup.',
        invalidation: 'Break below 28.',
        openNow: false,
      });
      await expect(page.getByText('0 of 50 shares open', { exact: true })).toBeVisible();
      await expect(
        page.getByRole('main').getByRole('button', { name: 'Replay', exact: true }),
      ).toHaveCount(0);
    });

    await test.step('Save a closing Mark and verify offline cold restart reconstructs full Replay from IndexedDB', async () => {
      await nav.getByRole('button', { name: 'Review' }).click();
      await expect(page.getByRole('region', { name: 'The day' })).toContainText('Nov 16');
      await page.getByLabel('AXIO closing mark').fill('49.00');
      await page.getByRole('button', { name: 'Save Marks' }).click();
      await expect(page.getByText(/1 · Marks saved for/)).toBeVisible();

      await context.setOffline(true);
      try {
        await page.reload();
        await nav.getByRole('button', { name: 'Trades' }).click();
        await page.getByRole('button', { name: 'Open', exact: true }).click();
        await page.getByRole('row', { name: /AXIO/ }).getByRole('button', { name: 'Inspect' }).click();

        const cockpitReplayBtn = page.getByRole('main').getByRole('button', {
          name: 'Replay',
          exact: true,
        });
        await cockpitReplayBtn.click();

        const offlineDialog = page.getByRole('dialog', { name: 'Replay, AXIO' });
        await expect(offlineDialog).toBeVisible({ timeout: 15_000 });
        await expect(offlineDialog).toContainText('Replay · AXIO · Long 100 shares');
        const readout = offlineDialog.getByRole('complementary', { name: 'Session readout' });
        await expect(readout.locator('dt:text-is("Trade P&L") + dd')).toContainText('-$100.00');
        await expect(readout.locator('dt:text-is("Realized") + dd')).toHaveText('$0.00');
        await expect(readout.locator('dt:text-is("Open") + dd')).toHaveText('-$100.00');
        await expect(readout.locator('dt:text-is("AXIO Mark") + dd')).toHaveText('$49.00');

        await offlineDialog.getByRole('button', { name: 'Back to Trade' }).click();
        await expect(cockpitReplayBtn).toBeFocused();
      } finally {
        await context.setOffline(false);
      }
    });

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('renders multi-session Corridor with Stop breach, missing-Mark gap, FIFO shrink, unsaved draft preservation, Closed card Replay without D8 controls, Price History deep-link focus, mobile layout, and WCAG AA', async ({
    page,
  }) => {
    const { consoleErrors, pageErrors } = attachRuntimeErrorCollectors(page);
    const nav = await initWorkspaceWithMarginAccount(page, '2026-11-16T22:00:00Z');
    const tradesRegion = page.getByRole('region', { name: 'Open trades to review' });

    await test.step('Seed 4-session timeline for AXIO (open partial exit + gap + breach) and BREN (closed winner)', async () => {
      await createAndOpenTrade(page, nav, {
        symbol: 'AXIO',
        shares: '100',
        entry: '50.00',
        stop: '47.00',
        target: '56.00',
        why: 'Base breakout above 50.',
        invalidation: 'Daily close below 47.',
        openNow: true,
      });
      await createAndOpenTrade(page, nav, {
        symbol: 'BREN',
        shares: '100',
        entry: '80.00',
        stop: '76.00',
        target: '88.00',
        why: 'Reclaim above 80 pivot.',
        invalidation: 'Daily close below 76.',
        openNow: true,
      });

      // Day 1 Review (Nov 16)
      await nav.getByRole('button', { name: 'Review' }).click();
      await expect(page.getByRole('region', { name: 'The day' })).toContainText('Nov 16');
      await page.getByLabel('AXIO closing mark').fill('49.00');
      await page.getByLabel('BREN closing mark').fill('82.00');
      await page.getByRole('button', { name: 'Save Marks' }).click();
      await expect(page.getByText(/1 · Marks saved for/)).toBeVisible();
      await tradesRegion.getByRole('button', { name: /AXIO/ }).click();
      await tradesRegion.getByRole('button', { name: 'Save Hold' }).click();
      await tradesRegion.getByRole('button', { name: /BREN/ }).click();
      await tradesRegion.getByRole('button', { name: 'Save Hold' }).click();
      await expect(page.getByRole('region', { name: 'The day, complete' })).toBeVisible();

      // Day 2 Review (Nov 17): AXIO breaches Stop @ 46.50, Held with reason
      await page.clock.setFixedTime(new Date('2026-11-17T22:00:00Z'));
      await page.reload();
      await nav.getByRole('button', { name: 'Review' }).click();
      await expect(page.getByRole('region', { name: 'The day' })).toContainText('Nov 17', {
        timeout: 15_000,
      });
      await page.getByLabel('AXIO closing mark').fill('46.50');
      await page.getByRole('button', { name: 'Confirm 46.50' }).click();
      await page.getByLabel('BREN closing mark').fill('85.00');
      await page.getByRole('button', { name: 'Save Marks' }).click();
      await expect(page.getByText(/1 · Marks saved for/)).toBeVisible();

      await page.getByRole('region', { name: 'The day' }).getByRole('button', { name: 'Next: AXIO' }).click();
      const axioFormDay2 = tradesRegion.getByRole('form', { name: 'Action, AXIO' });
      await axioFormDay2.getByRole('button', { name: 'Hold', exact: true }).click();
      await axioFormDay2.getByLabel('AXIO action reason').fill('Holding past stop on volume test.');
      await axioFormDay2.getByRole('button', { name: 'Save Hold' }).click();

      await page.getByRole('region', { name: 'The day' }).getByRole('button', { name: 'Next: BREN' }).click();
      const brenFormDay2 = tradesRegion.getByRole('form', { name: 'Action, BREN' });
      await brenFormDay2.getByRole('button', { name: 'Save Hold' }).click();
      await expect(page.getByRole('region', { name: 'The day, complete' })).toBeVisible();

      // Day 3 (Nov 18): AXIO Unavailable gap, BREN closed at $89.00 Target
      await page.clock.setFixedTime(new Date('2026-11-18T22:00:00Z'));
      await page.reload();
      await nav.getByRole('button', { name: 'Review' }).click();
      await expect(page.getByRole('region', { name: 'The day' })).toContainText('Nov 18', {
        timeout: 15_000,
      });
      await page.getByRole('row', { name: /AXIO/ }).getByRole('button', { name: "Can't get a price" }).click();
      await expect(page.getByText('No price today')).toBeVisible();
      await page.getByLabel('BREN closing mark').fill('89.00');
      await page.getByRole('button', { name: 'Save Marks' }).click();
      await expect(page.getByText(/1 · Marks saved for/)).toBeVisible();

      await nav.getByRole('button', { name: 'Trades' }).click();
      await page.getByRole('button', { name: 'Open', exact: true }).click();
      await page.getByRole('row', { name: /BREN/ }).getByRole('button', { name: 'Inspect' }).click();
      await page.getByRole('button', { name: 'Record exit' }).click();
      const exitPanel = page.getByRole('region', { name: /Record Exit — BREN/ });
      await exitPanel.getByLabel('Shares to Sell').fill('100');
      await exitPanel.getByLabel('Fill Price ($)').fill('89.00');
      await exitPanel.getByLabel('Fee ($)').fill('0.00');
      await exitPanel.getByLabel('Close Reason (required)').selectOption('cr_target_reached');
      await exitPanel.getByLabel('Complete now').check();
      await exitPanel.getByLabel('Decision mode').selectOption('As Planned');
      await exitPanel.getByLabel('Primary emotion').selectOption('Calm');
      await exitPanel.getByLabel(/Decision confidence/).selectOption('5');
      await exitPanel.getByRole('button', { name: 'Save & Close Trade' }).click();
      await expect(exitPanel).toBeHidden();
      await expect(page.getByText('0 of 100 shares open', { exact: true })).toBeVisible();

      // Day 4 (Nov 19): AXIO partial exit 50 @ $52.00 + Mark $53.00
      await page.clock.setFixedTime(new Date('2026-11-19T22:00:00Z'));
      await page.reload();
      await nav.getByRole('button', { name: 'Trades' }).click();
      await page.getByRole('button', { name: 'Open', exact: true }).click();
      await page.getByRole('row', { name: /AXIO/ }).getByRole('button', { name: 'Inspect' }).click();
      await page.getByRole('button', { name: 'Record exit' }).click();
      const axioExitPanel = page.getByRole('region', { name: /Record Exit — AXIO/ });
      await axioExitPanel.getByLabel('Shares to Sell').fill('50');
      await axioExitPanel.getByLabel('Fill Price ($)').fill('52.00');
      await axioExitPanel.getByLabel('Fee ($)').fill('0.00');
      await axioExitPanel.getByLabel('Complete now').check();
      await axioExitPanel.getByLabel('Decision mode').selectOption('As Planned');
      await axioExitPanel.getByLabel('Primary emotion').selectOption('Calm');
      await axioExitPanel.getByLabel(/Decision confidence/).selectOption('4');
      await axioExitPanel.getByRole('button', { name: 'Save Exit' }).click();
      await expect(axioExitPanel).toBeHidden();
      await expect(page.getByText('50 of 100 shares open', { exact: true })).toBeVisible();

      await nav.getByRole('button', { name: 'Review' }).click();
      await expect(page.getByRole('region', { name: 'The day' })).toContainText('Nov 19');
      await page.getByLabel('AXIO closing mark').fill('53.00');
      await page.getByRole('button', { name: 'Confirm 53.00' }).click();
      await expect(page.getByText(/1 · Marks saved for/)).toBeVisible();
    });

    await test.step('Save Day 4 draft and open Replay from Review', async () => {
      await tradesRegion.getByRole('button', { name: /AXIO/ }).click();
      const axioFormDay4 = tradesRegion.getByRole('form', { name: 'Action, AXIO' });
      await axioFormDay4.getByRole('button', { name: 'Hold', exact: true }).click();
      await axioFormDay4.getByLabel('AXIO action reason').fill('Draft note before opening replay');
      const reviewReplayBtn = tradesRegion.getByRole('button', { name: 'Replay', exact: true });
      await reviewReplayBtn.click();
    });

    const axioFormDay4 = tradesRegion.getByRole('form', { name: 'Action, AXIO' });
    const reviewReplayBtn = tradesRegion.getByRole('button', { name: 'Replay', exact: true });
    const axioDialog = page.getByRole('dialog', { name: 'Replay, AXIO' });
    const readout = axioDialog.getByRole('complementary', { name: 'Session readout' });

    await test.step('Verify FIFO shrink P&L separation, Key Moments Stop overrun ($50.00), gap, and table jump', async () => {
      await expect(axioDialog).toBeVisible();
      await expect(axioDialog).toContainText('Replay · AXIO · Long 50 shares');
      await expect(axioDialog.getByRole('img', { name: /AXIO Corridor Replay chart/ })).toBeVisible();

      await expect(readout.locator('dt:text-is("Trade P&L") + dd')).toContainText('+$250.00');
      await expect(readout.locator('dt:text-is("Realized") + dd')).toHaveText('+$100.00');
      await expect(readout.locator('dt:text-is("Open") + dd')).toHaveText('+$150.00');
      await expect(readout).toContainText('Sold 50 at $52.00');

      const momentsSelect = axioDialog.getByLabel('Key moments');
      const stopOptionValue = await momentsSelect
        .locator('option')
        .evaluateAll((opts) => {
          const hit = opts.find((o) => o.textContent?.includes('Stop · Tue, Nov 17'));
          return hit ? (hit as HTMLOptionElement).value : '';
        });
      expect(stopOptionValue).not.toBe('');
      await momentsSelect.selectOption(stopOptionValue);
      await expect(axioDialog).toContainText('Tue, Nov 17 · 2 of 4');
      await expect(readout).toContainText('Holding past stop on volume test.');
      await expect(readout).toContainText('$50.00 past Stop');

      await axioDialog.getByRole('button', { name: 'Later session' }).click();
      await expect(axioDialog).toContainText('Wed, Nov 18 · 3 of 4');
      await expect(readout.locator('dt:text-is("AXIO Mark") + dd')).toHaveText('No Mark');
      await expect(readout.locator('dt:text-is("Realized") + dd')).toHaveText('$0.00');
      await expect(readout.locator('dt:text-is("Trade P&L") + dd')).toHaveText('Unavailable');
      await expect(readout.locator('dt:text-is("Open") + dd')).toHaveText('Unavailable');

      await axioDialog.getByText('Accessible session table').click();
      const replayTable = axioDialog.getByRole('table', { name: 'Replay sessions' });
      await expect(replayTable).toBeVisible();
      await expect(replayTable).toContainText('No Mark');
      await replayTable.getByRole('button', { name: /Nov 16/ }).click();
      await expect(readout.locator('dt:text-is("AXIO Mark") + dd')).toHaveText('$49.00');
    });

    await test.step('Pass desktop WCAG AA and mobile 390x844 dialog internal non-overflow + WCAG AA', async () => {
      const desktopAxe = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      expect(desktopAxe.violations).toEqual([]);

      await page.setViewportSize({ width: 390, height: 844 });
      try {
        await expect
          .poll(() => axioDialog.evaluate((el) => el.scrollWidth <= el.clientWidth))
          .toBe(true);
        await expect
          .poll(() =>
            axioDialog.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          )
          .toBe(true);
        const mobileAxe = await new AxeBuilder({ page })
          .include('[role="dialog"]')
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze();
        expect(mobileAxe.violations).toEqual([]);
      } finally {
        await page.setViewportSize({ width: 1280, height: 800 });
      }
    });

    await test.step('Close Replay, confirm unsaved draft preservation and focus restore, then save Review', async () => {
      await axioDialog.getByRole('button', { name: 'Back to the Review' }).click();
      await expect(axioDialog).toBeHidden();
      await expect(reviewReplayBtn).toBeFocused();
      await expect(axioFormDay4.getByLabel('AXIO action reason')).toHaveValue(
        'Draft note before opening replay',
      );
      await axioFormDay4.getByRole('button', { name: 'Save Hold' }).click();
      await expect(page.getByRole('region', { name: 'The day, complete' })).toBeVisible();
    });

    await test.step('Inspect Closed BREN card (no Action controls), open Replay, and deep-link to Cockpit Price History', async () => {
      const closedRegion = page.getByRole('region', { name: 'Closed trades' });
      await expect(closedRegion).toBeVisible();
      const brenToggle = closedRegion.getByRole('button', { name: /BREN/ });
      await brenToggle.click();
      await expect(brenToggle).toHaveAttribute('aria-expanded', 'true');
      await expect(closedRegion.getByRole('button', { name: 'Replay', exact: true })).toBeVisible();
      await expect(closedRegion.locator('form, [role="form"]')).toHaveCount(0);
      await expect(
        closedRegion.getByRole('button', { name: /^(Hold|Save Hold|Save Exit|Exit)$/ }),
      ).toHaveCount(0);
      await expect(closedRegion.getByLabel(/action reason/i)).toHaveCount(0);

      await closedRegion.getByRole('button', { name: 'Replay', exact: true }).click();
      const brenDialog = page.getByRole('dialog', { name: 'Replay, BREN' });
      await expect(brenDialog).toBeVisible();
      await expect(
        brenDialog.getByRole('complementary', { name: 'Session readout' }).locator('dt:text-is("Trade P&L") + dd'),
      ).toContainText('+$900.00');
      await brenDialog.getByText('Accessible session table').click();
      await brenDialog.getByRole('button', { name: 'Open Price History in Trade Detail' }).click();

      await expect(brenDialog).toBeHidden();
      await expect(page.getByRole('tab', { name: 'Price History' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      const historyHeading = page.getByRole('heading', {
        name: 'Price History (Completed Sessions)',
      });
      await expect(historyHeading).toBeFocused();

      const historyPanel = page.getByRole('tabpanel', { name: 'Price History' });
      await expect(historyPanel).toBeVisible();
      await expect(historyPanel).toContainText('$89.00');

      const historyReplayBtn = historyPanel.getByRole('button', { name: 'Replay', exact: true });
      await historyReplayBtn.click();
      await expect(brenDialog).toBeVisible();
      await brenDialog.getByRole('button', { name: 'Back to Trade' }).click();
      await expect(brenDialog).toBeHidden();
      await expect(historyReplayBtn).toBeFocused();
    });

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
