import {
  createCardFixture, enterMarkOf, expect, FRIDAY, headerOf, markRowOf, MONDAY, MONDAY_1700, observationsOf, onboardedAt, openReview, probe, remainsOf, reachTradePanel, saveMarksOf, sliderOf, tagCards, test, THURSDAY, tradeCard, workspaceOf,
} from './support.ts';

const NOT_A_PRICE = 'Enter a price as a number, with at most 6 decimal places.';

test.describe('B5R.3 Shared Mark', () => {
  test('should move T-A’s collapsed slider at once when XYZ is saved in T-F’s card, show XYZ saved there as also held, and store one observation', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createCardFixture(page);
    await openReview(page);
    await tagCards(page);
    await expect(sliderOf(page, 'T-A')).toHaveAccessibleName('Mark missing: XYZ, Mon Oct 12');

    // Enter XYZ in T-F's card and press Save Marks; that closes T-A's card (it held no draft).
    await enterMarkOf(page, 'T-F', MONDAY, '52.00');
    await expect(headerOf(page, 'T-A')).toHaveAttribute('aria-expanded', 'false');
    await expect(sliderOf(page, 'T-A')).toHaveAccessibleName(/^53% of the way from the Stop to the Target, entry at 32%\. Risk to stop \$450\.00, P&L \+\$180\.00, Reward : risk 0\.89\.$/);
    await expect(remainsOf(page, 'T-A')).toHaveText('1 reflection due · Action');

    // Opening T-A's card shows XYZ saved, and that T-F's card holds it too.
    const marks = await reachTradePanel(page, 'T-A', 'Marks');
    const today = marks.getByRole('list', { name: "Today's Marks" }).getByRole('listitem').first();
    await expect(today).toContainText('also held by XYZ');
    await expect(today.getByRole('link', { name: 'XYZ' })).toHaveAttribute('href', /^\/trades\//);
    await expect(await markRowOf(page, 'T-A', MONDAY)).toContainText('Manual');
    await expect(await markRowOf(page, 'T-A', MONDAY)).toContainText('52');

    const observations = observationsOf(workspaceOf(await probe(page))!);
    expect(observations).toHaveLength(1);
    expect(observations[0]!.instrumentKey).toBe('XYZ');
    expect(observations[0]!.marks).toHaveLength(1);
    expect(Number(observations[0]!.marks[0]!.price)).toBe(52);
    await context.close();
  });
});

test.describe('B5R.4 Invalid price saves nothing', () => {
  test('should show the issue beside the invalid row with focus on it and keep every draft with nothing stored, then save all three once it is fixed', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    // T-A's card holds only two rows in the card fixture (Monday and Friday); the third price needs a second earlier
    // session, so T-A's first Position Change is on Thursday here.
    await createCardFixture(page, { earlierDay: '2026-10-08' });
    await openReview(page);
    await tagCards(page);

    const monday = await markRowOf(page, 'T-A', MONDAY);
    const friday = await markRowOf(page, 'T-A', FRIDAY);
    const thursday = await markRowOf(page, 'T-A', THURSDAY);
    await monday.getByLabel('Price').fill('52.00');
    await friday.getByLabel('Price').fill('abc');
    await thursday.getByLabel('Price').fill('49.00');
    await expect(saveMarksOf(page, 'T-A')).toHaveText('Save Marks (3)');
    await saveMarksOf(page, 'T-A').click();

    // The issue sits beside the invalid row with focus on it; every draft is kept; nothing is stored.
    await expect(friday.getByText(NOT_A_PRICE)).toBeVisible();
    await expect(friday.getByLabel('Price')).toBeFocused();
    await expect(monday.getByLabel('Price')).toHaveValue('52.00');
    await expect(friday.getByLabel('Price')).toHaveValue('abc');
    await expect(thursday.getByLabel('Price')).toHaveValue('49.00');
    await expect(monday.getByText(NOT_A_PRICE)).toHaveCount(0);
    await expect(saveMarksOf(page, 'T-A')).toHaveText('Save Marks (3)');
    expect(observationsOf(workspaceOf(await probe(page))!)).toEqual([]);

    // Fixing the price and pressing Save Marks again saves all three.
    await friday.getByLabel('Price').fill('51.00');
    await saveMarksOf(page, 'T-A').click();
    await expect(tradeCard(page, 'XYZ').locator('section[aria-label="Marks"] button', { hasText: /^Save Marks/ })).toHaveText('Save Marks (0)');
    const stored = observationsOf(workspaceOf(await probe(page))!);
    expect(stored.map((o) => `${o.tradingDate} ${Number(o.marks[0]!.price)}`).sort()).toEqual(['2026-10-08 49', '2026-10-09 51', '2026-10-12 52']);
    await context.close();
  });
});

test.describe('B5R.5 Unsaved work holds the card', () => {
  test('should keep the card open with the message while a price is typed, open the other card after Discard, and write nothing', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createCardFixture(page);
    await openReview(page);
    await tagCards(page);
    const before = await probe(page);

    await (await markRowOf(page, 'T-A', MONDAY)).getByLabel('Price').fill('52.00');
    // Press another card's header (navigation: raw locators).
    await headerOf(page, 'T-B').click();
    await expect(page.getByRole('status').filter({ hasText: 'Save or discard what you entered for XYZ to leave it.' })).toBeVisible();
    await expect(headerOf(page, 'T-A')).toHaveAttribute('aria-expanded', 'true');
    await expect(headerOf(page, 'T-B')).toHaveAttribute('aria-expanded', 'false');

    await tradeCard(page, 'XYZ').getByRole('button', { name: 'Discard' }).click();
    await headerOf(page, 'T-B').click();
    await expect(headerOf(page, 'T-B')).toHaveAttribute('aria-expanded', 'true');
    await expect(headerOf(page, 'T-A')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText('Save or discard what you entered for')).toHaveCount(0);
    expect(await probe(page)).toEqual(before);
    await context.close();
  });
});

test.describe('B5R.8 Changed evidence', () => {
  test('should show a Conflict with the other tab’s value, keep the draft, and write nothing from the first tab', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createCardFixture(page);
    await openReview(page);
    await tagCards(page);

    // A second tab saves XYZ while T-A's card is open in the first.
    const second = await context.newPage();
    await second.goto('/');
    await openReview(second);
    await tagCards(second);
    await enterMarkOf(second, 'T-A', MONDAY, '51.00');

    const row = await markRowOf(page, 'T-A', MONDAY);
    await row.getByLabel('Price').fill('52.00');
    await saveMarksOf(page, 'T-A').click();

    await expect(tradeCard(page, 'XYZ').getByRole('alert').filter({ hasText: 'This Mark changed after you opened it. Nothing was saved.' })).toBeVisible();
    await expect(row).toContainText('51');
    await expect(row.getByLabel('Price')).toHaveValue('52.00');
    await expect(saveMarksOf(page, 'T-A')).toHaveText('Save Marks (1)');
    const observations = observationsOf(workspaceOf(await probe(page))!);
    expect(observations).toHaveLength(1);
    expect(observations[0]!.marks.map((m) => Number(m.price))).toEqual([51]);
    expect(observations[0]!.marks[0]!.revisionNumber).toBe(1);
    await context.close();
  });
});
