import {
  actionEntriesOf, answerDebt, cardHeader, cardList, completion, createRoutineTrades, enterMark, entriesWithSettledDebt, expect, fillDebtAnswers, firstPage, launchAt, MONDAY, MONDAY_1700, observationsOf, marksStepOf, openReview, probe, reflectionsOf, remainsOf, reviewMeters, saveAction, meterOf, test, tradeCard, workspaceOf, openCardFixture,
} from './support.ts';

const OPEN_HEADERS = '.review-card-head button[aria-expanded="true"]';

test.describe('B5R.1 Review end to end on cards', () => {
  test('should open the first card not Done on load, update the figures and meters from Save Marks, open the next card in place after each Action, and read Done and Complete after relaunch with the Marks, the settled Entry and five Action Entries stored', async ({ profile, copySetup }) => {
    test.setTimeout(240_000);
    const { context, page, 'T-A': tA, 'T-B': tB, 'T-C': tC, 'T-E': tE, 'T-F': tF } = await openCardFixture(profile, copySetup);
    await openReview(page);

    // Every card owes something, so the first card opens on load, and no other does (navigation: raw locators, before any reach).
    const cards = cardList(page).locator('li.review-card');
    await expect(cards).toHaveCount(5);
    await expect(cards.first()).toHaveAttribute('data-trade-id', tA.tradeId);
    await expect(cardHeader(page, tA)).toHaveAttribute('aria-expanded', 'true');
    await expect(cardList(page).locator(OPEN_HEADERS)).toHaveCount(1);
    await expect(meterOf(page, tA)).toHaveAccessibleName('Mark missing: XYZ, Mon Oct 12 Stop −$270.00, Target +$580.00.');
    await expect(meterOf(page, tF)).toHaveAccessibleName('Mark missing: XYZ, Mon Oct 12 Stop −$101.00, Target +$249.00.');

    // The walk is in attention order: the two XYZ Trades owe a Mark and more, so they come first. A saved Mark re-sorts it (the two XYZ cards go last).
    // (T-B, T-C and T-E tie, and their order among themselves is not fixed.)
    const names: Record<string, string> = { [tA.tradeId]: 'T-A', [tB.tradeId]: 'T-B', [tC.tradeId]: 'T-C', [tE.tradeId]: 'T-E', [tF.tradeId]: 'T-F' };
    const orderOf = async (on: typeof page) => (await reviewMeters(on)).map((card) => names[card.id]!);
    const tied = (order: string[], from: number, to: number) => [...order.slice(from, to)].sort();
    const first = await orderOf(page);
    expect(first.slice(0, 2)).toEqual(['T-A', 'T-F']);
    expect(tied(first, 2, 5)).toEqual(['T-B', 'T-C', 'T-E']);

    // Type the first card's Mark and press Save Marks: its figures and both XYZ meters follow the result.
    await enterMark(page, tA, MONDAY, '52.00');
    const figure = (term: string) => tradeCard(page, 'XYZ').locator('dt', { hasText: new RegExp(`^${term}$`) }).locator('xpath=following-sibling::dd[1]');
    await expect(figure('Trade P&L')).toHaveText('+$180.00 · +0.72R');
    await expect(figure('Current Risk · At Stop')).toHaveText('$450.00 · 1.80R');
    await expect(meterOf(page, tA)).toHaveAccessibleName(/^P&L \+\$180\.00, 31% of the way to the Target\. Stop −\$270\.00, Target \+\$580\.00\.$/);
    await expect(meterOf(page, tF)).toHaveAccessibleName(/^P&L \+\$99\.00, 40% of the way to the Target\. Stop −\$101\.00, Target \+\$249\.00\.$/);
    const second = await orderOf(page);
    expect(tied(second, 0, 3)).toEqual(['T-B', 'T-C', 'T-E']);
    expect(second.slice(3)).toEqual(['T-F', 'T-A']);

    // D-1 is due in this Review: resolve it in T-A's card.
    await (await reflectionsOf(page, tA)).getByRole('button', { name: /^Reflect on 2026-10-09/ }).click();
    await fillDebtAnswers(page);
    await answerDebt(page, tA);

    // Finishing T-A's card (its Action, Hold preselected) closes it; the next thing is a Mark, which is the page's, so no card opens.
    await saveAction(page, 'Hold', undefined, tA);
    await expect(cardHeader(page, tA)).toHaveAttribute('aria-expanded', 'false');
    await expect(remainsOf(page, tA)).toHaveText('Done · Hold');
    await expect(cardList(page).locator(OPEN_HEADERS)).toHaveCount(0);
    await expect(marksStepOf(page).locator('input:focus')).toHaveCount(1);

    // The other cards: their Marks where one is still needed (T-F's came with T-A's), then the Action in each card's panel.
    await saveAction(page, 'Hold', undefined, tF);
    await expect(remainsOf(page, tF)).toHaveText('Done · Hold');
    for (const [trade, price] of [[tB, '27.50'], [tC, '40.50'], [tE, '21.00']] as const) {
      await enterMark(page, trade, MONDAY, price);
      await saveAction(page, 'Hold', undefined, trade);
      await expect(remainsOf(page, trade)).toHaveText('Done · Hold');
    }
    await expect(completion(page)).toHaveText('Complete');
    const done = await orderOf(page);
    expect([...done].sort()).toEqual(['T-A', 'T-B', 'T-C', 'T-E', 'T-F']);
    await context.close();

    // Relaunch: every card reads Done and the header Complete.
    const relaunched = await launchAt(profile, MONDAY_1700);
    const again = await firstPage(relaunched);
    await again.goto('/');
    await openReview(again);
    await expect(completion(again)).toHaveText('Complete');
    await expect(cardList(again).locator('.review-card-remains')).toHaveText(Array<string>(5).fill('Done · Hold'));
    expect((await reviewMeters(again)).map((card) => names[card.id]!)).toEqual(done);

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
  test('should open the 18th card where it is, with its header and first input in the viewport without scrolling, and collapse the card that was open', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page, 'T-A': tA } = await openCardFixture(profile, copySetup);
    await createRoutineTrades(page, 16);
    await openReview(page);

    const cards = cardList(page).locator('li.review-card');
    await expect(cards).toHaveCount(21);
    await expect(cardHeader(page, tA)).toHaveAttribute('aria-expanded', 'true');

    // Scroll to the 18th card and press its header: the card scrolls itself, the test does not scroll again.
    const eighteenth = cards.nth(17);
    const header = eighteenth.getByRole('button', { name: /^Review / });
    await eighteenth.scrollIntoViewIfNeeded();
    await header.click();
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    await expect(cardHeader(page, tA)).toHaveAttribute('aria-expanded', 'false');
    await expect(cardList(page).locator(OPEN_HEADERS)).toHaveCount(1);
    await expect(header).toBeInViewport();
    await context.close();
  });
});
