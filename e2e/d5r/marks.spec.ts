import {
  cardHeader, createCardFixture, enterMark, expect, FRIDAY, markCell, markRow, MONDAY, MONDAY_1700, observationsOf, onboardedAt, openReview, probe, remainsOf, reachPanel, saveMarksOf, meterOf, test, THURSDAY, tradeCard, workspaceOf,
} from './support.ts';

const NOT_A_PRICE = 'Enter a price as a number, with at most 6 decimal places.';

test.describe('B5R.3 Shared Mark', () => {
  test('should move T-A’s collapsed meter at once when XYZ is saved in T-F’s card, show XYZ saved there as also held, and store one observation', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    const { 'T-A': tA, 'T-F': tF } = await createCardFixture(page);
    await openReview(page);
    await expect(meterOf(page, tA)).toHaveAccessibleName('Mark missing: XYZ, Mon Oct 12 Stop −$270.00, Target +$580.00.');

    // Enter XYZ in T-F's card and press Save Marks; that closes T-A's card (it held no draft).
    await enterMark(page, tF, MONDAY, '52.00');
    await expect(cardHeader(page, tA)).toHaveAttribute('aria-expanded', 'false');
    await expect(meterOf(page, tA)).toHaveAccessibleName(/^P&L \+\$180\.00, 31% of the way to the Target\. Stop −\$270\.00, Target \+\$580\.00\.$/);
    await expect(remainsOf(page, tA)).toHaveText('1 reflection due · Action');

    // Opening T-A's card shows XYZ saved, and that T-F's card holds it too.
    await reachPanel(page, tA, 'Marks');
    const today = await markRow(page, tA, MONDAY);
    // It names T-F by its Trade-list summary line (50 shares at 50.00), linked to it (decision 67).
    await expect(today).toContainText('also held by Long 50 shares @ $50.00');
    await expect(today.getByRole('link', { name: 'Long 50 shares @ $50.00' })).toHaveAttribute('href', /^\/trades\//);
    await expect(await markRow(page, tA, MONDAY)).toContainText('Manual');
    await expect(await markRow(page, tA, MONDAY)).toContainText('52');

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
    const { 'T-A': tA } = await createCardFixture(page, { earlierDay: '2026-10-08' });
    await openReview(page);

    const monday = await markRow(page, tA, MONDAY);
    const friday = await markRow(page, tA, FRIDAY);
    await (await markCell(page, tA, MONDAY)).fill('52.00');
    await (await markCell(page, tA, FRIDAY)).fill('abc');
    await (await markCell(page, tA, THURSDAY)).fill('49.00');
    await expect(saveMarksOf(page, tA)).toHaveText('Save Marks (3)');
    await saveMarksOf(page, tA).click();

    // The issue sits beside the invalid row with focus on it; every draft is kept; nothing is stored.
    await expect(friday.getByText(NOT_A_PRICE)).toBeVisible();
    await expect(tradeCard(page, tA).getByRole('textbox', { name: `XYZ Mark, ${FRIDAY}`, exact: true })).toBeFocused();
    await expect(await markCell(page, tA, MONDAY)).toHaveValue('52.00');
    await expect(await markCell(page, tA, FRIDAY)).toHaveValue('abc');
    await expect(await markCell(page, tA, THURSDAY)).toHaveValue('49.00');
    await expect(monday.getByText(NOT_A_PRICE)).toHaveCount(0);
    await expect(saveMarksOf(page, tA)).toHaveText('Save Marks (3)');
    expect(observationsOf(workspaceOf(await probe(page))!)).toEqual([]);

    // Fixing the price and pressing Save Marks again saves all three.
    await (await markCell(page, tA, FRIDAY)).fill('51.00');
    await saveMarksOf(page, tA).click();
    await expect(tradeCard(page, 'XYZ').locator('section[aria-label="Marks"] button', { hasText: /^Save Marks/ })).toHaveText('Save Marks (0)');
    const stored = observationsOf(workspaceOf(await probe(page))!);
    expect(stored.map((o) => `${o.tradingDate} ${Number(o.marks[0]!.price)}`).sort()).toEqual(['2026-10-08 49', '2026-10-09 51', '2026-10-12 52']);
    await context.close();
  });
});

test.describe('B5R.5 Unsaved work holds the card', () => {
  test('should keep the card open with the message while a price is typed, open the other card after Discard, and write nothing', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    const { 'T-A': tA, 'T-B': tB } = await createCardFixture(page);
    await openReview(page);
    const before = await probe(page);

    await (await markCell(page, tA, MONDAY)).fill('52.00');
    // Press another card's header (navigation: raw locators).
    await cardHeader(page, tB).click();
    await expect(page.getByRole('status').filter({ hasText: 'Save or discard what you entered for XYZ (Long 100 shares @ $50.18) to leave it.' })).toBeVisible();
    await expect(cardHeader(page, tA)).toHaveAttribute('aria-expanded', 'true');
    await expect(cardHeader(page, tB)).toHaveAttribute('aria-expanded', 'false');

    await tradeCard(page, 'XYZ').getByRole('button', { name: 'Discard' }).click();
    await cardHeader(page, tB).click();
    await expect(cardHeader(page, tB)).toHaveAttribute('aria-expanded', 'true');
    await expect(cardHeader(page, tA)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText('Save or discard what you entered for')).toHaveCount(0);
    expect(await probe(page)).toEqual(before);
    await context.close();
  });
});

test.describe('B5R.8 Changed evidence', () => {
  test('should show a Conflict with the other tab’s value, keep the draft, and write nothing from the first tab', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    const { 'T-A': tA } = await createCardFixture(page);
    await openReview(page);

    // A second tab saves XYZ while T-A's card is open in the first.
    const second = await context.newPage();
    await second.goto('/');
    await openReview(second);
    await enterMark(second, tA, MONDAY, '51.00');

    const row = await markRow(page, tA, MONDAY);
    await (await markCell(page, tA, MONDAY)).fill('52.00');
    await saveMarksOf(page, tA).click();

    await expect(tradeCard(page, 'XYZ').getByRole('alert').filter({ hasText: 'This Mark changed after you opened it. Nothing was saved.' })).toBeVisible();
    await expect(row).toContainText('51');
    await expect(await markCell(page, tA, MONDAY)).toHaveValue('52.00');
    await expect(saveMarksOf(page, tA)).toHaveText('Save Marks (1)');
    const observations = observationsOf(workspaceOf(await probe(page))!);
    expect(observations).toHaveLength(1);
    expect(observations[0]!.marks.map((m) => Number(m.price))).toEqual([51]);
    expect(observations[0]!.marks[0]!.revisionNumber).toBe(1);
    await context.close();
  });
});
