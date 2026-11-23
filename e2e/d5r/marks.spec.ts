import {
  expectMark, expectMarksSaved, marksStepOf, markEditorOf, markInputOf, actionFormOf, cardHeader, createCardFixture, enterMark, expect, FRIDAY, MONDAY, MONDAY_1700, observationsOf, onboardedAt, openReview, probe, remainsOf, meterOf, collapseOpenCard, test, THURSDAY, workspaceOf, saveMarksButton, openCardFixture,
} from './support.ts';

const NOT_A_PRICE = 'Enter a price as a number, with at most 6 decimal places.';

test.describe('B5R.3 Shared Mark', () => {
  test('should move T-A’s collapsed meter at once when XYZ is saved in T-F’s card, show XYZ saved there as also held, and store one observation', async ({ profile, copySetup }) => {
    const { context, page, 'T-A': tA, 'T-F': tF } = await openCardFixture(profile, copySetup);
    await openReview(page);
    // The open card draws no meter: T-A's card is collapsed to read it, and opened again.
    await collapseOpenCard(page);
    await expect(meterOf(page, tA)).toHaveAccessibleName('Mark missing: XYZ, Mon Oct 12 Stop −$270.00, Target +$580.00.');
    await cardHeader(page, tA).click();
    await expect(cardHeader(page, tA)).toHaveAttribute('aria-expanded', 'true');

    // Enter XYZ once, in the Marks step, and press Save Marks: it is one row for both Trades, and T-A's card stays as it was.
    await enterMark(page, tF, MONDAY, '52.00');
    await expect(cardHeader(page, tA)).toHaveAttribute('aria-expanded', 'true');
    await collapseOpenCard(page);
    await expect(meterOf(page, tA)).toHaveAccessibleName(/^P&L \+\$180\.00, 31% of the way to the Target\. Stop −\$270\.00, Target \+\$580\.00\.$/);
    await expect(remainsOf(page, tA)).toHaveText('To do: Reflection, Action');

    // The saved cell, chosen, names the Trades holding XYZ by their Trade-list summary lines, linked to them (decision 67).
    await markEditorOf(page, tA, MONDAY);
    const today = marksStepOf(page);
    await expect(today).toContainText('held by');
    await expect(today).toContainText('Long 50 shares @ $50.00');
    await expect(today.getByRole('link', { name: 'Long 50 shares @ $50.00' })).toHaveAttribute('href', /^\/trades\//);
    await expectMark(page, tA, MONDAY, 'Manual');
    await expectMark(page, tA, MONDAY, '52');

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

    const monday = await markEditorOf(page, tA, MONDAY);
    const friday = await markEditorOf(page, tA, FRIDAY);
    await (await markInputOf(page, tA, MONDAY)).fill('52.00');
    await (await markInputOf(page, tA, FRIDAY)).fill('abc');
    await (await markInputOf(page, tA, THURSDAY)).fill('49.00');
    await expect(saveMarksButton(page)).toHaveText('Save Marks (3)');
    await saveMarksButton(page).click();

    // The issue sits beside the invalid row with focus on it; every draft is kept; nothing is stored.
    await expect(friday.getByText(NOT_A_PRICE)).toBeVisible();
    await expect(marksStepOf(page).getByRole('textbox', { name: `XYZ Mark, ${FRIDAY}`, exact: true })).toBeFocused();
    await expect(await markInputOf(page, tA, MONDAY)).toHaveValue('52.00');
    await expect(await markInputOf(page, tA, FRIDAY)).toHaveValue('abc');
    await expect(await markInputOf(page, tA, THURSDAY)).toHaveValue('49.00');
    await expect(monday.getByText(NOT_A_PRICE)).toHaveCount(0);
    await expect(saveMarksButton(page)).toHaveText('Save Marks (3)');
    expect(observationsOf(workspaceOf(await probe(page))!)).toEqual([]);

    // Fixing the price and pressing Save Marks again saves all three.
    await (await markInputOf(page, tA, FRIDAY)).fill('51.00');
    await saveMarksButton(page).click();
    await expectMarksSaved(page);
    const stored = observationsOf(workspaceOf(await probe(page))!);
    expect(stored.map((o) => `${o.tradingDate} ${Number(o.marks[0]!.price)}`).sort()).toEqual(['2026-10-08 49', '2026-10-09 51', '2026-10-12 52']);
    await context.close();
  });
});

test.describe('B5R.5 Unsaved work holds the card', () => {
  test('should keep the card open with the message while an Action value is entered, and write nothing', async ({ profile, copySetup }) => {
    const { context, page, 'T-A': tA, 'T-B': tB } = await openCardFixture(profile, copySetup);
    await openReview(page);
    const before = await probe(page);

    await (await actionFormOf(page, tA)).getByRole('radio', { name: 'Exit', exact: true }).check();
    // Press another card's header (navigation: raw locators).
    await cardHeader(page, tB).click();
    await expect(page.getByRole('status').filter({ hasText: 'Save or discard what you entered for XYZ (Long 100 shares @ $50.18) to leave it.' })).toBeVisible();
    await expect(cardHeader(page, tA)).toHaveAttribute('aria-expanded', 'true');
    await expect(cardHeader(page, tB)).toHaveAttribute('aria-expanded', 'false');
    expect(await probe(page)).toEqual(before);
    await context.close();
  });

  test('should open the other card with no message while a price is typed, keep the draft, empty it with Discard, and write nothing', async ({ profile, copySetup }) => {
    const { context, page, 'T-A': tA, 'T-B': tB } = await openCardFixture(profile, copySetup);
    await openReview(page);
    const before = await probe(page);

    await (await markInputOf(page, tA, MONDAY)).fill('52.00');
    await cardHeader(page, tB).click();
    await expect(cardHeader(page, tB)).toHaveAttribute('aria-expanded', 'true');
    await expect(cardHeader(page, tA)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText('Save or discard what you entered for')).toHaveCount(0);
    // The draft stays with the Review: the Marks step still counts it, and its Discard empties it.
    await expect(saveMarksButton(page)).toHaveText('Save Marks (1)');
    await marksStepOf(page).getByRole('button', { name: 'Discard' }).click();
    await expectMarksSaved(page);
    expect(await probe(page)).toEqual(before);
    await context.close();
  });
});

test.describe('B5R.8 Changed evidence', () => {
  test('should show a Conflict with the other tab’s value, keep the draft, and write nothing from the first tab', async ({ profile, copySetup }) => {
    const { context, page, 'T-A': tA } = await openCardFixture(profile, copySetup);
    await openReview(page);

    // A second tab saves XYZ while T-A's card is open in the first.
    const second = await context.newPage();
    await second.goto('/');
    await openReview(second);
    await enterMark(second, tA, MONDAY, '51.00');

    await (await markInputOf(page, tA, MONDAY)).fill('52.00');
    await saveMarksButton(page).click();

    // The draft sits over the Mark in its cell, so the notice says what the Mark is now.
    const conflict = marksStepOf(page).getByRole('alert').filter({ hasText: 'This Mark changed after you opened it. Nothing was saved.' });
    await expect(conflict).toBeVisible();
    await expect(conflict).toContainText('It is now $51.00.');
    await expect(await markInputOf(page, tA, MONDAY)).toHaveValue('52.00');
    await expect(saveMarksButton(page)).toHaveText('Save Marks (1)');
    const observations = observationsOf(workspaceOf(await probe(page))!);
    expect(observations).toHaveLength(1);
    expect(observations[0]!.marks.map((m) => Number(m.price))).toEqual([51]);
    expect(observations[0]!.marks[0]!.revisionNumber).toBe(1);
    await context.close();
  });
});
