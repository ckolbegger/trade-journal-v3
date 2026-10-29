import { actionEntriesOf, continueToTrades, createTrades, enterMark, expect, firstPage, launchAt, marksFamily, observationsOf, onboardedAt, openReview, probe, saveAction, status, test, tradesFamily, tradesOf, workspaceOf, MONDAY_1700 } from './support.ts';

const DATE = 'Mon Oct 12';

test.describe('B4.1 Daily Review end to end', () => {
  test('should show the Marks family before Trades in attention order with reasons and, after relaunch, Complete with every Action shown, with four Action Entries and four observation records stored', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page);
    const facts = tradesOf(workspaceOf(await probe(page))!);

    // The Marks family comes first: four Instruments to mark, no Trades yet.
    await openReview(page);
    await expect(status(page)).toContainText('Incomplete');
    await expect(marksFamily(page)).toBeVisible();
    await expect(tradesFamily(page)).toHaveCount(0);
    for (const symbol of ['ABC', 'DEF', 'JKL', 'XYZ']) await expect(page.getByRole('region', { name: `${symbol} Mark, ${DATE}`, exact: true })).toContainText('Missing');

    await enterMark(page, 'XYZ', DATE, '52.00');
    await enterMark(page, 'ABC', DATE, '27.50');
    await enterMark(page, 'DEF', DATE, '40.50');
    await enterMark(page, 'JKL', DATE, '21.00');

    // Continue to Trades: the Trades family, in attention order with the reason for each.
    await continueToTrades(page);
    const rows = tradesFamily(page).getByRole('listitem').filter({ has: page.getByRole('button', { name: /^Review / }) });
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText('ABC');
    await expect(rows.nth(0)).toContainText('Boundary reached');
    await expect(rows.nth(0)).toContainText('Stop breached');
    for (const symbol of ['XYZ', 'JKL', 'DEF']) await expect(tradesFamily(page).getByRole('listitem').filter({ hasText: `Review ${symbol}` })).toContainText('Quantified pressure');
    await expect(rows.nth(1)).toContainText('XYZ');
    await expect(rows.nth(2)).toContainText('JKL');
    await expect(rows.nth(3)).toContainText('DEF');
    await expect(rows.nth(1)).toContainText('of the way from entry to the Target');

    // T-A's form opens with Hold preselected: Save alone records the Action.
    await tradesFamily(page).getByRole('button', { name: 'Review XYZ' }).click();
    await expect(page.getByRole('radio', { name: 'Hold', exact: true })).toBeChecked();
    // The Trade's figures carry the worst case and the R of risk and reward.
    const figures = page.getByRole('region', { name: 'XYZ review' });
    const figure = (term: string) => figures.locator('dt', { hasText: new RegExp(`^${term}$`) }).locator('xpath=following-sibling::dd[1]');
    await expect(figure('Current Marked Trade P&L')).toHaveText('+$180.00 · +0.72R');
    await expect(figure('Ongoing Risk to Stop')).toHaveText('$450.00 · 1.80R');
    await expect(figure('Worst-Case Ongoing Risk')).toHaveText('$5,200.00 · 20.80R');
    await expect(figure('Incremental Reward to Target')).toHaveText('$400.00 · 1.60R');
    await saveAction(page, 'Hold');
    await expect(status(page)).toContainText('Incomplete');
    await tradesFamily(page).getByRole('button', { name: 'Review ABC' }).click();
    await saveAction(page, 'Exit', 'The Stop was breached.');
    await tradesFamily(page).getByRole('button', { name: 'Review JKL' }).click();
    await saveAction(page, 'Adjust', 'Move the Stop up.');
    await tradesFamily(page).getByRole('button', { name: 'Review DEF' }).click();
    await saveAction(page, 'Hold');
    await expect(status(page)).toContainText('Complete');
    await expect(status(page)).not.toContainText('Incomplete');
    await expect(page.getByText('Every Trade has an Action.')).toBeVisible();
    await context.close();

    // Relaunch: the Review resumes from stored facts as Complete, every Action shown.
    const relaunched = await launchAt(profile, MONDAY_1700);
    const again = await firstPage(relaunched);
    await again.goto('/');
    await openReview(again);
    await expect(status(again)).toContainText('Complete');
    await expect(status(again)).not.toContainText('Incomplete');
    await continueToTrades(again);
    const expected = { XYZ: 'Hold', ABC: 'Exit', JKL: 'Adjust', DEF: 'Hold' };
    for (const [symbol, action] of Object.entries(expected)) {
      await expect(tradesFamily(again).getByRole('listitem').filter({ hasText: `Review ${symbol}` })).toContainText('Action saved');
      await tradesFamily(again).getByRole('button', { name: `Review ${symbol}` }).click();
      await expect(again.getByRole('region', { name: 'Saved Action' })).toContainText(`Saved Action: ${action}`);
    }

    // Durable state: four Action Entries under the Review Date, four observation records, no Trade fact added.
    const workspace = workspaceOf(await probe(again))!;
    const entries = actionEntriesOf(workspace);
    expect(entries).toHaveLength(4);
    expect(entries.map((e) => e.obligationKey?.slice(0, 2))).toEqual(Array(4).fill(['DailyTradeReview', '2026-10-12']));
    expect(observationsOf(workspace).map((o) => o.instrumentKey).sort()).toEqual(['ABC', 'DEF', 'JKL', 'XYZ']);
    expect(observationsOf(workspace).every((o) => o.marks.length === 1)).toBe(true);
    expect(tradesOf(workspace)).toEqual(facts);
    await relaunched.close();
  });
});
