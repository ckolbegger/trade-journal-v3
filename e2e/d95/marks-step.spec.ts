import type { Locator } from '@playwright/test';
import { expectNoSidewaysScroll, setWidth } from '../d7p/support.ts';
import { answerSlipQuestions, createTradeAt, enterMark, expect, FOUR_TRADES, FRIDAY_1700, marksStepOf, MONDAY_1700, onboardedAt, openReview, reloadReview, saveMarksButton, setClock, status, test } from '../d4/support.ts';
import { openCardFixture } from '../d5r/support.ts';
import { atBothWidths } from './support.ts';

const FRIDAY = 'Fri Oct 9';
const MONDAY = 'Mon Oct 12';

const boxOf = async (locator: Locator) => (await locator.boundingBox())!;

test.describe('B95.2 The Marks step', () => {
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

  test('should keep nothing typed after a reload, save once and fold, re-sort the Trades with focus on the first, fix a saved Mark in place with no reason, and show an acknowledged Mark as no price and a gap as a gap, at 1280 and 375 wide', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page } = await openCardFixture(profile, copySetup);
    await openReview(page);
    const step = marksStepOf(page);
    const input = (symbol: string) => step.getByRole('textbox', { name: `${symbol} Mark, ${MONDAY}`, exact: true });
    const lineOrder = () => status(page).getByRole('list', { name: 'Trade lines' }).getByRole('listitem').evaluateAll((items) => items.map((item) => item.querySelector('a')!.textContent));
    // With no Mark in, the Trades tie on attention and fall in a random order; once ABC is past its Stop it goes first.
    expect([...(await lineOrder())].sort(), 'the day card lists each Trade').toEqual(['ABC', 'DEF', 'JKL', 'XYZ', 'XYZ']);

    // A typed price is a draft: after a reload the cell is empty.
    await input('XYZ').fill('52.00');
    await reloadReview(page);
    await expect(input('XYZ')).toHaveValue('');

    // ABC past its Stop, DEF and JKL inside their lines, and XYZ with no price to give. Save Marks takes all four at once.
    await input('ABC').fill('27.50');
    await input('DEF').fill('41.00');
    await input('JKL').fill('20.50');
    await input('XYZ').press('n');
    const xyz = step.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'XYZ', exact: true }) });
    await xyz.getByRole('textbox', { name: /^Why no price/ }).fill('Halted');
    await xyz.getByRole('button', { name: 'No price', exact: true }).click();
    await answerSlipQuestions(page);
    await expect(saveMarksButton(page)).toHaveText('Save Marks (4)');
    await saveMarksButton(page).click();

    // The grid folds to its line, the Trade past its Stop goes first, and focus lands on its header (A327).
    await expect(step).toContainText('4 of 4 saved · 1 no price');
    await expect(step.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    await expect.poll(async () => (await lineOrder())[0]).toBe('ABC');
    await expect(page.getByRole('button', { name: /^Review ABC/ })).toBeFocused();
    // The acknowledged Mark is no price, and says so on the day card and on the Trade's card.
    await expect(status(page).getByRole('listitem').filter({ hasText: 'XYZ' }).first()).toContainText('No price today');
    await atBothWidths(page, async (width) => {
      await expect(step, `the fold at ${width}`).toContainText('4 of 4 saved · 1 no price');
      await expect(step.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    });

    // Edit opens the grid again: a saved Mark is fixed in place, and no reason is asked.
    await step.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(step).toContainText('Saved in this Review: fix it in place, no reason needed.');
    await expect(step.getByText('Acknowledged Unavailable')).toBeVisible();
    // A session with no Mark stays a gap (a dash), never a price.
    await expect(step.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'ABC', exact: true }) }).getByRole('cell').nth(0)).toHaveText('—');
    await input('ABC').fill('27.00');
    await expect(step.getByRole('textbox', { name: /^(Reason|Why no price)/ })).toHaveCount(0);
    await saveMarksButton(page).click();
    await expect(step).toContainText('4 of 4 saved · 1 no price');
    await expect(step.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    await context.close();
  });
});
