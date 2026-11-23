import { answerSlipQuestions, createTradeAt, enterMark, expect, FOUR_TRADES, FRIDAY_1700, marksStepOf, MONDAY_1700, observationsOf, onboardedAt, openReview, probe, saveMarksButton, setClock, test, workspaceOf } from '../d4/support.ts';

const FRIDAY = 'Fri Oct 9';
const MONDAY = 'Mon Oct 12';

// B95.2, the slip questions (T95.13): a Mark that reads as a slip is questioned when its cell is left, and only the price is saved.
test.describe('B95.2 The slip questions', () => {
  test('should question a ten-times slip, take the reading pressed, and save only the price', async ({ profile }) => {
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
    // The rows follow the Trades' order: the first Instrument takes the ten-times slip, and the second a far move.
    const [first, second] = await step.getByRole('rowheader').allTextContents();
    const slips = {
      ABC: { last: '30.50', typed: '305', shown: '$305.00', far: '45.75', lastShown: '$30.50' },
      DEF: { last: '40.25', typed: '402.5', shown: '$402.50', far: '60.38', lastShown: '$40.25' },
    } as const;
    const one = slips[first as 'ABC' | 'DEF'];
    const two = slips[second as 'ABC' | 'DEF'];
    const firstInput = step.getByRole('textbox', { name: `${first} Mark, ${MONDAY}`, exact: true });
    const secondInput = step.getByRole('textbox', { name: `${second} Mark, ${MONDAY}`, exact: true });

    // Both readings are offered, and Save Marks sends nothing while the question is open.
    await firstInput.fill(one.typed);
    await firstInput.blur();
    await expect(step.getByText(`${one.lastShown} or ${one.shown}?`)).toBeVisible();
    await step.getByRole('button', { name: /^Save Marks/ }).click();
    await expect(step.getByText('1 Mark to check first.')).toBeVisible();
    await step.getByRole('button', { name: one.lastShown, exact: true }).click();
    await expect(firstInput).toHaveValue(one.last);
    // Focus goes on to the next price; a far move is asked about, and Retype gives the cell back.
    await expect(secondInput).toBeFocused();
    await secondInput.fill(two.far);
    await secondInput.blur();
    await expect(step.getByText(`+50.0% from ${two.lastShown}. Right?`)).toBeVisible();
    await step.getByRole('button', { name: 'Retype' }).click();
    await expect(secondInput).toHaveValue('');
    await expect(secondInput).toBeFocused();
    // A price that is not one is refused, with nothing to press.
    await secondInput.fill('abc');
    await secondInput.blur();
    await expect(step.getByText('Not a price. Digits only, like 45.10.')).toBeVisible();
    await secondInput.fill(two.last);
    await answerSlipQuestions(page);
    await expect(saveMarksButton(page)).toHaveText('Save Marks (2)');
    await saveMarksButton(page).click();
    await expect(saveMarksButton(page)).toHaveText('Save Marks (0)');

    // Only the prices were stored: nothing of the questions or their answers.
    const stored = observationsOf(workspaceOf(await probe(page))!).filter((o) => o.tradingDate === '2026-10-12');
    expect(stored.flatMap((o) => o.marks.map((mark) => mark.price)).sort()).toEqual(['30.5', '40.25']);
    expect(JSON.stringify(stored)).not.toMatch(/slip|answer|Right|Worth nothing/i);
    await context.close();
  });
});
