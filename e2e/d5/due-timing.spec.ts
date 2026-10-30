import {
  AT_10, completeReflection, completion, confirmReference, debtsOf, deferEntry, enterMark, entriesWithSettledDebt, expect, markAndOpenCard, MONDAY, MONDAY_1005, MONDAY_1100, MONDAY_1700, onboardedAt, openReview, probe,
  reflectionSection, reflectionsOf, saveAction, setClock, startEntry, test, TUESDAY, TUESDAY_1700, workspaceOf,
} from './support.ts';

test.describe('B5.4 Due timing', () => {
  test('should not list the reflection as due in Monday’s Review, which reaches Complete, and list it as Due in Tuesday’s', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1100);
    await confirmReference(page);
    await deferEntry(page, [AT_10]);

    await setClock(context, page, MONDAY_1700);
    await openReview(page);
    await markAndOpenCard(page, 'XYZ', MONDAY, '52.00');
    // Not due on Monday: nothing in the card reads Due, and Hold completes the Review.
    await expect(reflectionsOf(page, 'XYZ').getByText('Due', { exact: true })).toHaveCount(0);
    await saveAction(page, 'Hold');
    await expect(completion(page)).toHaveText('Complete');

    await setClock(context, page, TUESDAY_1700);
    await openReview(page);
    await markAndOpenCard(page, 'XYZ', TUESDAY, '52.50');
    await expect(reflectionsOf(page, 'XYZ').getByText('Due', { exact: true })).toBeVisible();
    await expect(completion(page)).toHaveText('Incomplete');
    await context.close();
  });
});

test.describe('B5.5 Facts never blocked', () => {
  test('should save an entry with Reflect now while a reflection is due and still list the first reflection in the Review', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1005);
    await confirmReference(page);
    await deferEntry(page, [AT_10]);

    // Tuesday 17:00: the first reflection is due; another entry with Reflect now still saves.
    await setClock(context, page, TUESDAY_1700);
    await page.getByRole('table', { name: 'Open Trades' }).getByRole('link', { name: 'XYZ', exact: true }).click();
    await startEntry(page, [{ quantity: '40', price: '50.30', fee: '1.00', time: '' }]);
    await expect(reflectionSection(page).getByLabel('Reflect now')).toBeChecked();
    await completeReflection(page);
    await page.getByRole('button', { name: 'Save entry' }).click();
    await expect(page.getByRole('heading', { name: 'Entry recorded' })).toBeVisible();
    await expect(page.getByText('Reflection saved.')).toBeVisible();

    // The Review still lists the first reflection, as Due.
    await openReview(page);
    await enterMark(page, 'XYZ', MONDAY, '52.00');
    await markAndOpenCard(page, 'XYZ', TUESDAY, '52.50');
    await expect(reflectionsOf(page, 'XYZ').getByText('Due', { exact: true })).toBeVisible();
    await expect(reflectionsOf(page, 'XYZ').getByRole('button', { name: /^Reflect on / })).toHaveCount(1);
    await expect(completion(page)).toHaveText('Incomplete');

    // Durable state: one Outstanding Debt, still owed; the new entry's reflection is its own Entry.
    const workspace = workspaceOf(await probe(page))!;
    expect(debtsOf(workspace)).toHaveLength(1);
    expect(entriesWithSettledDebt(workspace)).toHaveLength(0);
    await context.close();
  });
});
