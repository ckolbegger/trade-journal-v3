import {
  actionFormOf, cardHeader, cardList, createTrades, enterMark, expect, FOUR_TRADES, marksFamily, markRow, MONDAY_1700, onboardedAt, openPanelOf, openReview, panelHeader, PLAN, reachCard, reloadReview, status, test,
  tradeCard,
  type FixtureTrade, type TradeRef,
} from './support.ts';

const DATE = 'Mon Oct 12';

// FOUR_TRADES plus a second XYZ Trade (the card fixture's T-F): 50 shares at 50.00, Monday 10:30. T-A is the first XYZ Trade.
const T_F: FixtureTrade = {
  plan: { ...PLAN, symbol: 'XYZ', quantity: '50', entry: '50', stop: '48', target: '55' },
  fills: [['50', '50.00', '2026-10-12T10:30']],
};

// Creates the five Trades through the UI and opens the Review; returns the two XYZ Trades by their ids.
async function twoXyzReview(page: Parameters<typeof openReview>[0]): Promise<{ tA: TradeRef; tF: TradeRef }> {
  const ids = await createTrades(page, [...FOUR_TRADES, T_F]);
  await openReview(page);
  return { tA: { symbol: 'XYZ', tradeId: ids[0]!, label: 'T-A' }, tF: { symbol: 'XYZ', tradeId: ids[4]!, label: 'T-F' } };
}

test.describe('reach (decision 65)', () => {
  test('should open ABC’s collapsed card and its Marks panel and return ABC’s Monday row, Missing', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page);
    await openReview(page);
    // XYZ's card is open on load; ABC's is collapsed.
    await expect(cardHeader(page, 'XYZ')).toHaveAttribute('aria-expanded', 'true');
    await expect(cardHeader(page, 'ABC')).toHaveAttribute('aria-expanded', 'false');

    const row = await markRow(page, 'ABC', DATE);
    await expect(row).toContainText('Missing');
    await expect(row).toBeVisible();
    await expect(cardHeader(page, 'ABC')).toHaveAttribute('aria-expanded', 'true');
    await expect(cardHeader(page, 'XYZ')).toHaveAttribute('aria-expanded', 'false');
    await expect(panelHeader(page, 'ABC', 'Marks')).toHaveAttribute('aria-expanded', 'true');
    await context.close();
  });

  test('should leave XYZ’s card on its Action panel, with a typed Intent, unchanged when XYZ’s Action form is reached again', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page);
    await openReview(page);

    const form = await actionFormOf(page, 'XYZ');
    await form.getByRole('radio', { name: 'Exit', exact: true }).check();
    await form.getByLabel(/^Why are you taking this action\?/).fill('Stop is close');
    expect(await openPanelOf(page, 'XYZ')).toBe('Action');

    const again = await actionFormOf(page, 'XYZ');
    await expect(cardHeader(page, 'XYZ')).toHaveAttribute('aria-expanded', 'true');
    expect(await openPanelOf(page, 'XYZ')).toBe('Action');
    await expect(again.getByRole('radio', { name: 'Exit', exact: true })).toBeChecked();
    await expect(again.getByLabel(/^Why are you taking this action\?/)).toHaveValue('Stop is close');
    // Pressing an open card's header with unsaved work would have raised the hold message (A156).
    await expect(page.getByText(/^Save or discard what you entered for/)).toHaveCount(0);
    await context.close();
  });

  test('should fail naming XYZ’s and ABC’s cards when reaching ABC’s card is refused while XYZ’s card holds a Mark draft, and leave XYZ’s card open with its draft', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page);
    await openReview(page);

    const row = await markRow(page, 'XYZ', DATE);
    await row.getByLabel('Price').fill('52.00');
    const message = await reachCard(page, 'ABC').then(
      () => undefined,
      (error: unknown) => (error as Error).message,
    );
    expect(message).toMatch(/XYZ/);
    expect(message).toMatch(/ABC/);
    await expect(cardHeader(page, 'XYZ')).toHaveAttribute('aria-expanded', 'true');
    await expect(cardHeader(page, 'ABC')).toHaveAttribute('aria-expanded', 'false');
    await expect(row.getByLabel('Price')).toHaveValue('52.00');
    await context.close();
  });

  test('should reach ABC’s card after an earlier refusal once XYZ’s draft is discarded, though the earlier hold message was shown', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page);
    await openReview(page);

    const row = await markRow(page, 'XYZ', DATE);
    await row.getByLabel('Price').fill('52.00');
    await expect(reachCard(page, 'ABC')).rejects.toThrow(/XYZ/);
    await expect(page.getByRole('status').filter({ hasText: /^Save or discard what you entered for / })).toBeVisible();
    await row.getByLabel('Price').fill('');

    const card = await reachCard(page, 'ABC');
    await expect(card).toBeVisible();
    await expect(cardHeader(page, 'ABC')).toHaveAttribute('aria-expanded', 'true');
    await context.close();
  });

  test('should reach BRK’s card, not BRK.B’s, when both Trades are listed', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page, [
      { plan: { ...PLAN, symbol: 'BRK.B', quantity: '100', entry: '50', stop: '47.50', target: '56' }, fills: [['100', '50.00', '2026-10-12T10:00']] },
      { plan: { ...PLAN, symbol: 'BRK', quantity: '100', entry: '30', stop: '28', target: '36' }, fills: [['100', '30.00', '2026-10-12T10:00']] },
    ]);
    await openReview(page);

    const card = await reachCard(page, 'BRK');
    await expect(card).toBeVisible();
    await expect(cardHeader(page, 'BRK')).toHaveAttribute('aria-expanded', 'true');
    await expect(cardHeader(page, 'BRK.B')).toHaveAttribute('aria-expanded', 'false');
    await context.close();
  });

  test('should return the Marks family’s row for XYZ on a previous release’s Review (dist-releases/d4)', async ({ server, profile }) => {
    server.use('dist-releases/d4');
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page);
    await openReview(page);
    await expect(status(page)).toBeVisible();

    const row = await markRow(page, 'XYZ', DATE);
    await expect(marksFamily(page).getByRole('region', { name: `XYZ Mark, ${DATE}`, exact: true })).toHaveCount(1);
    await expect(row).toContainText('Missing');
    await expect(row.getByRole('button', { name: 'Enter', exact: true })).toBeVisible();
    await context.close();
  });
});

test.describe('reach by Trade (decision 68)', () => {
  test('should open the second XYZ Trade’s collapsed card by its Trade id and return its Monday row, leaving the first XYZ card collapsed', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    const { tA, tF } = await twoXyzReview(page);
    // One XYZ card is open on load; the helper must open the other by its Trade id.
    await expect(cardHeader(page, tA)).toHaveAttribute('aria-expanded', 'true');
    await expect(cardHeader(page, tF)).toHaveAttribute('aria-expanded', 'false');

    const row = await markRow(page, tF, DATE);
    await expect(row).toContainText('Missing');
    await expect(row).toBeVisible();
    await expect(tradeCard(page, tF).getByRole('region', { name: `XYZ Mark, ${DATE}`, exact: true })).toHaveCount(1);
    await expect(cardHeader(page, tF)).toHaveAttribute('aria-expanded', 'true');
    await expect(cardHeader(page, tA)).toHaveAttribute('aria-expanded', 'false');
    await expect(panelHeader(page, tF, 'Marks')).toHaveAttribute('aria-expanded', 'true');
    await context.close();
  });

  test('should fail naming both XYZ cards, the holder found by its list item’s Trade id, when reaching the second is refused while the first holds a Mark draft', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    const { tA, tF } = await twoXyzReview(page);

    const row = await markRow(page, tA, DATE);
    await row.getByLabel('Price').fill('52.00');
    const message = await reachCard(page, tF).then(
      () => undefined,
      (error: unknown) => (error as Error).message,
    );
    // Both cards read "XYZ", so the message tells them apart by their labels.
    expect(message).toMatch(/Cannot reach T-F's card: T-A's card holds unsaved work/);
    await expect(cardHeader(page, tA)).toHaveAttribute('aria-expanded', 'true');
    await expect(cardHeader(page, tF)).toHaveAttribute('aria-expanded', 'false');
    await expect(row.getByLabel('Price')).toHaveValue('52.00');
    await context.close();
  });

  test('should reach each XYZ card by its Trade after the cards re-sort and after a reload', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    const { tA, tF } = await twoXyzReview(page);
    const order = () => cardList(page).locator('li.review-card').evaluateAll((items) => items.map((li) => li.getAttribute('data-trade-id')));
    // The two Trades differ in their summary lines, so a header that opens is shown to be the right Trade's.
    const reachEach = async (): Promise<void> => {
      for (const [card, other, summary] of [[tA, tF, /^Review XYZ Long 100 shares @ \$50\.18/], [tF, tA, /^Review XYZ Long 50 shares @ \$50\.00/]] as const) {
        await expect(await reachCard(page, card)).toBeVisible();
        await expect(cardHeader(page, card)).toHaveAccessibleName(summary);
        await expect(cardHeader(page, card)).toHaveAttribute('aria-expanded', 'true');
        await expect(cardHeader(page, other)).toHaveAttribute('aria-expanded', 'false');
      }
    };

    await reachEach();
    const before = await order();
    // XYZ's Mark covers both Trades, so both XYZ cards drop below the cards still missing a Mark.
    await enterMark(page, tF, DATE, '52.00');
    expect(await order()).not.toEqual(before);
    await reachEach();

    await reloadReview(page);
    await reachEach();
    await context.close();
  });
});
