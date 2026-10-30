import type { BrowserContext, Page } from '@playwright/test';
import {
  answerDebt, AT_10, backToTrade, completion, confirmReference, debtForm, debtsOf, declineDebt, declinesOf, entriesWithSettledDebt, expect, fillDebtAnswers, firstPage, launchAt, markAndOpenCard, MONDAY, MONDAY_1005, MONDAY_1700,
  onboardedAt, openReview, openTradeFromOpenList, probe, reflectionSection, reflectionsOf, reloadReview, saveAction, setClock, startEntry, status, test, TUESDAY, TUESDAY_1700, workspaceOf,
} from './support.ts';

// Monday 10:05: a deferred entry on the reference Plan. Monday 17:00: the Review's Mark and Hold, Complete without the reflection.
async function deferredThenMondayReview(profile: Parameters<typeof launchAt>[0]): Promise<{ context: BrowserContext; page: Page }> {
  const { context, page } = await onboardedAt(profile, MONDAY_1005);
  await confirmReference(page);

  // The form opens on Reflect now with the prompts shown.
  await startEntry(page, [AT_10]);
  await expect(reflectionSection(page).getByLabel('Reflect now')).toBeChecked();
  await expect(reflectionSection(page).getByRole('radiogroup', { name: 'Decision mode' })).toBeVisible();
  await reflectionSection(page).getByLabel('Reflect later').check();
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByRole('heading', { name: 'Entry recorded' })).toBeVisible();
  await expect(page.getByText('Reflection owed')).toBeVisible();
  await backToTrade(page);
  await expect(page.getByText('Reflection owed')).toBeVisible();

  // Monday's Review shows the reflection in XYZ's card as due in the next Review and reads Complete without it.
  await setClock(context, page, MONDAY_1700);
  await openReview(page);
  await markAndOpenCard(page, 'XYZ', MONDAY, '52.00');
  await expect(reflectionsOf(page, 'XYZ').getByText('Due in the next Review', { exact: true })).toBeVisible();
  await expect(reflectionsOf(page, 'XYZ').getByText('Due', { exact: true })).toHaveCount(0);
  await saveAction(page, 'Hold');
  await expect(completion(page)).toHaveText('Complete');
  return { context, page };
}

test.describe('B5.1 Defer, then answer in the Review', () => {
  test('should show Reflection owed on Detail, the reflection as due in the next Review on Monday, Due and Incomplete until answered on Tuesday, and after relaunch Complete with the Debt Settled and an Entry carrying settledDebtId', async ({ profile }) => {
    const { context, page } = await deferredThenMondayReview(profile);
    const monday = workspaceOf(await probe(page))!;
    expect(debtsOf(monday)).toHaveLength(1);
    expect(entriesWithSettledDebt(monday)).toHaveLength(0);

    // Tuesday's Review: the reflection is Due in XYZ's card, and the Review is Incomplete until it is answered.
    await setClock(context, page, TUESDAY_1700);
    await openReview(page);
    await expect(completion(page)).toHaveText('Incomplete');
    await markAndOpenCard(page, 'XYZ', TUESDAY, '52.50');
    await expect(reflectionsOf(page, 'XYZ').getByText('Due', { exact: true })).toBeVisible();
    await expect(completion(page)).toHaveText('Incomplete');
    await reflectionsOf(page, 'XYZ').getByRole('button', { name: /^Reflect on / }).click();
    await fillDebtAnswers(page);
    await answerDebt(page);
    await expect(completion(page)).toHaveText('Incomplete');
    await saveAction(page, 'Hold');
    await expect(completion(page)).toHaveText('Complete');
    await context.close();

    // Relaunch: the Review is Complete from stored facts.
    const relaunched = await launchAt(profile, TUESDAY_1700);
    const again = await firstPage(relaunched);
    await again.goto('/');
    await openReview(again);
    await expect(completion(again)).toHaveText('Complete');
    await expect(status(again)).not.toContainText('Incomplete');

    // Durable state: the Debt's Settled version and an Entry with settledDebtId naming it.
    const workspace = workspaceOf(await probe(again))!;
    const debts = debtsOf(workspace);
    expect(debts).toHaveLength(1);
    const settled = entriesWithSettledDebt(workspace);
    expect(settled).toHaveLength(1);
    expect(settled[0]!.settledDebtId).toBe(debts[0]!.debtId);
    expect(JSON.stringify(debts[0]!.versions.at(-1))).toContain('Settled');
    expect(declinesOf(workspace)).toHaveLength(0);
    await relaunched.close();
  });
});

test.describe('B5.2 Decline in the Review', () => {
  test('should read Complete after declining with a reason in Tuesday’s Review, show Declined later with the reason on Detail, and store a decline with settledDebtId', async ({ profile }) => {
    const { context, page } = await deferredThenMondayReview(profile);
    await setClock(context, page, TUESDAY_1700);
    await openReview(page);
    await markAndOpenCard(page, 'XYZ', TUESDAY, '52.50');
    // The Hold alone does not complete the Review while the reflection is owed.
    await saveAction(page, 'Hold');
    await expect(completion(page)).toHaveText('Incomplete');
    await reflectionsOf(page, 'XYZ').getByRole('button', { name: /^Reflect on / }).click();
    await expect(debtForm(page)).toBeVisible();
    await declineDebt(page, 'Too rushed to write it up.');
    await expect(completion(page)).toHaveText('Complete');
    await reloadReview(page);
    await expect(completion(page)).toHaveText('Complete');

    // Detail shows Declined later with the reason.
    await page.goto('/');
    await openTradeFromOpenList(page);
    await expect(page.getByText('Declined later', { exact: true })).toBeVisible();
    await expect(page.getByText('Too rushed to write it up.')).toBeVisible();
    await expect(page.getByText('Reflection owed')).toHaveCount(0);

    const workspace = workspaceOf(await probe(page))!;
    const debts = debtsOf(workspace);
    expect(debts).toHaveLength(1);
    const declines = declinesOf(workspace);
    expect(declines).toHaveLength(1);
    expect(declines[0]!.settledDebtId).toBe(debts[0]!.debtId);
    expect(entriesWithSettledDebt(workspace)).toHaveLength(0);
    expect(JSON.stringify(debts[0]!.versions.at(-1))).toContain('Declined');
    await context.close();
  });
});
