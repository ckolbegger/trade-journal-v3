import {
  actionForm, AT_10, completion, confirmReference, continueToTrades, debtForm, debtsOf, deferEntry, enterMark, entriesWithSettledDebt, expect, fillDebtAnswers, firstPage, launchAt, markAndOpenCard, MONDAY, MONDAY_1005, onboardedAt,
  openReview, openTradeFromOpenList, probe, READY, reflectionsOf, setClock, test, TUESDAY, TUESDAY_1700, tradesFamily, workspaceOf,
} from './support.ts';

const READ_ONLY = "Read only: this browser can't save right now";

test.describe('B5.9 Recovery Only (faults build)', () => {
  test('should show the Outstanding Debt on Detail and in the Review with no Reflect now, Decline, or Save, and leave the probe unchanged', async ({ server, profile }) => {
    server.use('dist-faults');
    const { context: setup, page: first } = await onboardedAt(profile, MONDAY_1005);
    await confirmReference(first);
    await deferEntry(first, [AT_10]);
    await setClock(setup, first, TUESDAY_1700);
    await openReview(first);
    await enterMark(first, 'XYZ', MONDAY, '52.00');
    await enterMark(first, 'XYZ', TUESDAY, '52.50');
    const before = await probe(first);
    await setup.close();

    const context = await launchAt(profile, TUESDAY_1700);
    const page = await firstPage(context);
    await page.goto('/?faults=control');
    await expect(page.getByRole('region', { name: READ_ONLY })).toBeVisible(READY);

    // The Review lists the reflection as Due in the Trade's card, with no way to open it.
    await openReview(page);
    await expect(completion(page)).toHaveText('Incomplete');
    await continueToTrades(page);
    await tradesFamily(page).getByRole('button', { name: 'Review XYZ' }).click();
    await expect(page.getByRole('region', { name: 'XYZ review', exact: true })).toBeVisible();
    await expect(reflectionsOf(page, 'XYZ').getByText('Due', { exact: true })).toBeVisible();
    // The card's "Reflect on <time>" button (the Review's equivalent of Reflect now) is still offered in
    // Recovery Only; it opens the prompts read only. What must be absent is every control that answers,
    // declines, or saves (reading of B5.9 and C5.9, reported to the main session).
    await reflectionsOf(page, 'XYZ').getByRole('button', { name: /^Reflect on / }).click();
    await expect(debtForm(page).getByRole('radiogroup', { name: 'Decision mode' }).getByLabel('As Planned')).toBeDisabled();
    await expect(debtForm(page).getByRole('button', { name: 'Answer', exact: true })).toHaveCount(0);
    await expect(debtForm(page).getByRole('button', { name: 'Decline', exact: true })).toHaveCount(0);
    await expect(actionForm(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);

    // Detail shows the Debt as owed, with no Reflect now or Decline.
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    await openTradeFromOpenList(page);
    await expect(page.getByText('Reflection owed')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reflect now' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Decline', exact: true })).toHaveCount(0);
    await expect(debtForm(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Answer', exact: true })).toHaveCount(0);

    expect(await probe(page)).toEqual(before);
    await context.close();
  });
});

test.describe('B5.10 Mid-session failure (faults build, AC-DEL-006)', () => {
  test('should explain RuntimeNotWritable, keep the typed Debt answer, and record no Entry', async ({ server, profile }) => {
    server.use('dist-faults');
    const { context, page } = await onboardedAt(profile, MONDAY_1005);
    await confirmReference(page);
    await deferEntry(page, [AT_10]);
    await setClock(context, page, TUESDAY_1700);
    await openReview(page);
    await enterMark(page, 'XYZ', MONDAY, '52.00');
    await markAndOpenCard(page, 'XYZ', TUESDAY, '52.50');
    await reflectionsOf(page, 'XYZ').getByRole('button', { name: /^Reflect on / }).click();
    await fillDebtAnswers(page);
    const before = workspaceOf(await probe(page))!;

    await page.evaluate(() => window.__tjFaults?.set(['inventory']));
    await debtForm(page).getByRole('button', { name: 'Answer', exact: true }).click();

    const banner = page.getByRole('region', { name: READ_ONLY });
    await expect(banner).toBeVisible(READY);
    await expect(banner.getByRole('listitem')).toHaveText(["The app's offline copy is missing or damaged, so it could not reopen without a network."]);
    // The values are kept and nothing is recorded.
    const form = debtForm(page);
    await expect(form.getByRole('radiogroup', { name: 'Decision mode' }).getByLabel('As Planned')).toBeChecked();
    await expect(form.getByRole('radiogroup', { name: 'Primary emotion' }).getByLabel('Calm')).toBeChecked();
    await expect(form.getByRole('radiogroup', { name: 'Decision confidence' }).getByLabel('4')).toBeChecked();
    await expect(completion(page)).toHaveText('Incomplete');
    const workspace = workspaceOf(await probe(page))!;
    expect(entriesWithSettledDebt(workspace)).toEqual([]);
    expect(debtsOf(workspace)).toHaveLength(1);
    expect(workspace).toEqual(before);
    await context.close();
  });
});
