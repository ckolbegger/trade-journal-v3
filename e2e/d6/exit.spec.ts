import {
  answerIn, closeTheTrade, closingSection, createTA, detail, executionRow, exitReflection, expect, factsOf, fillRows, firstPage, launchAt, lotMatchRecordsIn, MONDAY_1700, onboardedAt, openClosedTab,
  openDrawer, openExitForm, openTradeFromOpenList, probe, receiptResult, sell, setClock, test, tradesOf, TUESDAY_1000_LOCAL, TUESDAY_1405, TUESDAY_1405_LOCAL, valueOf, workspaceOf,
} from './support.ts';

const TUESDAY_1005 = '2026-10-13T14:05:00Z';
test.use({ actionTimeout: 15_000 });

test.describe('B6.1 Partial then final exit', () => {
  test('should keep T-A Open at 70 shares with one Lot Match and $55.90 realized after the first exit, close it at $248.00 and 0.99R after the second, and store the Sell Executions and the Close Reason fact with no Lot-Match record', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_1700);
    await createTA(setupPage);
    await setup.close();

    // Tuesday 10:05: Record exit 30 @ 52.00, fee 0.60, with the reflection. 30 of 100 shares closes nothing.
    const context = await launchAt(profile, TUESDAY_1005);
    const page = await firstPage(context);
    await page.goto('/');
    await openTradeFromOpenList(page, 'XYZ');
    await openExitForm(page);
    await fillRows(page, [sell('30', '52.00', '0.60', TUESDAY_1000_LOCAL)]);
    await expect(closingSection(page)).toHaveCount(0);
    await answerIn(exitReflection(page));
    await page.getByRole('button', { name: 'Save exit' }).click();
    await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible();
    await expect(receiptResult(page)).toContainText('Open');
    await expect(valueOf(receiptResult(page), 'Realized to date')).toContainText('$55.90');
    await page.getByRole('link', { name: 'Back to the Trade' }).click();
    await expect(detail.heading(page, 'XYZ')).toBeVisible();

    // Detail: Open, Position 70, one Lot Match, realized $55.90, no Closing section.
    await openDrawer(page, 'Position');
    await expect(detail.positionValue(page)).toHaveText('70 shares of XYZ');
    await expect(detail.lotMatches(page).locator('tbody tr')).toHaveCount(1);
    await expect(detail.positionRealizedToDate(page)).toContainText('$55.90');
    await expect(detail.lifecycle(page, 'Open')).toBeVisible();
    await expect(detail.resultHeading(page)).toHaveCount(0);
    await expect(detail.resultValue(page, 'Close Reason')).toHaveCount(0);

    // Tuesday 14:05: Record exit with two rows (50 and 20 @ 53.00). The Closing section appears once 70 is entered.
    await setClock(context, page, TUESDAY_1405);
    await openTradeFromOpenList(page, 'XYZ');
    await openExitForm(page);
    await fillRows(page, [sell('50', '53.00', '0.70', TUESDAY_1405_LOCAL)]);
    await expect(closingSection(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Add Execution' }).click();
    const second = executionRow(page, 2);
    await second.getByLabel('Quantity').fill('20');
    await second.getByLabel('Price').fill('53.00');
    await second.getByLabel('Fee').fill('0.70');
    await second.getByLabel('Economic Time').fill(TUESDAY_1405_LOCAL);
    await expect(closingSection(page)).toBeVisible();
    await closeTheTrade(page, 'now');
    await page.getByRole('button', { name: 'Save exit' }).click();
    await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible();
    await expect(valueOf(receiptResult(page), 'Lifecycle')).toHaveText('Closed');
    await context.close();

    // Relaunch: the Closed tab lists T-A, and its Detail reads from stored facts.
    const relaunched = await launchAt(profile, TUESDAY_1405);
    const again = await firstPage(relaunched);
    await openClosedTab(again);
    const row = again.getByRole('table', { name: 'Closed Trades' }).locator('tbody tr', { hasText: 'XYZ' });
    await expect(row).toContainText('Target Reached');
    await row.getByRole('link', { name: 'XYZ', exact: true }).click();
    await expect(detail.heading(again, 'XYZ')).toBeVisible();
    await expect(detail.lifecycle(again, 'Closed')).toBeVisible();
    await expect(detail.resultValue(again, 'Realized P&L')).toContainText('$248.00');
    await expect(detail.resultValue(again, 'Realized R')).toContainText('0.99R');
    await expect(detail.resultValue(again, 'Terminal Disposition')).toHaveText('Closed via sale of 100 shares');
    await expect(detail.resultValue(again, 'Close Reason')).toHaveText('Target Reached');

    // Durable state: the Sell Executions and the Close Reason fact, and no Lot-Match record.
    const workspace = workspaceOf(await probe(again))!;
    const [trade] = tradesOf(workspace);
    expect(trade!.lifecycle).toBe('Closed');
    const executions = factsOf(trade!, 'Execution').map((f) => f.versions.at(-1)!.value);
    expect(executions.filter((e) => e['action'] === 'Sell').map((e) => e['quantity'])).toEqual(['30', '50', '20']);
    // The Close Reason fact names the terminal exit, the last Position Change.
    const closeReasons = (trade as unknown as { closeReasonFacts: { kind: string; versions: { value: { terminalPositionChangeId: string } }[] }[] }).closeReasonFacts;
    expect(closeReasons.map((f) => f.kind)).toEqual(['CloseReason']);
    expect(closeReasons[0]!.versions.at(-1)!.value.terminalPositionChangeId).toBe(factsOf(trade!, 'PositionChange').at(-1)!.factId);
    expect(lotMatchRecordsIn(workspace)).toEqual([]);
    await relaunched.close();
  });
});
