import {
  actionEntriesOf, answerDebtOf, cardList, completion, createCardFixture, createRoutineTrades, enterMarkOf, entriesWithSettledDebt, expect, fillDebtAnswers, firstPage, headerOf, launchAt, MONDAY, MONDAY_1700, observationsOf,
  onboardedAt, openReview, panelHeaderOf, probe, reflectionsOfTrade, remainsOf, saveActionOf, sliderOf, tagCards, test, tradeCard, workspaceOf,
} from './support.ts';

const OPEN_HEADERS = '.review-card-head button[aria-expanded="true"]';

test.describe('B5R.1 Review end to end on cards', () => {
  test('should open the first card not Done on load, update the figures and sliders from Save Marks, open the next card in place after each Action, and read Done and Complete after relaunch with the Marks, the settled Entry and five Action Entries stored', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createCardFixture(page);
    await openReview(page);
    await tagCards(page);

    // Every card owes something, so the first card opens on load, and no other does (navigation: raw locators, before any reach).
    const cards = cardList(page).locator('li.review-card');
    await expect(cards).toHaveCount(5);
    await expect(cards.first()).toHaveAttribute('data-trade', 'T-A');
    await expect(headerOf(page, 'T-A')).toHaveAttribute('aria-expanded', 'true');
    await expect(cardList(page).locator(OPEN_HEADERS)).toHaveCount(1);
    await expect(sliderOf(page, 'T-A')).toHaveAccessibleName('Mark missing: XYZ, Mon Oct 12');
    await expect(sliderOf(page, 'T-F')).toHaveAccessibleName('Mark missing: XYZ, Mon Oct 12');

    // Type the first card's Mark and press Save Marks: its figures and both XYZ sliders follow the result.
    await enterMarkOf(page, 'T-A', MONDAY, '52.00');
    const figure = (term: string) => tradeCard(page, 'XYZ').locator('dt', { hasText: new RegExp(`^${term}$`) }).locator('xpath=following-sibling::dd[1]');
    await expect(figure('Current Marked Trade P&L')).toHaveText('+$180.00 · +0.72R');
    await expect(figure('Ongoing Risk to Stop')).toHaveText('$450.00 · 1.80R');
    await expect(sliderOf(page, 'T-A')).toHaveAccessibleName(/^53% of the way from the Stop to the Target, entry at 32%\. Risk to stop \$450\.00, P&L \+\$180\.00, Reward : risk 0\.89\.$/);
    await expect(sliderOf(page, 'T-F')).toHaveAccessibleName(/^57% of the way from the Stop to the Target, entry at 29%\. Risk to stop \$200\.00, P&L \+\$99\.00, Reward : risk 0\.75\.$/);

    // D-1 is due in this Review: resolve it in T-A's card.
    await (await reflectionsOfTrade(page, 'T-A')).getByRole('button', { name: /^Reflect on 2026-10-09/ }).click();
    await fillDebtAnswers(page);
    await answerDebtOf(page, 'T-A');

    // Finishing T-A's card (its Action, Hold preselected) opens the next one in place.
    await saveActionOf(page, 'T-A', 'Hold', undefined);
    await expect(headerOf(page, 'T-A')).toHaveAttribute('aria-expanded', 'false');
    await expect(remainsOf(page, 'T-A')).toHaveText('Done · Action saved');
    await expect(cardList(page).locator(OPEN_HEADERS)).toHaveCount(1);

    // The other cards: their Marks where one is still needed (T-F's came with T-A's), then the Action in each card's panel.
    await saveActionOf(page, 'T-F', 'Hold', undefined);
    await expect(remainsOf(page, 'T-F')).toHaveText('Done · Action saved');
    for (const [trade, price] of [['T-B', '27.50'], ['T-C', '40.50'], ['T-E', '21.00']] as const) {
      await enterMarkOf(page, trade, MONDAY, price);
      await saveActionOf(page, trade, 'Hold', undefined);
      await expect(remainsOf(page, trade)).toHaveText('Done · Action saved');
    }
    await expect(completion(page)).toHaveText('Complete');
    await context.close();

    // Relaunch: every card reads Done and the header Complete.
    const relaunched = await launchAt(profile, MONDAY_1700);
    const again = await firstPage(relaunched);
    await again.goto('/');
    await openReview(again);
    await expect(completion(again)).toHaveText('Complete');
    await expect(cardList(again).locator('.review-card-remains')).toHaveText(Array<string>(5).fill('Done · Action saved'));

    // Durable state: the Marks (one XYZ record for both Trades), the Entry that settled D-1, five Action Entries.
    const workspace = workspaceOf(await probe(again))!;
    expect(observationsOf(workspace).map((o) => o.instrumentKey).sort()).toEqual(['ABC', 'DEF', 'JKL', 'XYZ']);
    expect(observationsOf(workspace).every((o) => o.marks.length === 1)).toBe(true);
    const settled = entriesWithSettledDebt(workspace);
    expect(settled).toHaveLength(1);
    expect(settled[0]!.settledDebtId).toBeTruthy();
    const actions = actionEntriesOf(workspace);
    expect(actions).toHaveLength(5);
    expect(actions.map((e) => e.obligationKey?.slice(0, 2))).toEqual(Array(5).fill(['DailyTradeReview', '2026-10-12']));
    await relaunched.close();
  });
});

test.describe('B5R.2 Opening far down the list', () => {
  test('should open the 18th card where it is, with its header and first input in the viewport without scrolling, and collapse the card that was open', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createCardFixture(page);
    await createRoutineTrades(page, 16);
    await openReview(page);
    await tagCards(page);

    const cards = cardList(page).locator('li.review-card');
    await expect(cards).toHaveCount(21);
    await expect(headerOf(page, 'T-A')).toHaveAttribute('aria-expanded', 'true');

    // Scroll to the 18th card and press its header: the card scrolls itself, the test does not scroll again.
    const eighteenth = cards.nth(17);
    const header = eighteenth.getByRole('button', { name: /^Review / });
    await eighteenth.scrollIntoViewIfNeeded();
    await header.click();
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    await expect(headerOf(page, 'T-A')).toHaveAttribute('aria-expanded', 'false');
    await expect(cardList(page).locator(OPEN_HEADERS)).toHaveCount(1);
    await expect(eighteenth.getByLabel('Price').first()).toBeVisible();
    await expect(header).toBeInViewport();
    await expect(eighteenth.getByLabel('Price').first()).toBeInViewport();
    await expect(panelHeaderOf(page, 'T-A', 'Marks')).toHaveCount(0);
    await context.close();
  });
});
