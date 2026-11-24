import { expectNoSidewaysScroll } from '../d7p/support.ts';
import { createTrades, enterMark, expect, FOUR_TRADES, MONDAY_1700, onboardedAt, openReview, reachPanel, saveAction, test } from '../d4/support.ts';
import { atBothWidths } from './support.ts';

test.describe('T95.40 The sale form in the Review card', () => {
  test('should lay the form out in one column at 375 wide with every field kept', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    // ABC: 100 shares at $30.00; a Mark of $29.00 and an Exit saved with its reason, so the card offers the sale.
    await createTrades(page, [FOUR_TRADES[1]!]);
    await openReview(page);
    await enterMark(page, 'ABC', 'Mon Oct 12', '29.00');
    await saveAction(page, 'Exit', 'Taking the gain.', 'ABC');
    const panel = await reachPanel(page, 'ABC', 'Action');
    await panel.getByRole('button', { name: 'Record the sale' }).click();
    const form = panel.locator('form.plan-form');
    await expect(form.getByRole('group', { name: 'Execution 1' })).toBeVisible();
    await atBothWidths(page, async (width) => {
      const row = form.getByRole('group', { name: 'Execution 1' });
      // Every field of the sale is there, and the way back and the two buttons.
      for (const label of ['Quantity', 'Price', 'Fee', 'Time']) await expect(row.getByLabel(label)).toBeVisible();
      await expect(form.getByRole('button', { name: 'Add Execution' })).toBeVisible();
      await expect(form.getByRole('button', { name: 'Add more' })).toBeVisible();
      await expect(form.getByRole('button', { name: 'Save exit' })).toBeVisible();
      await expect(form.getByRole('button', { name: 'Back to the Review' })).toBeVisible();
      await expect(form.getByRole('button', { name: 'Cancel' })).toBeVisible();
      // At 375 the fields stack: one left edge, each below the one before.
      if (width === 375) {
        const boxes = [];
        for (const label of ['Quantity', 'Price', 'Fee', 'Time']) boxes.push((await row.getByLabel(label).boundingBox())!);
        expect(new Set(boxes.map((b) => Math.round(b.x))).size, 'one column at 375').toBe(1);
        for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.y, 'each field below the one before').toBeGreaterThan(boxes[i - 1]!.y);
      }
      for (const box of [await form.boundingBox()]) expect(box!.x + box!.width, `the form inside the viewport at ${width}`).toBeLessThanOrEqual(width + 0.5);
      await expectNoSidewaysScroll(page, `sale form at ${width} px`);
    });
    await context.close();
  });
});
