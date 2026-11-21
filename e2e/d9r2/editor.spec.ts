import { acknowledgeMark, completion, createGapFixture, enterMark, expect, markRow, OCT_12, OCT_7, OCT_8, OCT_9, openReview, reachPanel, READY, reloadReview, saveAction, saveMarksOf, status, test, tradeCard } from './support.ts';

test.use({ actionTimeout: 15_000 });

const AUG_31 = 'Mon Aug 31';
const NEGATIVE = 'A price cannot be negative.';

test.describe('B9R2.4 The cell editor', () => {
  test('should ask for a reason with Can\'t get a price, correct an earlier Mark, offer Withdraw on the Review Date only, and complete with Unavailable Marks from the Review Date alone', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page, tA, tF } = await createGapFixture(profile);

    await test.step("Can't get a price needs a reason", async () => {
      const editor = await markRow(page, tA, OCT_12);
      await editor.getByRole('button', { name: "Can't get a price" }).click();
      await saveMarksOf(page, tA).click();
      await expect(editor.getByText("Enter why you can't get a price.")).toBeVisible();
      await expect(status(page)).toContainText('Incomplete');
      await editor.getByLabel('Reason (required)').fill('No quote today');
      await saveMarksOf(page, tA).click();
      // A saved result moves the card on to its next panel (A157), so the panel's own button is read inside the card.
      await expect(tradeCard(page, tA).locator('section[aria-label="Marks"] button', { hasText: /^Save Marks/ })).toHaveText('Save Marks (0)', READY);
      await expect(await markRow(page, tA, OCT_12)).toContainText('Acknowledged Unavailable');
    });

    await test.step('Correct an earlier Mark; an earlier Mark offers no Withdraw', async () => {
      await enterMark(page, tA, OCT_9, '50.40');
      const editor = await markRow(page, tA, OCT_9);
      await expect(editor.getByRole('button', { name: 'Withdraw' })).toHaveCount(0);
      await editor.getByRole('button', { name: 'Correct', exact: true }).click();
      await editor.getByLabel('Price').fill('50.90');
      await editor.getByLabel('Reason (required)').fill('Misread the quote.');
      await editor.getByRole('button', { name: 'Save correction' }).click();
      await expect(editor).toContainText('$50.90');
      await expect(editor).toContainText('Corrected: Misread the quote.');
      // An acknowledged earlier session has no Withdraw either.
      await expect((await markRow(page, tA, OCT_7)).getByRole('button', { name: 'Withdraw' })).toHaveCount(0);
    });

    await test.step('Withdraw is offered on the Review Date only', async () => {
      await expect((await markRow(page, tA, OCT_12)).getByRole('button', { name: 'Withdraw' })).toBeVisible();
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
      await (await markRow(page, tA, OCT_12)).getByRole('button', { name: 'Withdraw' }).click();
      await expect(await markRow(page, tA, OCT_12)).toContainText('Missing');
      await reloadReview(page);
      await expect(completion(page)).toHaveText('Incomplete');
      await expect(status(page)).toContainText('Mark missing for XYZ on Mon Oct 12');
    });
    await context.close();
  });

  test('should name a conflict, and after a refused save open the first refused cell with focus in its input', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page, tA } = await createGapFixture(profile);

    await test.step('a conflict: another tab saved the cell first', async () => {
      // T-A's card is open in this tab before the other tab saves.
      const marks = await reachPanel(page, tA, 'Marks');
      const second = await context.newPage();
      await second.goto('/');
      await openReview(second);
      await enterMark(second, tA, OCT_9, '50.10');
      await second.close();
      const cell = marks.getByRole('textbox', { name: `XYZ Mark, ${OCT_9}`, exact: true });
      await cell.fill('50.60');
      await saveMarksOf(page, tA).click();
      await expect(page.getByRole('alert').filter({ hasText: 'This Mark changed after you opened it. Nothing was saved.' })).toBeVisible(READY);
      // Nothing was written from this tab: the other tab's Mark stands.
      await expect(saveMarksOf(page, tA)).toHaveText('Save Marks (1)');
      // The conflicted cell's editor takes focus in its input (A294).
      await expect(marks.getByRole('region', { name: `XYZ Mark, ${OCT_9}`, exact: true }).getByLabel('Price')).toBeFocused();
    });
    await context.close();
  });

  test('should open the first refused cell, on its page, with its issue and focus in the input', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page, tA } = await createGapFixture(profile);
    const marks = await reachPanel(page, tA, 'Marks');
    const cell = (date: string) => marks.getByRole('textbox', { name: `XYZ Mark, ${date}`, exact: true });

    await test.step('one refused price on page 2 while page 1 shows', async () => {
      await marks.getByRole('button', { name: 'Next page' }).click();
      await cell(AUG_31).fill('-1');
      await marks.getByRole('button', { name: 'Previous page' }).click();
      await cell(OCT_9).fill('50.40');
      await saveMarksOf(page, tA).click();
      await expect(marks.getByText('Sessions 21 to 27 of 27')).toBeVisible(READY);
      await expect(marks.getByRole('region', { name: `XYZ Mark, ${AUG_31}`, exact: true }).getByText(NEGATIVE)).toBeVisible();
      await expect(cell(AUG_31)).toBeFocused();
      // Nothing was saved: the valid price stays a draft.
      await expect(saveMarksOf(page, tA)).toHaveText('Save Marks (2)');
    });

    await test.step('with two refused prices the first opens: Thu Oct 8, typed first and first in the grid', async () => {
      await status(page).getByRole('button', { name: 'Discard' }).click();
      await marks.getByRole('button', { name: 'Previous page' }).click();
      await cell(OCT_8).fill('-2');
      await marks.getByRole('button', { name: 'Next page' }).click();
      await cell(AUG_31).fill('-1');
      await saveMarksOf(page, tA).click();
      await expect(marks.getByText('Sessions 1 to 20 of 27')).toBeVisible(READY);
      await expect(marks.getByRole('region', { name: `XYZ Mark, ${OCT_8}`, exact: true }).getByText(NEGATIVE)).toBeVisible(READY);
      await expect(cell(OCT_8)).toBeFocused();
    });
    await context.close();
  });
});
