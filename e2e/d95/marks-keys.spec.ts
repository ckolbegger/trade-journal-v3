import { expectNoSidewaysScroll, setWidth } from '../d7p/support.ts';
import { createTradeAt, enterMark, expect, FOUR_TRADES, FRIDAY_1700, marksStepOf, MONDAY_1700, onboardedAt, openReview, setClock, test } from '../d4/support.ts';

const FRIDAY = 'Fri Oct 9';
const MONDAY = 'Mon Oct 12';
const HINT = 'Enter next, then Save · ↑ ↓ move · N no price';

test.describe('B95.3 The grid keys', () => {
  test('should show the key hint at 375 wide, and take Enter, the arrow keys and N in the grid', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page } = await onboardedAt(profile, FRIDAY_1700);
    for (const trade of [FOUR_TRADES[1]!, FOUR_TRADES[2]!]) {
      await createTradeAt(page, trade.plan, '2026-10-09T09:30', [[trade.fills[0]![0], trade.fills[0]![1], '2026-10-09T10:00']]);
    }
    await openReview(page);
    await enterMark(page, 'ABC', FRIDAY, '30.50');
    await enterMark(page, 'DEF', FRIDAY, '40.25');
    await setClock(context, page, MONDAY_1700);
    await openReview(page);

    const step = marksStepOf(page);
    const input = (symbol: string) => step.getByRole('textbox', { name: `${symbol} Mark, ${MONDAY}`, exact: true });
    await setWidth(page, 375);
    const hint = step.getByText(HINT, { exact: true });
    await expect(hint).toBeVisible();
    const box = (await hint.boundingBox())!;
    expect(box.x, 'the hint starts inside 375 px').toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, 'the hint ends inside 375 px').toBeLessThanOrEqual(375);
    await expectNoSidewaysScroll(page, 'Review, Marks step key hint at 375 px');

    await setWidth(page, 1280);
    // Enter goes to the next price, then Save Marks; the arrow keys go up and down the column.
    await input('ABC').fill('31.00');
    await input('ABC').press('Enter');
    await expect(input('DEF')).toBeFocused();
    await input('DEF').press('ArrowUp');
    await expect(input('ABC')).toBeFocused();
    await input('ABC').press('ArrowDown');
    await expect(input('DEF')).toBeFocused();
    await input('DEF').fill('40.50');
    await input('DEF').press('Enter');
    await expect(step.getByRole('button', { name: 'Save Marks (2)' })).toBeFocused();

    // N in an empty price asks why there is no price, and types no letter.
    await input('DEF').fill('');
    await input('DEF').press('n');
    await expect(step.getByRole('textbox', { name: 'Why no price, DEF' })).toBeFocused();
    await expect(input('DEF')).toHaveValue('');
    await context.close();
  });
});
