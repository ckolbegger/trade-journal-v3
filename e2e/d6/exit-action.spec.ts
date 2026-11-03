import {
  cardHeader, closeTheTrade, completion, createTA, enterMark, expect, fillRows, MONDAY, MONDAY_1700, onboardedAt, openExitForm, openReview, openTradeFromOpenList, reachCard, saveAction, sell, test,
  tradeCard,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

test.describe('B6.5 Exit link', () => {
  test('should save Exit with Intent in the Review with no Record the exit offered, record the exit from Trade Detail, and still walk T-A in Monday’s Review with its Exit Action', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTA(page);

    // Monday 17:00: save Exit with Intent in the Review. The card offers no way to record the exit.
    await openReview(page);
    await enterMark(page, 'XYZ', MONDAY, '52.00');
    await reachCard(page, 'XYZ');
    await saveAction(page, 'Exit', 'Take the target tomorrow.', 'XYZ');
    await reachCard(page, 'XYZ');
    await expect(cardHeader(page, 'XYZ')).toContainText('Action saved');
    await expect(page.getByText(/Record the exit/i)).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Record (the )?exit/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Record (the )?exit/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Record exit' })).toHaveCount(0);

    // From Trade Detail: record 100 shares with a reason and reflections, after the close.
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    await openTradeFromOpenList(page, 'XYZ');
    await openExitForm(page);
    await fillRows(page, [sell('100', '53.00', '1.00', '')]);
    await closeTheTrade(page, 'now');
    await page.getByRole('button', { name: 'Save exit' }).click();
    await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible();

    // Monday's Review again: T-A, Open at the close, is still walked with its Exit Action.
    await openReview(page);
    await expect(cardHeader(page, 'XYZ')).toContainText('Action saved');
    await reachCard(page, 'XYZ');
    await expect(tradeCard(page, 'XYZ')).toBeVisible();
    await expect(completion(page)).toHaveText('Complete');
    await expect(page.getByRole('link', { name: /Record (the )?exit/i })).toHaveCount(0);
    await context.close();
  });
});
