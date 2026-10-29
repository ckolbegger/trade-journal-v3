import { actionEntriesOf, actionForm, completion, continueToTrades, createTrades, enterMark, expect, FOUR_TRADES, MONDAY_1700, onboardedAt, openReview, probe, saveAction, test, tradesFamily, tradesOf, workspaceOf } from './support.ts';

test.describe('B4.2 One-click Hold and Intent', () => {
  test('should record nothing on leaving, show the error for Exit without Intent, save it with Intent, and add no Trade fact', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page, [FOUR_TRADES[0]!]);
    await openReview(page);
    await enterMark(page, 'XYZ', 'Mon Oct 12', '52.00');
    await continueToTrades(page);
    const before = workspaceOf(await probe(page))!;
    const entriesBefore = before.stores['journalEntries'];

    // A new Action form: Hold is preselected; leaving records nothing.
    await tradesFamily(page).getByRole('button', { name: 'Review XYZ' }).click();
    await expect(actionForm(page)).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Hold', exact: true })).toBeChecked();
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    await expect(page.getByRole('table', { name: 'Open Trades' })).toBeVisible();
    await openReview(page);
    await expect(completion(page)).toHaveText('Incomplete');
    await expect(page.getByText('Action missing for XYZ')).toBeVisible();
    let workspace = workspaceOf(await probe(page))!;
    expect(actionEntriesOf(workspace)).toHaveLength(0);
    expect(workspace.stores['journalEntries']).toEqual(entriesBefore);

    // Reopen: Exit without Intent shows the error and records nothing.
    await continueToTrades(page);
    await tradesFamily(page).getByRole('button', { name: 'Review XYZ' }).click();
    await actionForm(page).getByRole('radio', { name: 'Exit', exact: true }).check();
    await actionForm(page).getByRole('button', { name: 'Save' }).click();
    await expect(actionForm(page).getByText('Say why you are taking this action.')).toBeVisible();
    await expect(completion(page)).toHaveText('Incomplete');
    workspace = workspaceOf(await probe(page))!;
    expect(actionEntriesOf(workspace)).toHaveLength(0);

    // With Intent it saves: one Entry, the Review Complete, no Trade fact added.
    await saveAction(page, 'Exit', 'The thesis no longer holds.');
    await expect(completion(page)).toHaveText('Complete');
    await expect(page.getByText('Every Trade has an Action.')).toBeVisible();
    workspace = workspaceOf(await probe(page))!;
    expect(actionEntriesOf(workspace)).toHaveLength(1);
    expect(tradesOf(workspace)).toEqual(tradesOf(before));
    await context.close();
  });
});
