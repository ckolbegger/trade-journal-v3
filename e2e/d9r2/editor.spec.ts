import { dayLine, expectMark, marksPanelOf, marksStepOf, markEditorOf, acknowledgeMark, completion, createGapFixture, enterMark, expect, OCT_12, OCT_7, OCT_8, OCT_9, openReview, reachCard, LAUNCH, reloadReview, saveAction, status, test , saveMarksButton } from './support.ts';

test.use({ actionTimeout: 15_000 });

const AUG_31 = 'Mon Aug 31';
const NEGATIVE = 'A price cannot be negative.';

test.describe('B9R2.4 The cell editor', () => {
  test('should ask for a reason with Can\'t get a price, correct an earlier Mark, offer Withdraw on the Review Date only, and complete with Unavailable Marks from the Review Date alone', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page, tA, tF } = await createGapFixture(profile);

    await test.step("Can't get a price needs a reason", async () => {
      // The Review Date's cell is answered in its row (W113): the reason is asked for before anything is held.
      const row = marksStepOf(page).getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'XYZ', exact: true }) });
      await row.getByRole('button', { name: /^Can't get a price/ }).click();
      await row.getByRole('button', { name: 'No price', exact: true }).click();
      await expect(row.getByText("Enter why you can't get a price.")).toBeVisible();
      await expect(status(page)).toContainText('Incomplete');
      await row.getByRole('textbox', { name: /^Why no price/ }).fill('No quote today');
      await row.getByRole('button', { name: 'No price', exact: true }).click();
      await saveMarksButton(page).click();
      await expect(saveMarksButton(page)).toHaveText('Save Marks (0)');
      await expectMark(page, tA, OCT_12, 'Acknowledged Unavailable');
    });

    await test.step('Correct an earlier Mark; an earlier Mark offers no Withdraw', async () => {
      await enterMark(page, tA, OCT_9, '50.40');
      const editor = await markEditorOf(page, tA, OCT_9);
      await expect(editor.getByRole('button', { name: 'Withdraw' })).toHaveCount(0);
      await editor.getByRole('button', { name: 'Correct', exact: true }).click();
      await editor.getByLabel('Price').fill('50.90');
      await editor.getByLabel('Reason (required)').fill('Misread the quote.');
      await editor.getByRole('button', { name: 'Save correction' }).click();
      await expect(editor).toContainText('$50.90');
      await expect(editor).toContainText('Corrected: Misread the quote.');
      // An acknowledged earlier session has no Withdraw either.
      await expect((await markEditorOf(page, tA, OCT_7)).getByRole('button', { name: 'Withdraw' })).toHaveCount(0);
    });

    await test.step('Withdraw is offered on the Review Date only', async () => {
      await expect((await markEditorOf(page, tA, OCT_12)).getByRole('button', { name: 'Withdraw' })).toBeVisible();
    });

    await test.step('Complete With Unavailable Marks after a Review Date acknowledgment, whatever the earlier sessions hold', async () => {
      // Twenty-odd earlier sessions still lack Marks and do not block; the Actions complete the Review.
      await saveAction(page, 'Hold', undefined, tA);
      await saveAction(page, 'Hold', undefined, tF);
      await expect(completion(page)).toHaveText('Complete with Unavailable Marks');
      await reloadReview(page);
      await expect(completion(page)).toHaveText('Complete with Unavailable Marks');
      // An earlier session's Mark or acknowledgment changes nothing.
      await enterMark(page, tA, OCT_8, '50.20');
      await acknowledgeMark(page, tA, 'Mon Oct 5', 'No quote that day');
      await expect(completion(page)).toHaveText('Complete with Unavailable Marks');
      // Withdrawing the Review Date's acknowledgment makes the Mark missing again.
      await (await markEditorOf(page, tA, OCT_12)).getByRole('button', { name: 'Withdraw' }).click();
      await expectMark(page, tA, OCT_12, 'Missing');
      await reloadReview(page);
      await expect(completion(page)).toHaveText('Incomplete');
      await expect(dayLine(page, 'XYZ').first()).toContainText('To do: Mark');
    });
    await context.close();
  });

  test('should name a conflict, and after a refused save open the first refused cell with focus in its input', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page, tA } = await createGapFixture(profile);

    await test.step('a conflict: another tab saved the cell first', async () => {
      // T-A's card is open in this tab before the other tab saves.
      const marks = await marksPanelOf(page, tA);
      const second = await context.newPage();
      await second.goto('/');
      await openReview(second);
      await enterMark(second, tA, OCT_9, '50.10');
      await second.close();
      const cell = marks.getByRole('textbox', { name: `XYZ Mark, ${OCT_9}`, exact: true });
      await cell.fill('50.60');
      await saveMarksButton(page).click();
      await expect(page.getByRole('alert').filter({ hasText: 'This Mark changed after you opened it. Nothing was saved.' })).toBeVisible(LAUNCH);
      // Nothing was written from this tab: the other tab's Mark stands.
      await expect(saveMarksButton(page)).toHaveText('Save Marks (1)');
      // The conflicted cell's editor takes focus in its input (A294).
      await expect(marks.getByRole('region', { name: `XYZ Mark, ${OCT_9}`, exact: true }).getByLabel('Price')).toBeFocused();
    });
    await context.close();
  });

  test('should read a card that was not open after another tab saved a Mark, and open the refused cell of a closed card with focus in its input (T9R2.17-B8)', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page, tA, tF } = await createGapFixture(profile);

    await test.step('another tab saves a Mark while T-F is open here: opening T-A still reads its card', async () => {
      await marksPanelOf(page, tF);
      const second = await context.newPage();
      await second.goto('/');
      await openReview(second);
      await enterMark(second, tA, OCT_8, '50.85');
      await second.close();
      const marks = await marksPanelOf(page, tA);
      await expect(marks.getByRole('textbox', { name: `XYZ Mark, ${OCT_12}`, exact: true })).toBeVisible(LAUNCH);
      await expect(page.getByText('We couldn’t load this Trade. Nothing was changed.')).toHaveCount(0);
    });

    await test.step('a refused save opens the closed card of its first refused key, with focus in the input', async () => {
      await page.getByRole('textbox', { name: `XYZ Mark, ${OCT_12}`, exact: true }).fill('51.00');
      await page.getByRole('textbox', { name: `XYZ Mark, ${OCT_9}`, exact: true }).fill('50.80');
      await reachCard(page, tF);
      const second = await context.newPage();
      await second.goto('/');
      await openReview(second);
      await enterMark(second, tA, OCT_9, '50.85');
      await second.close();
      await saveMarksButton(page).click();
      await expect(page.getByRole('region', { name: `XYZ Mark, ${OCT_9}`, exact: true }).getByLabel('Price')).toBeFocused(LAUNCH);
      await expect(page.getByText('We couldn’t load this Trade. Nothing was changed.')).toHaveCount(0);
    });
    await context.close();
  });

  test('should open the first refused cell, on its page, with its issue and focus in the input', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page, tA } = await createGapFixture(profile);
    const marks = await marksPanelOf(page, tA);
    const cell = (date: string) => marks.getByRole('textbox', { name: `XYZ Mark, ${date}`, exact: true });

    await test.step('one refused price on page 2 while page 1 shows', async () => {
      await marks.getByRole('button', { name: 'Add the skipped sessions' }).click();
      await marks.getByRole('button', { name: 'Next page' }).click();
      await cell(AUG_31).fill('-1');
      await marks.getByRole('button', { name: 'Previous page' }).click();
      await cell(OCT_9).fill('50.40');
      await saveMarksButton(page).click();
      await expect(marks.getByText('Sessions 21 to 27 of 27')).toBeVisible();
      await expect(marks.getByRole('region', { name: `XYZ Mark, ${AUG_31}`, exact: true }).getByText(NEGATIVE)).toBeVisible();
      await expect(cell(AUG_31)).toBeFocused();
      // Nothing was saved: the valid price stays a draft.
      await expect(saveMarksButton(page)).toHaveText('Save Marks (2)');
    });

    await test.step('with two refused prices the first opens: Thu Oct 8, typed first and first in the grid', async () => {
      await marks.getByRole('button', { name: 'Discard' }).click();
      await marks.getByRole('button', { name: 'Previous page' }).click();
      await cell(OCT_8).fill('-2');
      await marks.getByRole('button', { name: 'Next page' }).click();
      await cell(AUG_31).fill('-1');
      await saveMarksButton(page).click();
      await expect(marks.getByText('Sessions 1 to 20 of 27')).toBeVisible();
      await expect(marks.getByRole('region', { name: `XYZ Mark, ${OCT_8}`, exact: true }).getByText(NEGATIVE)).toBeVisible();
      await expect(cell(OCT_8)).toBeFocused();
    });
    await context.close();
  });
});
