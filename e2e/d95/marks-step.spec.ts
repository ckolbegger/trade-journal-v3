import type { Locator } from '@playwright/test';
import { expectNoSidewaysScroll, setWidth } from '../d7p/support.ts';
import { createTradeAt, enterMark, expect, FOUR_TRADES, FRIDAY_1700, marksStepOf, MONDAY_1700, onboardedAt, openReview, setClock, test } from '../d4/support.ts';

const FRIDAY = 'Fri Oct 9';
const MONDAY = 'Mon Oct 12';

const boxOf = async (locator: Locator) => (await locator.boundingBox())!;

test.describe('B95.1 The Marks step', () => {
  test('should stack each row at 375 wide: the Instrument and its input, then the previous Mark and Can\'t get a price beneath', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page } = await onboardedAt(profile, FRIDAY_1700);
    // ABC and DEF are bought on Friday and Marked at Friday's close, so Monday's Review shows Friday's Mark beside each Monday input.
    for (const trade of [FOUR_TRADES[1]!, FOUR_TRADES[2]!]) {
      await createTradeAt(page, trade.plan, '2026-10-09T09:30', [[trade.fills[0]![0], trade.fills[0]![1], '2026-10-09T10:00']]);
    }
    await openReview(page);
    await enterMark(page, 'ABC', FRIDAY, '30.50');
    await enterMark(page, 'DEF', FRIDAY, '40.25');
    await setClock(context, page, MONDAY_1700);
    await openReview(page);

    const step = marksStepOf(page);
    const rowOf = (symbol: string) => step.getByRole('row').filter({ has: page.getByRole('rowheader', { name: symbol, exact: true }) });
    const parts = (symbol: string) => ({
      instrument: rowOf(symbol).getByRole('rowheader'),
      input: rowOf(symbol).getByRole('textbox', { name: `${symbol} Mark, ${MONDAY}`, exact: true }),
      previous: rowOf(symbol).getByRole('button', { name: `${symbol} Mark, ${FRIDAY}`, exact: true }),
      noPrice: rowOf(symbol).getByRole('button', { name: /^Can't get a price/ }),
    });

    // Wide: the Instrument, the previous Mark, the input and Can't get a price share one line.
    await setWidth(page, 1280);
    for (const symbol of ['ABC', 'DEF']) {
      const { instrument, input, previous, noPrice } = parts(symbol);
      await expect(previous).toContainText(symbol === 'ABC' ? '30.50' : '40.25');
      const [a, b, c, d] = [await boxOf(instrument), await boxOf(previous), await boxOf(input), await boxOf(noPrice)];
      for (const box of [b, c, d]) expect(Math.abs(box.y + box.height / 2 - (a.y + a.height / 2)), `${symbol} on one line at 1280`).toBeLessThan(a.height);
    }

    await setWidth(page, 375);
    for (const symbol of ['ABC', 'DEF']) {
      const { instrument, input, previous, noPrice } = parts(symbol);
      const [a, c, b, d] = [await boxOf(instrument), await boxOf(input), await boxOf(previous), await boxOf(noPrice)];
      // The Instrument and its input share the first line, the Instrument on the left.
      expect(Math.abs(c.y + c.height / 2 - (a.y + a.height / 2)), `${symbol}: the input beside the Instrument`).toBeLessThan(a.height);
      expect(c.x, `${symbol}: the input right of the Instrument`).toBeGreaterThan(a.x + a.width / 2);
      // The previous Mark and Can't get a price sit beneath the input, whole inside the viewport.
      for (const [name, box] of [['the previous Mark', b], ["Can't get a price", d]] as const) {
        expect(box.y, `${symbol}: ${name} beneath the input`).toBeGreaterThanOrEqual(c.y + c.height - 1);
        expect(box.x + box.width, `${symbol}: ${name} inside 375 px`).toBeLessThanOrEqual(375);
      }
    }
    await expectNoSidewaysScroll(page, 'Review, Marks step at 375 px');
    await context.close();
  });
});
