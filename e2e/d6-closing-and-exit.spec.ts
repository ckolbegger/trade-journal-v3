import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('D6 Closing & Partial Stock Exits, FIFO Lot Matches, Exit Action, & Stop-Discipline Reconciliation', () => {
  test('supports multi-day Hold StopDiscipline episode, Exit Action (OV-02 & OV-05), partial FIFO exit + Fee reconciliation, Close Reason closure, Closed Cockpit & Trades filter, offline reload, and passes axe WCAG AA', async ({
    page,
    context,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // Day 1: Thu Nov 19, 2026 after close (22:00 UTC = 17:00 ET)
    await page.clock.setFixedTime(new Date('2026-11-19T22:00:00Z'));
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

    const nav = page.getByRole('navigation', { name: 'Workspace sections' });

    // Trade 1: AXIO (100 sh @ $50, Stop $47, Target $56)
    await nav.getByRole('button', { name: 'New Plan' }).click();
    await page.getByLabel('Symbol').fill('AXIO');
    await page.getByLabel('Shares').fill('100');
    await page.getByLabel('Intended Entry ($)').fill('50.00');
    await page.getByLabel('Stop Price ($)').fill('47.00');
    await page.getByLabel('Target Price ($)').fill('56.00');
    await page.getByLabel(/Why this trade, why now/).fill('Breakout above 50.');
    await page.getByLabel(/What would invalidate/).fill('Close below 47.');
    await page.getByRole('button', { name: 'Confirm Plan' }).click();

    await page.getByRole('button', { name: 'Record entry' }).click();
    const entryPanel = page.getByRole('region', { name: /Record Opening Entry/ });
    await entryPanel.getByLabel(/^Shares/).fill('100');
    await entryPanel.getByLabel('Fill Price ($)').fill('50.00');
    await entryPanel.getByLabel('Fee ($)').fill('2.00');
    await entryPanel.getByRole('button', { name: 'Save Opening Entry' }).click();
    await expect(page.getByText('100 of 100 shares open')).toBeVisible();

    // Trade 2: NVDA (100 sh @ $140, Stop $132, Target $164) in 2 FIFO opening lots:
    // Lot 1: 60 sh @ $139.00, fee $1.20; Lot 2: 40 sh @ $141.00, fee $0.80
    await nav.getByRole('button', { name: 'New Plan' }).click();
    await page.getByLabel('Symbol').fill('NVDA');
    await page.getByLabel('Shares').fill('100');
    await page.getByLabel('Intended Entry ($)').fill('140.00');
    await page.getByLabel('Stop Price ($)').fill('132.00');
    await page.getByLabel('Target Price ($)').fill('164.00');
    await page.getByLabel(/Why this trade, why now/).fill('Six-week base breakout.');
    await page.getByLabel(/What would invalidate/).fill('Close below 132.');
    await page.getByRole('button', { name: 'Confirm Plan' }).click();

    await page.getByRole('button', { name: 'Record entry' }).click();
    await entryPanel.getByLabel(/^Shares/).fill('60');
    await entryPanel.getByLabel('Fill Price ($)').fill('139.00');
    await entryPanel.getByLabel('Fee ($)').fill('1.20');
    await entryPanel.getByRole('button', { name: 'Save Opening Entry' }).click();
    await expect(page.getByText('60 of 100 shares open')).toBeVisible();

    await page.getByRole('button', { name: 'Record entry' }).click();
    await entryPanel.getByLabel(/^Shares/).fill('40');
    await entryPanel.getByLabel('Fill Price ($)').fill('141.00');
    await entryPanel.getByLabel('Fee ($)').fill('0.80');
    await entryPanel.getByLabel('Complete now').check();
    await entryPanel.getByLabel('Decision mode').selectOption('As Planned');
    await entryPanel.getByLabel('Primary emotion').selectOption('Calm');
    await entryPanel.getByLabel(/Decision confidence/).selectOption('4');
    await entryPanel.getByRole('button', { name: 'Save Opening Entry' }).click();
    await expect(page.getByText('100 of 100 shares open')).toBeVisible();

    // Open Day 1 Review (Thu Nov 19)
    await nav.getByRole('button', { name: 'Review' }).click();
    const dayRegion = page.getByRole('region', { name: 'The day' });
    await expect(dayRegion.getByText(/Nov 19/)).toBeVisible();

    // Enter Marks: AXIO = 45.50 (Past Stop), NVDA = 144.00 (Inside)
    await page.getByLabel('AXIO closing mark').fill('45.50');
    await page.getByRole('button', { name: 'Confirm 45.50' }).click();
    await page.getByLabel('NVDA closing mark').fill('144.00');
    await page.getByRole('button', { name: 'Save Marks' }).click();

    // Expand AXIO (Past Stop #1) -> confirm Hold + Exit buttons, save strict Hold
    const tradesRegion = page.getByRole('region', { name: 'Open trades to review' });
    await tradesRegion.getByRole('button', { name: /AXIO/ }).click();
    const axioForm = tradesRegion.getByRole('form', { name: 'Action, AXIO' });
    await expect(axioForm.getByRole('button', { name: 'Hold', exact: true })).toBeVisible();
    await expect(axioForm.getByRole('button', { name: 'Exit', exact: true })).toBeVisible();
    await axioForm.getByRole('button', { name: 'Hold', exact: true }).click();
    await axioForm.getByLabel('AXIO action reason').fill('Holding above weekly support.');
    await axioForm.getByRole('button', { name: 'Save Hold' }).click();

    // Expand NVDA (Inside lines) -> pick Exit leaving the Plan -> OV-02 requires reason
    await tradesRegion.getByRole('button', { name: /NVDA/ }).click();
    const nvdaForm = tradesRegion.getByRole('form', { name: 'Action, NVDA' });
    await nvdaForm.getByRole('button', { name: 'Exit', exact: true }).click();
    await expect(nvdaForm.getByText(/Why leave the Plan\?/)).toBeVisible();
    await nvdaForm.getByRole('button', { name: 'Save Exit' }).click();
    await expect(nvdaForm.getByRole('alert')).toContainText(
      'Neither the Stop nor the Target is reached',
    );
    await nvdaForm.getByLabel('NVDA action reason').fill('Trimming into strength.');
    await nvdaForm.getByRole('button', { name: 'Save Exit' }).click();

    // Resolve the 2 due Position Change Reflections before Day 1 completes
    const dueRegion = page.getByRole('region', { name: 'Due reflections' });
    const saveReflection = dueRegion.getByRole('button', { name: 'Save Reflection' });
    await expect(saveReflection).toHaveCount(2);
    await saveReflection.first().click();
    await expect(saveReflection).toHaveCount(1);
    await saveReflection.first().click();

    // Verify Complete Day card shows BOTH Hold AXIO and Exit NVDA
    const completeDay = page.getByRole('region', { name: 'The day, complete' });
    await expect(completeDay).toBeVisible();
    await expect(completeDay.getByText(/Hold AXIO/)).toBeVisible();
    await expect(completeDay.getByText(/Exit NVDA/)).toBeVisible();

    // Day 2: Advance clock to Fri Nov 20, 2026 after close and reopen the app for Friday's Review
    await page.clock.setFixedTime(new Date('2026-11-20T22:00:00Z'));
    await page.reload();
    await nav.getByRole('button', { name: 'Review' }).click();

    await expect(dayRegion.getByText(/Nov 20/)).toBeVisible();

    // Enter Day 2 Marks: AXIO = 46.00 (still Past Stop), NVDA = 146.00
    await page.getByLabel('AXIO closing mark').fill('46.00');
    await page.getByLabel('NVDA closing mark').fill('146.00');
    await page.getByRole('button', { name: 'Save Marks' }).click();

    // Verify OV-05 stale-Exit banner for NVDA in The day card
    await expect(dayRegion.getByText(/Nov 19 you chose Exit on NVDA/)).toBeVisible();

    // Record Hold past Stop again on AXIO -> triggers StopDiscipline episode (single episode)
    await tradesRegion.getByRole('button', { name: /AXIO/ }).click();
    await axioForm.getByRole('button', { name: 'Hold', exact: true }).click();
    await axioForm.getByLabel('AXIO action reason').fill('Waiting one more session.');
    await axioForm.getByRole('button', { name: 'Save Hold' }).click();
    await expect(tradesRegion.getByText(/Stop-Discipline Deviation \(1\)/)).toBeVisible();

    // Use OV-05 "I sold: record it" on NVDA to record a partial FIFO exit (70 of 100 sh @ $146, fee $1.40)
    await dayRegion.getByRole('button', { name: 'I sold: record it' }).click();
    const nvdaExitPanel = tradesRegion.getByRole('region', { name: /Record Exit — NVDA/ });
    await expect(nvdaExitPanel).toBeVisible();
    await nvdaExitPanel.getByLabel('Shares to Sell').fill('70');
    await nvdaExitPanel.getByLabel('Fill Price ($)').fill('146.00');
    await nvdaExitPanel.getByLabel('Fee ($)').fill('1.40');
    await expect(nvdaExitPanel.getByText(/Leaves the Plan:/)).toBeVisible();
    await nvdaExitPanel.getByRole('button', { name: 'Save Exit' }).click();

    // NVDA stays Open with 30 shares remaining and solid realized layer in Review
    await expect(tradesRegion.getByText('Long 30 shares')).toBeVisible();
    await expect(tradesRegion.getByText(/Realized \(\+?\$467\.20\)/)).toBeVisible();

    // Inspect NVDA in Cockpit -> check Position drawer (Open lots, Lot Matches, Fee reconciliation)
    await tradesRegion.getByRole('button', { name: 'Inspect' }).click();
    const cockpit = page.getByRole('region', { name: /NVDA/ }).first();
    await expect(cockpit.getByText('30 of 100 shares open')).toBeVisible();
    await cockpit.getByRole('tab', { name: /Position \(1\)/ }).click();
    const lotMatchesTable = cockpit.getByRole('table', { name: 'Lot Matches' });
    await expect(lotMatchesTable).toBeVisible();
    await expect(lotMatchesTable.locator('tbody tr')).toHaveCount(2);
    await expect(lotMatchesTable).toContainText('$417.60');
    await expect(lotMatchesTable).toContainText('$49.60');

    // Open collapsible Fee reconciliation
    const feeDetails = cockpit.locator('details').filter({ hasText: 'Fee reconciliation' });
    await feeDetails.locator('summary').click();
    await expect(feeDetails).toContainText('$3.40'); // total incurred: 1.20 + 0.80 + 1.40
    await expect(feeDetails).toContainText('$0.60'); // unconsumed opening fee left on 30 sh

    // Record remaining 30 shares closing exit via Cockpit -> require Close Reason
    await page.getByRole('button', { name: 'Record exit' }).click();
    const exitPanel = page.getByRole('region', { name: /Record Exit — NVDA/ });
    await exitPanel.getByLabel('Shares to Sell').fill('30');
    await exitPanel.getByLabel('Fill Price ($)').fill('165.00');
    await exitPanel.getByLabel('Fee ($)').fill('0.60');
    await exitPanel.getByRole('button', { name: 'Save & Close Trade' }).click();
    await expect(exitPanel.getByRole('alert')).toContainText('Close Reason is required');

    await exitPanel.getByLabel('Close Reason (required)').selectOption({ label: 'Target Reached' });
    await exitPanel.getByRole('button', { name: 'Save & Close Trade' }).click();

    // Verify Closed Cockpit state
    await expect(page.getByText('0 of 100 shares open')).toBeVisible();
    const resultCard = page.getByRole('region', { name: 'Result' });
    await expect(resultCard).toBeVisible();
    await expect(resultCard).toContainText('Closed via sale of 100 shares');
    await expect(resultCard).toContainText('Target Reached');
    await expect(resultCard).toContainText('Scaled');
    await expect(page.getByRole('tab', { name: 'Today' })).toHaveCount(0);

    // Check Plan vs. What happened table
    await page.getByRole('tab', { name: 'Plan and Risk' }).click();
    const planTable = page.getByRole('table', { name: 'Plan vs. What happened' });
    await expect(planTable).toBeVisible();
    await expect(planTable).toContainText('+$1,186.00');

    // Check axe WCAG AA on Closed Cockpit
    const cockpitAxe = await new AxeBuilder({ page }).analyze();
    expect(cockpitAxe.violations).toEqual([]);

    // Check Trades list 'Closed' filter
    await page.getByRole('button', { name: '← Back to Trades' }).click();
    await page
      .getByRole('group', { name: 'Filter by lifecycle state' })
      .getByRole('button', { name: 'Closed' })
      .click();
    const tradesTable = page.getByRole('table', { name: 'Trades list' });
    await expect(tradesTable).toContainText('NVDA');
    await expect(tradesTable).toContainText('Target Reached');

    // Check AXIO StopDiscipline Deviation on Plan & Risk drawer
    await page
      .getByRole('group', { name: 'Filter by lifecycle state' })
      .getByRole('button', { name: 'Open' })
      .click();
    await tradesTable.getByRole('button', { name: 'Inspect' }).click();
    await page.getByRole('tab', { name: 'Plan and Risk' }).click();
    await expect(page.getByText(/StopDiscipline:/)).toBeVisible();

    // Check Review WCAG AA
    await nav.getByRole('button', { name: 'Review' }).click();
    await expect(page.getByRole('heading', { name: /Review ·/ })).toBeVisible();
    const reviewAxe = await new AxeBuilder({ page }).analyze();
    expect(reviewAxe.violations).toEqual([]);

    // Verify offline cold reload preserves Closed NVDA & AXIO StopDiscipline
    await context.setOffline(true);
    await page.reload();
    await expect(nav).toBeVisible();
    await nav.getByRole('button', { name: 'Trades' }).click();
    await page
      .getByRole('group', { name: 'Filter by lifecycle state' })
      .getByRole('button', { name: 'Closed' })
      .click();
    await expect(page.getByRole('table', { name: 'Trades list' })).toContainText('NVDA');

    await page
      .getByRole('group', { name: 'Filter by lifecycle state' })
      .getByRole('button', { name: 'Open' })
      .click();
    await page.getByRole('table', { name: 'Trades list' }).getByRole('button', { name: 'Inspect' }).click();
    await page.getByRole('tab', { name: 'Plan and Risk' }).click();
    await expect(page.getByText(/StopDiscipline:/)).toBeVisible();

    await context.setOffline(false);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
