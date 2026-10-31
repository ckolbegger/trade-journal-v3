import { actionFormOf, cardHeader, createTrades, expect, marksFamily, markRow, MONDAY_1700, onboardedAt, openPanelOf, openReview, panelHeader, PLAN, reachCard, status, test } from './support.ts';

const DATE = 'Mon Oct 12';

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
