import { actionForm, completion, continueToTrades, createTrades, enterMark, expect, firstPage, FOUR_TRADES, launchAt, MONDAY_1700, onboardedAt, openReview, probe, READY, saveAction, status, test, tradesFamily, markEntry } from './support.ts';

const DATE = 'Mon Oct 12';
const READ_ONLY = "Read only: this browser can't save right now";

test.describe('B4.10 Recovery Only (faults build)', () => {
  test('should keep the Review, Open list, and Detail readable with no Mark entry or Save, and leave the stores unchanged', async ({ server, profile }) => {
    server.use('dist-faults');
    const { context: setup, page: first } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(first, [FOUR_TRADES[0]!, FOUR_TRADES[1]!]);
    await openReview(first);
    await enterMark(first, 'XYZ', DATE, '52.00');
    await continueToTrades(first);
    await tradesFamily(first).getByRole('button', { name: 'Review XYZ' }).click();
    await saveAction(first, 'Hold');
    await expect(markEntry(first, 'ABC', DATE)).toContainText('Missing');
    const before = await probe(first);
    await setup.close();

    const context = await launchAt(profile, MONDAY_1700);
    const page = await firstPage(context);
    await page.goto('/?faults=control');
    await expect(page.getByRole('region', { name: READ_ONLY })).toBeVisible(READY);

    // The Review is readable: its status, the Missing Mark with no way to enter it, and the saved Action.
    await openReview(page);
    await expect(completion(page)).toHaveText('Incomplete');
    await expect(status(page)).toContainText('Mark missing for ABC on Mon Oct 12');
    await expect(markEntry(page, 'ABC', DATE)).toContainText('Missing');
    await expect(markEntry(page, 'XYZ', DATE)).toContainText('Manual');
    await expect(page.getByRole('button', { name: 'Enter', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Correct' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: "Can't get a price" })).toHaveCount(0);
    await continueToTrades(page);
    await tradesFamily(page).getByRole('button', { name: 'Review XYZ' }).click();
    await expect(page.getByRole('region', { name: 'Saved Action' })).toContainText('Saved Action: Hold');
    await expect(page.getByRole('button', { name: 'Change' })).toHaveCount(0);
    await tradesFamily(page).getByRole('button', { name: 'Review ABC' }).click();
    await expect(page.getByText('No Action saved.')).toBeVisible();
    await expect(actionForm(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save Mark' })).toHaveCount(0);

    // The Open list and a Detail are readable.
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    const row = page.getByRole('table', { name: 'Open Trades' }).getByRole('row', { name: /ABC/ });
    await expect(row).toBeVisible();
    await row.getByRole('link').first().click();
    await expect(page.getByRole('heading', { name: 'ABC', level: 1 })).toBeVisible(READY);
    await expect(page.getByRole('region', { name: 'Position', exact: true })).toContainText('100 shares of ABC');
    await expect(page.getByRole('region', { name: 'Valuation', exact: true })).toContainText('Mark missing');

    expect(await probe(page)).toEqual(before);
    await context.close();
  });
});
