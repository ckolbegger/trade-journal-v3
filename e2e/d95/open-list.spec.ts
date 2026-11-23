import { setWidth } from '../d7p/support.ts';
import { createTrades, enterMark, expect, FOUR_TRADES, LAUNCH, MONDAY_1700, onboardedAt, openReview, reachCard, saveAction, setClock, test, TUESDAY_1700 } from '../d4/support.ts';

const MONDAY = 'Mon Oct 12';

// The Open list's rows in their order, by Underlying.
const listOrder = async (page: import('@playwright/test').Page): Promise<string[]> => {
  const table = page.getByRole('table', { name: 'Open Trades' });
  await expect(table).toBeVisible(LAUNCH);
  return table.locator('tbody tr').evaluateAll((rows) => rows.map((row) => row.querySelector('a')!.textContent));
};

test.describe('B95.5 The Open list follows the Review order', () => {
  test('should list the Open Trades past the Stop, then at the Target, and an Exit not carried out first, at 1280 and 375 wide', async ({ profile }) => {
    test.setTimeout(420_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page, FOUR_TRADES.slice(0, 3));
    await openReview(page);
    // XYZ stays between its lines, ABC is past its Stop (28), DEF is past its Target (46).
    await enterMark(page, 'XYZ', MONDAY, '52.00');
    await enterMark(page, 'ABC', MONDAY, '27.50');
    await enterMark(page, 'DEF', MONDAY, '46.50');
    const trades = page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades', exact: true });
    await trades.click();
    for (const width of [1280, 375]) {
      await setWidth(page, width);
      expect(await listOrder(page), `Open list at ${width}`).toEqual(['ABC', 'DEF', 'XYZ']);
    }
    await setWidth(page, 1280);

    // The day after an Exit is saved for XYZ, the Open list places it first.
    await openReview(page);
    await reachCard(page, 'XYZ');
    await saveAction(page, 'Exit', 'The thesis no longer holds.', 'XYZ');
    await setClock(context, page, TUESDAY_1700);
    await trades.click();
    for (const width of [1280, 375]) {
      await setWidth(page, width);
      const order = await listOrder(page);
      expect(order[0], `Open list at ${width}`).toBe('XYZ');
      expect(order).toHaveLength(3);
    }
    await context.close();
  });
});
