import { expectNoSidewaysScroll } from '../d7p/support.ts';
import { createTrades, expect, FOUR_TRADES, marksStepOf, MONDAY_1700, onboardedAt, openReview, reachCard, saveAction, saveMarksButton, status, test, answerSlipQuestions } from '../d4/support.ts';
import { openCardFixture } from '../d5r/support.ts';
import { atBothWidths } from './support.ts';

const MONDAY = 'Mon Oct 12';

test.describe('B95.1 The day card', () => {
  test('should show the counts, the steps, one button and the labels, and no list of missing items, at 1280 and 375 wide', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page } = await openCardFixture(profile, copySetup);
    await openReview(page);
    const day = status(page);
    await atBothWidths(page, async (width) => {
      await expect(day, `the date at ${width}`).toContainText('Review Date Mon Oct 12');
      await expect(day).toContainText('5 Trades · 4 Marks, 5 Actions and 1 reflection to go');
      await expect(day.getByRole('list', { name: 'Steps' }).getByRole('listitem')).toHaveText(['1 Marks', '2 Trades', '3 The day']);
      await expect(day.getByRole('list', { name: 'Steps' }).getByRole('listitem').first()).toHaveAttribute('aria-current', 'step');
      await expect(day.locator('strong')).toHaveText('Incomplete');
      // One line a Trade, each with its label and what it still needs.
      const lines = day.getByRole('list', { name: 'Trade lines' }).getByRole('listitem');
      await expect(lines).toHaveCount(5);
      await expect(lines.first()).toContainText('Marks needed');
      await expect(lines.first()).toContainText('To do: Mark, Reflection, Action');
      await expect(lines.nth(2)).toContainText('To do: Mark, Action');
      // One button leads on; the missing Marks are not listed on the page, only named for a screen reader.
      await expect(day.getByRole('button', { name: 'Enter the Marks', exact: true })).toHaveCount(1);
      await expect(day.getByRole('list')).toHaveCount(2);
      const missing = day.getByText(/^Mark missing for /);
      await expect(missing).toHaveCount(5);
      await expect(day.locator('.visually-hidden', { hasText: /^Mark missing for / })).toHaveCount(5);
      await expectNoSidewaysScroll(page, `Review, the day card at ${width} px`);
    });
    // The button goes to the first Mark still to enter.
    await day.getByRole('button', { name: 'Enter the Marks', exact: true }).click();
    await expect(marksStepOf(page).getByRole('textbox', { name: `XYZ Mark, ${MONDAY}`, exact: true })).toBeFocused();
    await context.close();
  });

  test('should list the finished day: what is past a line, what was chosen, what comes due and the next Review Date, at 1280 and 375 wide', async ({ profile }) => {
    test.setTimeout(420_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page, FOUR_TRADES);
    await openReview(page);
    // ABC is past its Stop (28), the others between their lines.
    const prices = { XYZ: '52.00', ABC: '27.50', DEF: '41.00', JKL: '20.50' };
    for (const [symbol, price] of Object.entries(prices)) await marksStepOf(page).getByRole('textbox', { name: `${symbol} Mark, ${MONDAY}`, exact: true }).fill(price);
    await answerSlipQuestions(page);
    await saveMarksButton(page).click();
    await expect(marksStepOf(page).getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    for (const symbol of ['XYZ', 'ABC', 'JKL']) {
      await reachCard(page, symbol);
      await saveAction(page, 'Hold', undefined, symbol);
    }
    await reachCard(page, 'DEF');
    await saveAction(page, 'Exit', 'Taking the sale.', 'DEF');

    const day = status(page);
    await expect(day.locator('strong')).toHaveText('Complete');
    await atBothWidths(page, async (width) => {
      await expect(day.getByRole('list', { name: 'Steps' }).getByRole('listitem')).toHaveText([/^1 Marks\s*done$/, /^2 Trades\s*done$/, /^3 The day\s*done$/]);
      const row = (term: string) => day.locator('.day-rows > div').filter({ has: page.getByText(term, { exact: true }) }).locator('dd');
      await expect(row('The day'), `The day at ${width}`).toHaveText(/^[−+]\$[\d,]+\.\d\d$/);
      await expect(row('Past a line')).toHaveText('Past Stop: ABC');
      await expect(row('You chose')).toHaveText(/^Exit DEF · Hold (XYZ|ABC|JKL), (XYZ|ABC|JKL), (XYZ|ABC|JKL)$/);
      await expect(row('Tomorrow')).toContainText('Sell DEF, then record the sale.');
      await expect(row('Tomorrow')).toContainText("You held ABC past the Stop. Tomorrow's Review asks again.");
      await expect(row('Next Review')).toHaveText('Tue Oct 13, after the close.');
      await expect(day.getByRole('button', { name: /^(Enter the Marks|Next:)/ })).toHaveCount(0);
      await expectNoSidewaysScroll(page, `Review, the finished day at ${width} px`);
    });
    await context.close();
  });
});
