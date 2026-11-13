import {
  answerIn, closeReasonGroup, closeTheTrade, closingSection, createTrades, createTA, detail, executionRow, exitReflection, expect, factsOf, FOUR_TRADES, fillRows, firstPage, launchAt, MONDAY_1700,
  onboardedAt, openDrawer, openExitForm, openTradeFromOpenList, probe, READY, receiptResult, sell, test, tradesOf, TUESDAY_1405, TUESDAY_1405_LOCAL, TUESDAY_1000_LOCAL, workspaceOf,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

const READ_ONLY = "Read only: this browser can't save right now";

test.describe('B6.9 Recovery Only (faults build)', () => {
  test('should keep the Closed list, Closed Detail, and Open Detail with Lot Matches readable with no Record exit, Reflect now, or Decline, and leave the probe unchanged', async ({ server, profile }) => {
    test.setTimeout(240_000);
    server.use('dist-faults');
    const { context: setup, page: first } = await onboardedAt(profile, MONDAY_1700);
    // XYZ is closed with its Close Review deferred (a Debt is owed); ABC is partly closed.
    await createTrades(first, FOUR_TRADES.slice(0, 2));
    await first.context().clock.setFixedTime(new Date(TUESDAY_1405));
    await first.goto('/');
    await openTradeFromOpenList(first, 'XYZ');
    await openExitForm(first);
    await fillRows(first, [sell('100', '53.00', '1.40', TUESDAY_1405_LOCAL)]);
    await closeTheTrade(first, 'later');
    await first.getByRole('button', { name: 'Save exit' }).click();
    await expect(first.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible();
    await first.goto('/');
    await openTradeFromOpenList(first, 'ABC');
    await openExitForm(first);
    await fillRows(first, [sell('40', '31.00', '0.50', TUESDAY_1000_LOCAL)]);
    await answerIn(exitReflection(first));
    await first.getByRole('button', { name: 'Save exit' }).click();
    await expect(first.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible();
    const before = await probe(first);
    await setup.close();

    const context = await launchAt(profile, TUESDAY_1405);
    const page = await firstPage(context);
    await page.goto('/?faults=control');
    await expect(page.getByRole('region', { name: READ_ONLY })).toBeVisible(READY);

    // The Closed list and Closed Detail are readable; the owed Close Review has no Reflect now or Decline.
    await page.getByRole('tab', { name: 'Closed' }).click();
    const row = page.getByRole('table', { name: 'Closed Trades' }).locator('tbody tr', { hasText: 'XYZ' });
    await expect(row).toContainText('Target Reached');
    await row.getByRole('link', { name: 'XYZ', exact: true }).click();
    await expect(detail.heading(page, 'XYZ')).toBeVisible(READY);
    await expect(detail.resultValue(page, 'Terminal Disposition')).toHaveText('Closed via sale of 100 shares');
    await expect(detail.resultValue(page, 'Close Reason')).toHaveText('Target Reached');
    await openDrawer(page, 'Position');
    await expect(detail.lotMatches(page).locator('tbody tr')).toHaveCount(2);
    await openDrawer(page, 'Journal');
    await expect(detail.closeReviewOwedHeading(page)).toBeVisible();
    await expect(detail.reflectionOwedExact(page)).toBeVisible();
    await expect(detail.reflectNowButton(page)).toHaveCount(0);
    await expect(detail.declineButton(page)).toHaveCount(0);
    await expect(detail.recordExitLink(page)).toHaveCount(0);

    // The partly closed Trade's Open Detail shows its Lot Match and the realized figure, with no Record exit.
    // (Navigation stays inside the app: a new page load without ?faults=control would be Writable again.)
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    await page.getByRole('tab', { name: 'Open' }).click();
    await expect(page.getByRole('table', { name: 'Open Trades' })).toBeVisible(READY);
    await openTradeFromOpenList(page, 'ABC');
    await openDrawer(page, 'Position');
    await expect(detail.positionValue(page)).toHaveText('60 shares of ABC');
    await expect(detail.lotMatches(page).locator('tbody tr')).toHaveCount(1);
    await openDrawer(page, 'Today');
    await expect(detail.realizedToDate(page)).toContainText('$39.10');
    await expect(detail.recordExitLink(page)).toHaveCount(0);
    await expect(detail.recordEntryLink(page)).toHaveCount(0);

    expect(await probe(page)).toEqual(before);
    await context.close();
  });
});

test.describe('B6.10 Mid-session failure (faults build, AC-DEL-006)', () => {
  test('should explain RuntimeNotWritable, keep the typed exit and its answers, and record no Position Change', async ({ server, profile }) => {
    test.setTimeout(240_000);
    server.use('dist-faults');
    const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_1700);
    await createTA(setupPage);
    await setup.close();

    const context = await launchAt(profile, TUESDAY_1405);
    const page = await firstPage(context);
    await page.goto('/');
    await openTradeFromOpenList(page, 'XYZ');
    await openExitForm(page);
    await fillRows(page, [sell('100', '53.00', '1.40', TUESDAY_1405_LOCAL)]);
    await closeTheTrade(page, 'now');
    const before = workspaceOf(await probe(page))!;

    await page.evaluate(() => window.__tjFaults?.set(['inventory']));
    await page.getByRole('button', { name: 'Save exit' }).click();

    const banner = page.getByRole('region', { name: READ_ONLY });
    await expect(banner).toBeVisible(READY);
    await expect(banner.getByRole('listitem')).toHaveText(["The app's offline copy is missing or damaged, so it could not reopen without a network."]);
    // The exit form is still there with every value, and nothing was recorded.
    await expect(page.getByRole('heading', { name: 'Record exit', level: 1 })).toBeVisible();
    await expect(executionRow(page, 1).getByLabel('Quantity')).toHaveValue('100');
    await expect(executionRow(page, 1).getByLabel('Price')).toHaveValue('53.00');
    await expect(exitReflection(page).getByRole('radiogroup', { name: 'Decision mode' }).getByLabel('As Planned')).toBeChecked();
    await expect(closeReasonGroup(page).getByLabel('Target Reached', { exact: true })).toBeChecked();
    await expect(closingSection(page).getByRole('radiogroup', { name: 'Would you take this Trade again under similar conditions?' }).getByLabel('Yes, as planned')).toBeChecked();
    await expect(receiptResult(page)).toHaveCount(0);
    const workspace = workspaceOf(await probe(page))!;
    expect(tradesOf(workspace)[0]!.lifecycle).toBe('Open');
    expect(factsOf(tradesOf(workspace)[0]!, 'PositionChange')).toHaveLength(2);
    expect(workspace).toEqual(before);
    await context.close();
  });
});
