import {
  actionEntriesOf, answerDebt, cardHeader, cardList, completion, createCardFixture, enterMark, expect, fillDebtAnswers, firstPage, launchAt, meterOf, MONDAY, MONDAY_1700, observationsOf, onboardedAt, openReview, probe, reflectionsOf, remainsOf, reviewMeters, saveAction, test,
  expectTrackDashed, workspaceOf,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// B9.8 (plan section 7.2, W51, AC-REV-002): D5R's card fixture (T-A, T-B, T-C, T-E, T-F) in the Review at Mon 10-12 17:00. Each card's header carries the meter, named by W51 with no visible
// words; the card without a Mark (T-C) has the dashed track; a saved Mark moves the meter. The walk's order and what an Action saves are as they were before the meter.
test.describe('B9.8 The meter on Review cards', () => {
  test('should name each card’s meter by W51, draw the dashed track on the card without a Mark and move the meter with the saved Mark', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    const { 'T-A': tA, 'T-B': tB, 'T-C': tC, 'T-E': tE, 'T-F': tF } = await createCardFixture(page);
    await openReview(page);
    // Before any Mark: every meter is dashed and named by the missing Mark, with its two lines.
    await expect(meterOf(page, tA)).toHaveAccessibleName('Mark missing: XYZ, Mon Oct 12 Stop −$270.00, Target +$580.00.');
    await expectTrackDashed(meterOf(page, tA), true);

    await enterMark(page, tA, MONDAY, '52.00');
    await enterMark(page, tB, MONDAY, '27.50');
    await enterMark(page, tE, MONDAY, '21.00');
    await expect(meterOf(page, tA)).toHaveAccessibleName('P&L +$180.00, 31% of the way to the Target. Stop −$270.00, Target +$580.00.');
    await expect(meterOf(page, tB)).toHaveAccessibleName('P&L −$251.00, past the Stop by $50.00. Stop −$201.00, Target +$599.00.');
    await expect(meterOf(page, tC)).toHaveAccessibleName('Mark missing: DEF, Mon Oct 12 Stop −$201.00, Target +$599.00.');
    await expect(meterOf(page, tF)).toHaveAccessibleName('P&L +$99.00, 40% of the way to the Target. Stop −$101.00, Target +$249.00.');
    await expect(meterOf(page, tE)).toHaveAccessibleName('P&L +$99.00, 10% of the way to the Target. Stop −$101.00, Target +$999.00.');
    for (const trade of [tA, tB, tE, tF]) {
      await expect(meterOf(page, trade)).toHaveAttribute('data-state', 'filled');
      await expectTrackDashed(meterOf(page, trade), false);
    }
    // Only the card without a Mark has the dashed track, and no meter shows a word.
    await expect(meterOf(page, tC)).toHaveAttribute('data-state', 'empty');
    await expectTrackDashed(meterOf(page, tC), true);
    await expect(meterOf(page, tC).getByTestId('meter-pointer')).toHaveCount(0);
    for (const trade of [tA, tB, tC, tE, tF]) await expect(meterOf(page, trade)).toHaveText('');

    // Saving DEF's Mark moves T-C's meter from dashed to drawn, with no reload.
    await enterMark(page, tC, MONDAY, '40.50');
    await expect(meterOf(page, tC)).toHaveAttribute('data-state', 'filled');
    await expect(meterOf(page, tC)).toHaveAccessibleName(/^P&L [+−]\$[\d,]+\.\d\d, .*Stop −\$201\.00, Target \+\$599\.00\.$/);
    await expectTrackDashed(meterOf(page, tC), false);
    await context.close();
  });

  test('should keep the walk’s order and what each Action saves, through a save and a relaunch', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    const trades = await createCardFixture(page);
    const { 'T-A': tA, 'T-B': tB, 'T-C': tC, 'T-E': tE, 'T-F': tF } = trades;
    await openReview(page);
    const names: Record<string, string> = { [tA.tradeId]: 'T-A', [tB.tradeId]: 'T-B', [tC.tradeId]: 'T-C', [tE.tradeId]: 'T-E', [tF.tradeId]: 'T-F' };
    const orderOf = async (on: typeof page) => (await reviewMeters(on)).map((card) => names[card.id]!);
    // The walk is in attention order: the two XYZ Trades owe a Mark and more, so they come first. A saved Mark re-sorts it (the two XYZ cards go last), as D5R's walk did.
    // (T-B, T-C and T-E tie, and their order among themselves is not fixed.)
    const tied = (order: string[], from: number, to: number) => [...order.slice(from, to)].sort();
    const first = await orderOf(page);
    expect(first.slice(0, 2)).toEqual(['T-A', 'T-F']);
    expect(tied(first, 2, 5)).toEqual(['T-B', 'T-C', 'T-E']);
    await expect(cardHeader(page, tA)).toHaveAttribute('aria-expanded', 'true');

    // The Marks, then one Action per card, as D5R saved them.
    await enterMark(page, tA, MONDAY, '52.00');
    const second = await orderOf(page);
    expect(tied(second, 0, 3)).toEqual(['T-B', 'T-C', 'T-E']);
    expect(second.slice(3)).toEqual(['T-F', 'T-A']);
    // D-1 is due in this Review: resolved in T-A's card before its Action.
    await (await reflectionsOf(page, tA)).getByRole('button', { name: /^Reflect on 2026-10-09/ }).click();
    await fillDebtAnswers(page);
    await answerDebt(page, tA);
    await saveAction(page, 'Hold', undefined, tA);
    await saveAction(page, 'Hold', undefined, tF);
    for (const [trade, price] of [[tB, '27.50'], [tC, '40.50'], [tE, '21.00']] as const) {
      await enterMark(page, trade, MONDAY, price);
      await saveAction(page, 'Hold', undefined, trade);
      await expect(remainsOf(page, trade)).toHaveText('Done · Action saved');
    }
    await expect(completion(page)).toHaveText('Complete');
    const done = await orderOf(page);
    expect([...done].sort()).toEqual(['T-A', 'T-B', 'T-C', 'T-E', 'T-F']);
    await context.close();

    // Relaunched: the same order, every card Done, and the saved outcomes are the Marks and five Actions.
    const relaunched = await launchAt(profile, MONDAY_1700);
    const again = await firstPage(relaunched);
    await again.goto('/');
    await openReview(again);
    await expect(completion(again)).toHaveText('Complete');
    await expect(cardList(again).locator('.review-card-remains')).toHaveText(Array<string>(5).fill('Done · Action saved'));
    expect((await reviewMeters(again)).map((card) => names[card.id]!)).toEqual(done);
    const workspace = workspaceOf(await probe(again))!;
    expect(observationsOf(workspace).map((o) => o.instrumentKey).sort()).toEqual(['ABC', 'DEF', 'JKL', 'XYZ']);
    expect(actionEntriesOf(workspace)).toHaveLength(5);
    await relaunched.close();
  });
});
