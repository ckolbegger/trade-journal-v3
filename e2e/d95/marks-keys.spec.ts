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
    // ABC and DEF tie on attention and the tie falls to a random tradeId, so read the grid's row order.
    const abcY = (await input('ABC').boundingBox())!.y;
    const defY = (await input('DEF').boundingBox())!.y;
    const [first, second]: [string, string] = abcY < defY ? ['ABC', 'DEF'] : ['DEF', 'ABC'];
    // Each Instrument gets a Mark near its Friday Mark, so no large-move question opens in the grid.
    const price = (symbol: string) => (symbol === 'ABC' ? '31.00' : '40.50');
    // Enter goes to the next price, then Save Marks; the arrow keys go up and down the column.
    await input(first).fill(price(first));
    await input(first).press('Enter');
    await expect(input(second)).toBeFocused();
    await input(second).press('ArrowUp');
    await expect(input(first)).toBeFocused();
    await input(first).press('ArrowDown');
    await expect(input(second)).toBeFocused();
    await input(second).fill(price(second));
    await input(second).press('Enter');
    await expect(step.getByRole('button', { name: 'Save Marks (2)' })).toBeFocused();

    // N in an empty price asks why there is no price, and types no letter.
    await input(second).fill('');
    await input(second).press('n');
    await expect(step.getByRole('textbox', { name: `Why no price, ${second}` })).toBeFocused();
    await expect(input(second)).toHaveValue('');
    await context.close();
  });
});
