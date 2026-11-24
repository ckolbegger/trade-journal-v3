import { expectNoSidewaysScroll } from '../d7p/support.ts';
import { actionFormOf, createTrades, enterMark, expect, FOUR_TRADES, MONDAY_1700, onboardedAt, openReview, test } from '../d4/support.ts';
import { atBothWidths } from './support.ts';

test.describe('B95.12 The Action form', () => {
  test('should put the choices on two rows at 375 wide with every field kept', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    // ABC: 100 shares at $30.00, a Stop at $28.00 and a Target at $36.00; a Mark of $29.00 puts it inside its lines, so the Plan says hold.
    await createTrades(page, [FOUR_TRADES[1]!]);
    await openReview(page);
    await enterMark(page, 'ABC', 'Mon Oct 12', '29.00');
    const form = await actionFormOf(page, 'ABC');
    await expect(form.getByText('Inside its lines. The Plan says hold.')).toBeVisible();
    await atBothWidths(page, async (width) => {
      const boxes = [];
      for (const label of await form.locator('label.chip').all()) boxes.push((await label.boundingBox())!);
      expect(boxes, `four choices at ${width}`).toHaveLength(4);
      const rows = [...new Set(boxes.map((b) => Math.round(b.y)))];
      expect(rows.length, `the choices sit on ${width === 375 ? 'two rows' : 'one row'} at ${width}`).toBe(width === 375 ? 2 : 1);
      if (width === 375) expect(boxes.map((b) => Math.round(b.y)), 'two choices on each row').toEqual([rows[0], rows[0], rows[1], rows[1]]);
      for (const box of boxes) expect(box.x + box.width, `a choice inside the viewport at ${width}`).toBeLessThanOrEqual(width + 0.5);
      // Every field is still there.
      await expect(form.getByRole('textbox', { name: /^Why\?/ })).toBeVisible();
      await expect(form.getByRole('group', { name: 'Conviction now (optional)' }).getByRole('button')).toHaveCount(5);
      await expect(form.getByText('Add more: what you decided against, a note')).toBeVisible();
      await expect(form.getByRole('button', { name: 'Discard' })).toBeVisible();
      await expect(form.getByRole('button', { name: 'Save Hold' })).toBeVisible();
      await expectNoSidewaysScroll(page, `Action form at ${width} px`);
    });
    await context.close();
  });
});
