import { actionEntriesOf, actionFormOf, cardHeader, cardList, createTrades, enterMark, expect, firstPage, launchAt, markRow, marksFamily, observationsOf, onboardedAt, openReview, probe, reachCard, reachPanel, saveAction, status, test, tradeCard, tradesOf, workspaceOf, MONDAY_1700 } from './support.ts';

const DATE = 'Mon Oct 12';

test.describe('B4.1 Daily Review end to end', () => {
  test('should list the position cards with their Marks inside in attention order with reasons and, after relaunch, Complete with every Action shown, with four Action Entries and four observation records stored', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page);
    const facts = tradesOf(workspaceOf(await probe(page))!);

    // The cards are listed with the first one open on its Marks: four Instruments to mark, one in each card.
    await openReview(page);
    await expect(status(page)).toContainText('Incomplete');
    await expect(cardList(page).getByRole('button', { name: /^Review / })).toHaveCount(4);
    await expect(marksFamily(page)).toBeVisible();
    for (const symbol of ['ABC', 'DEF', 'JKL', 'XYZ']) {
      await reachCard(page, symbol);
      await expect(await markRow(page, symbol, DATE)).toContainText('Missing');
    }

    await enterMark(page, 'XYZ', DATE, '52.00');
    await enterMark(page, 'ABC', DATE, '27.50');
    await enterMark(page, 'DEF', DATE, '40.50');
    await enterMark(page, 'JKL', DATE, '21.00');

    // The cards in attention order with the band for each, and the reason once a card is open.
    const rows = cardList(page).getByRole('listitem').filter({ has: page.getByRole('button', { name: /^Review / }) });
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText('ABC');
    await expect(rows.nth(0)).toContainText('Boundary reached');
    for (const symbol of ['XYZ', 'JKL', 'DEF']) await expect(cardHeader(page, symbol)).toContainText('Quantified pressure');
    await expect(rows.nth(1)).toContainText('XYZ');
    await expect(rows.nth(2)).toContainText('JKL');
    await expect(rows.nth(3)).toContainText('DEF');
    await reachCard(page, 'ABC');
    await expect(rows.nth(0)).toContainText('Stop breached');
    await reachCard(page, 'XYZ');
    await expect(rows.nth(1)).toContainText('of the way from entry to the Target');

    // T-A's form opens with Hold preselected: Save alone records the Action.
    await reachCard(page, 'XYZ');
    await expect((await actionFormOf(page, 'XYZ')).getByRole('radio', { name: 'Hold', exact: true })).toBeChecked();
    // The Trade's figures carry the worst case and the R of risk and reward.
    const figures = tradeCard(page, 'XYZ');
    const figure = (term: string) => figures.locator('dt', { hasText: new RegExp(`^${term}$`) }).locator('xpath=following-sibling::dd[1]');
    await expect(figure('Current Marked Trade P&L')).toHaveText('+$180.00 · +0.72R');
    await expect(figure('Ongoing Risk to Stop')).toHaveText('$450.00 · 1.80R');
    await expect(figure('Worst-Case Ongoing Risk')).toHaveText('$5,200.00 · 20.80R');
    await expect(figure('Incremental Reward to Target')).toHaveText('$400.00 · 1.60R');
    await saveAction(page, 'Hold', undefined, 'XYZ');
    await expect(status(page)).toContainText('Incomplete');
    await reachCard(page, 'ABC');
    await saveAction(page, 'Exit', 'The Stop was breached.', 'ABC');
    await reachCard(page, 'JKL');
    await saveAction(page, 'Adjust', 'Move the Stop up.', 'JKL');
    await reachCard(page, 'DEF');
    await saveAction(page, 'Hold', undefined, 'DEF');
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
    const expected = { XYZ: 'Hold', ABC: 'Exit', JKL: 'Adjust', DEF: 'Hold' };
    for (const [symbol, action] of Object.entries(expected)) {
      await expect(cardHeader(again, symbol)).toContainText('Action saved');
      await reachPanel(again, symbol, 'Action');
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
