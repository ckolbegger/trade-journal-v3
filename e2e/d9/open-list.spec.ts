import {
  build, closeOf, DALE, expect, firstPage, launchAt, expectTrackDashed, listMeters, MON_1123_1700, openFourTradesFri, openOpenList, openReview, collapseOpenCard, reviewMeters, test,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// B9.9 (plan section 7.2, W51, W52): the four Trades of I9.10 open at Fri 11-13 (R-BREN-U, R-CORV-D, R-DALE-D, R-AXIO-U) in one Workspace. The Open list shows the rows in the Review's order,
// under "In the Review's order", and each row's meter is named as W51 words it; a Settlement Due row has the dashed track.
const NAMES: Record<string, string> = {
  BREN: 'P&L +$1,138.00, past the Target by $182.00. Realized +$478.00. Stop +$316.00, Target +$956.00. Up from +$982.00 on Thu Nov 12.',
  CORV: 'P&L +$957.00, past the Target by $90.00. Stop −$318.00, Target +$867.00. Down from +$1,086.00 on Thu Nov 12.',
  DALE: 'P&L −$1,476.00, past the Stop by $213.00. Realized −$495.00. Stop −$1,263.00, Target −$273.00. Down from −$1,272.00 on Thu Nov 12.',
  AXIO: 'P&L +$620.00, 58% of the way to the Target. Stop −$740.00, Target +$1,060.00. Down from +$680.00 on Thu Nov 12.',
};

async function fourTrades(profile: Parameters<typeof openFourTradesFri>[0], copySetup: Parameters<typeof openFourTradesFri>[1]) {
  const { context, page, refs: trades } = await openFourTradesFri(profile, copySetup);
  return { context, page, symbolOf: Object.fromEntries(Object.entries(trades).map(([symbol, trade]) => [trade.tradeId, symbol])) as Record<string, string> };
}

test.describe('B9.9 The Open list', () => {
  test('should list the Open Trades in the Review’s order under the line In the Review’s order, each row’s meter named per W51', async ({ profile, copySetup }) => {
    test.setTimeout(420_000);
    const { context, page, symbolOf } = await fourTrades(profile, copySetup);
    await page.goto('/');
    await openReview(page);
    // The open card draws no header meter (T95.16): its drawing in the "Now" box (T95.17) is read, then it is collapsed so every card's header shows its meter.
    const drawing = page.locator('li.review-card .now-draw').getByRole('img');
    await expect(drawing).toHaveCount(1);
    const drawn = { id: await page.locator('li.review-card:has(.now-draw)').getAttribute('data-trade-id'), name: await drawing.getAttribute('aria-label') };
    await collapseOpenCard(page);
    const review = await reviewMeters(page);
    expect(review).toHaveLength(4);
    await openOpenList(page);
    await expect(page.getByText("In the Review's order", { exact: true })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Open Trades' }).locator('caption')).toHaveText('Open Trades');
    const rows = await listMeters(page);
    // The rows are the Review's cards in the Review's order, each with exactly one meter shown, named as the card's meter is.
    expect(rows.map((row) => row.id)).toEqual(review.map((card) => card.id));
    // Past the Stop first, then the two past the Target (the nearer to its range's end first), then the Trade between its lines.
    expect(rows.map((row) => symbolOf[row.id])).toEqual(['DALE', 'BREN', 'CORV', 'AXIO']);
    for (const [index, row] of rows.entries()) {
      expect(row.names, `row ${index + 1} (${symbolOf[row.id]}) shows one meter`).toHaveLength(1);
      expect(row.names[0]).toBe(review[index]!.name);
      expect(row.names[0], symbolOf[row.id]).toBe(NAMES[symbolOf[row.id]!]);
    }
    // The open card's drawing is named as that Trade's row in the list is.
    expect(rows.find((row) => row.id === drawn.id)?.names[0]).toBe(drawn.name);
    await context.close();
  });

  test('should show the dashed track on a Settlement Due row', async ({ profile }) => {
    test.setTimeout(420_000);
    // R-DALE-U: Marks to Thu 11-19 saved while the put is open; the list is read on Mon 11-23, with the put expired and not yet recorded.
    const built = await build(profile, DALE, closeOf('2026-11-19'), 13, 0);
    await built.context.close();
    const context = await launchAt(profile, MON_1123_1700);
    const page = await firstPage(context);
    await page.goto('/');
    await openOpenList(page);
    const row = page.getByRole('table', { name: 'Open Trades' }).getByRole('row', { name: /DALE/ });
    await expect(row.getByText('Settlement Due').locator('visible=true').first()).toBeVisible();
    const meter = row.getByRole('img');
    await expect(meter).toHaveCount(1);
    await expect(meter).toHaveAttribute('data-state', 'empty');
    await expectTrackDashed(meter, true);
    await expect(meter.getByTestId('meter-pointer')).toHaveCount(0);
    await context.close();
  });
});
