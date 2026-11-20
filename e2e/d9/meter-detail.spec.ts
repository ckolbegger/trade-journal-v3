import { BREN, build, closeOf, detail, expect, expectTrackDashed, READY, setClock, test } from './support.ts';

test.use({ actionTimeout: 15_000 });

// B9.10 (plan section 7.2, W51, P130): R-BREN-U on Trade Detail. At Mon 11-16 the meter is the first thing in the Conditions card, above the conditions, named by its figures with no
// visible words; on a day with no Mark (Tue 11-17) the track is dashed, named by the reason, and keeps the lines and the session before's result.
const MON_1116 = 'P&L +$988.00, past the Target by $32.00. Realized +$478.00. Stop +$316.00, Target +$956.00. Down from +$1,138.00 on Fri Nov 13.';

test.describe('B9.10 The meter on Trade Detail', () => {
  test('should show the meter at the top of the Conditions card, named by its figures, with no visible words', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    const card = page.locator('.conditions-card');
    await expect(card).toBeVisible(READY);
    const meter = card.getByRole('img');
    await expect(meter).toHaveCount(1);
    await expect(meter).toHaveAccessibleName(MON_1116);
    await expect(meter).toHaveAttribute('title', MON_1116);
    await expect(meter).toHaveText('');
    await expect(meter).toHaveAttribute('data-state', 'filled');
    // The meter is the card's first part after its heading, and sits above the first condition.
    const order = await card.evaluate((el) => [...el.children].map((child) => (child.matches('.meter') ? 'meter' : child.tagName.toLowerCase())));
    expect(order.slice(0, 3)).toEqual(['h2', 'meter', 'ul']);
    const meterBox = (await meter.boundingBox())!;
    const firstCondition = (await detail.conditionBlocks(page).first().boundingBox())!;
    expect(meterBox.y + meterBox.height).toBeLessThanOrEqual(firstCondition.y + 0.5);
    await expectTrackDashed(meter, false);
    await expect(meter.getByTestId('meter-pointer')).toHaveAttribute('data-shape', 'square');
    await context.close();
  });

  test('should show the dashed track on a day with a missing Mark, named by the reason, with the lines and the session before kept', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page, trade } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    // Tue 11-17 has no Mark yet.
    await setClock(context, page, closeOf('2026-11-17'), `/trades/${trade.tradeId}`);
    await expect(detail.heading(page, 'BREN')).toBeVisible(READY);
    const meter = page.locator('.conditions-card').getByRole('img');
    await expect(meter).toHaveCount(1);
    await expect(meter).toHaveAttribute('data-state', 'empty');
    await expect(meter).toHaveAccessibleName(/^Mark missing: /);
    await expect(meter).toHaveAccessibleName(/Realized \+\$478\.00\. Stop \+\$316\.00, Target \+\$956\.00\. Session before \+\$988\.00 on Mon Nov 16\.$/);
    await expect(meter.getByTestId('meter-pointer')).toHaveCount(0);
    await expectTrackDashed(meter, true);
    await expect(meter).toHaveText('');
    await context.close();
  });
});
