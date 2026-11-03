import {
  answerIn, closeReasonGroup, closeReviewGroup, closingSection, createTA, executionRow, exitReflection, expect, factsOf, fillRows, firstPage, launchAt, MONDAY_1700, onboardedAt, openExitForm,
  openTradeFromOpenList, probe, sell, test, tradesOf, TUESDAY_1405, TUESDAY_1405_LOCAL, valueOf, workspaceOf,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

test.describe('B6.3 Close requirements', () => {
  test('should show Choose a Close Reason beside the group with focus on the issues and the values kept, then save once a reason is chosen', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_1700);
    await createTA(setupPage);
    await setup.close();

    const context = await launchAt(profile, TUESDAY_1405);
    const page = await firstPage(context);
    await page.goto('/');
    await openTradeFromOpenList(page, 'XYZ');
    await openExitForm(page);
    await fillRows(page, [sell('100', '53.00', '1.40', TUESDAY_1405_LOCAL)]);
    await answerIn(exitReflection(page));
    // The full exit shows Closing the Trade; the Close Reason is left unchosen and the Close Review is deferred.
    await expect(closingSection(page)).toBeVisible();
    await expect(closeReasonGroup(page).getByRole('radio', { checked: true })).toHaveCount(0);
    await closeReviewGroup(page).getByLabel('Reflect later').check();
    await page.getByRole('button', { name: 'Save exit' }).click();

    // The message is beside the Close Reason group, the group is marked invalid, and the issue summary has focus.
    const summary = page.getByRole('region', { name: 'This exit can’t be saved yet' });
    await expect(summary).toContainText('Choose a Close Reason.');
    await expect(summary).toBeFocused();
    await expect(closingSection(page).locator('.field-error')).toHaveText('Choose a Close Reason.');
    await expect(closeReasonGroup(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('heading', { name: 'Record exit', level: 1 })).toBeVisible();

    // Nothing was lost: the values are kept.
    await expect(executionRow(page, 1).getByLabel('Quantity')).toHaveValue('100');
    await expect(executionRow(page, 1).getByLabel('Price')).toHaveValue('53.00');
    await expect(executionRow(page, 1).getByLabel('Fee')).toHaveValue('1.40');
    await expect(executionRow(page, 1).getByLabel('Economic Time')).toHaveValue(TUESDAY_1405_LOCAL);
    await expect(exitReflection(page).getByRole('radiogroup', { name: 'Decision mode' }).getByLabel('As Planned')).toBeChecked();
    await expect(closeReviewGroup(page).getByLabel('Reflect later')).toBeChecked();

    // Nothing was saved either: the Trade is still Open with no Sell.
    const unsaved = workspaceOf(await probe(page))!;
    expect(factsOf(tradesOf(unsaved)[0]!, 'Execution').filter((f) => f.versions.at(-1)!.value['action'] === 'Sell')).toHaveLength(0);
    expect(tradesOf(unsaved)[0]!.lifecycle).toBe('Open');

    // Choosing a reason saves the exit.
    await closeReasonGroup(page).getByLabel('Target Reached', { exact: true }).check();
    await page.getByRole('button', { name: 'Save exit' }).click();
    await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Result' })).toContainText('Target Reached');
    const saved = workspaceOf(await probe(page))!;
    expect(tradesOf(saved)[0]!.lifecycle).toBe('Closed');
    expect((tradesOf(saved)[0] as unknown as { closeReasonFacts: unknown[] }).closeReasonFacts).toHaveLength(1);
    await context.close();
  });
});

test.describe('B6.4 Oversell', () => {
  test('should refuse an exit of 101 shares on a 100-share Position with Only 100 shares are open beside the row and save nothing', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_1700);
    await createTA(setupPage);
    await setup.close();

    const context = await launchAt(profile, TUESDAY_1405);
    const page = await firstPage(context);
    await page.goto('/');
    await openTradeFromOpenList(page, 'XYZ');
    await openExitForm(page);
    await fillRows(page, [sell('101', '53.00', '1.40', TUESDAY_1405_LOCAL)]);
    await answerIn(exitReflection(page));
    await page.getByRole('button', { name: 'Save exit' }).click();

    const row = executionRow(page, 1);
    await expect(row.locator('.field-error')).toHaveText('Execution 1: Only 100 shares are open.');
    await expect(row.getByLabel('Quantity')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('region', { name: 'This exit can’t be saved yet' })).toContainText('Only 100 shares are open.');
    await expect(page.getByRole('heading', { name: 'Record exit', level: 1 })).toBeVisible();
    await expect(row.getByLabel('Quantity')).toHaveValue('101');

    // Nothing saved: a relaunch finds T-A Open with all 100 shares and no Sell.
    const workspace = workspaceOf(await probe(page))!;
    expect(factsOf(tradesOf(workspace)[0]!, 'Execution').filter((f) => f.versions.at(-1)!.value['action'] === 'Sell')).toHaveLength(0);
    await context.close();
    const relaunched = await launchAt(profile, TUESDAY_1405);
    const again = await firstPage(relaunched);
    await again.goto('/');
    await openTradeFromOpenList(again, 'XYZ');
    await expect(valueOf(again, 'Position')).toHaveText('100 shares of XYZ');
    await expect(again.getByRole('heading', { name: 'Lot Matches' })).toHaveCount(0);
    await relaunched.close();
  });
});
