import type { Locator, Page } from '@playwright/test';
import {
  cardHeader, createCardFixture, enterMark, expect, MONDAY, MONDAY_1700, onboardedAt, openReview, panelHeader, READY, meterOf, test, tradeCard, type CardTrade,
} from './support.ts';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Primary' });

test.describe('B5R.6 Missing-Mark link', () => {
  test('should open the Review with T-C’s card open on its Marks panel and focus on DEF when the Open list’s Mark missing link is followed', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    const { 'T-C': tC } = await createCardFixture(page);

    await nav(page).getByRole('link', { name: 'Trades' }).click();
    const list = page.getByRole('table', { name: 'Open Trades' });
    await expect(list).toBeVisible(READY);
    await list.getByRole('row', { name: /DEF/ }).getByRole('link', { name: /^Mark missing: DEF/ }).click();

    // Navigation and focus: raw locators.
    await expect(page.getByRole('heading', { name: 'Review', level: 1 })).toBeVisible(READY);
    await expect(cardHeader(page, tC)).toHaveAttribute('aria-expanded', 'true', READY);
    await expect(panelHeader(page, tC, 'Marks')).toHaveAttribute('aria-expanded', 'true');
    await expect(tradeCard(page, 'DEF').getByRole('region', { name: `DEF Mark, ${MONDAY}`, exact: true }).getByLabel('Price')).toBeFocused();
    // No other card is open.
    await expect(page.locator('.review-card-head button[aria-expanded="true"]')).toHaveCount(1);
    await context.close();
  });
});

test.describe('B5R.12 Missing-Mark link on a shared Instrument', () => {
  test('should open the linked Trade’s own card on its Marks panel with focus on XYZ, and leave the other XYZ card collapsed, when the Open list’s Mark missing link of the Trade that is not the first holder is followed', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    const { 'T-A': tA, 'T-F': tF } = await createCardFixture(page);

    await nav(page).getByRole('link', { name: 'Trades' }).click();
    const list = page.getByRole('table', { name: 'Open Trades' });
    await expect(list).toBeVisible(READY);
    // With no Monday Marks, T-A's card (it also owes Friday's gap) comes before T-F's in attention order, so T-F is the second holder of XYZ.
    const rowOf = (trade: { readonly tradeId: string }) => list.getByRole('row').filter({ has: page.locator(`a[href$="/trades/${trade.tradeId}"]`) });
    await rowOf(tF).getByRole('link', { name: /^Mark missing: XYZ/ }).click();

    // Navigation and focus: raw locators.
    await expect(page.getByRole('heading', { name: 'Review', level: 1 })).toBeVisible(READY);
    await expect(cardHeader(page, tF)).toHaveAttribute('aria-expanded', 'true', READY);
    await expect(panelHeader(page, tF, 'Marks')).toHaveAttribute('aria-expanded', 'true');
    await expect(tradeCard(page, tF).getByRole('region', { name: `XYZ Mark, ${MONDAY}`, exact: true }).getByLabel('Price')).toBeFocused();
    // The other XYZ card, and every other card, stays collapsed.
    await expect(cardHeader(page, tA)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.review-card-head button[aria-expanded="true"]')).toHaveCount(1);
    await context.close();
  });
});

const centre = async (locator: Locator): Promise<number> => {
  const box = (await locator.boundingBox())!;
  return box.x + box.width / 2;
};
const radiusOf = (dot: Locator): Promise<string> => dot.evaluate((el) => getComputedStyle(el).borderRadius);

test.describe('B5R.7 Meter states', () => {
  test('should draw T-A’s pointer right of break-even, T-B’s pointer pinned at the Stop end in the square shape, T-C’s track dashed with no pointer, each named by its figures', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    const trades = await createCardFixture(page);
    const { 'T-A': tA, 'T-B': tB, 'T-C': tC, 'T-E': tE, 'T-F': tF } = trades;
    await openReview(page);
    // Monday Marks for every Instrument but DEF.
    await enterMark(page, tA, MONDAY, '52.00');
    await enterMark(page, tB, MONDAY, '27.50');
    await enterMark(page, tE, MONDAY, '21.00');

    const dot = (trade: CardTrade) => meterOf(page, trades[trade]).getByTestId('meter-pointer');
    const even = (trade: CardTrade) => meterOf(page, trades[trade]).getByTestId('meter-even');

    // T-A: between its rails and above break-even, so the pointer sits right of the break-even tick, in the round shape.
    await expect(meterOf(page, tA)).toHaveAccessibleName('P&L +$180.00, 31% of the way to the Target. Stop −$270.00, Target +$580.00.');
    expect(await centre(dot('T-A'))).toBeGreaterThan(await centre(even('T-A')));
    await expect(dot('T-A')).toHaveAttribute('data-shape', 'round');
    const round = await radiusOf(dot('T-A'));

    // T-B: past the Stop, so the pointer rests at the Stop end (the meter's left edge) in a different shape.
    await expect(meterOf(page, tB)).toHaveAccessibleName('P&L −$251.00, past the Stop by $50.00. Stop −$201.00, Target +$599.00.');
    await expect(dot('T-B')).toHaveAttribute('data-shape', 'square');
    expect(await radiusOf(dot('T-B'))).not.toBe(round);
    const track = (await meterOf(page, tB).getByTestId('meter-track').boundingBox())!;
    expect(Math.abs((await centre(dot('T-B'))) - track.x)).toBeLessThanOrEqual(1);
    expect(await centre(even('T-B'))).toBeGreaterThan(track.x + 1);

    // T-C: no Mark, so the track is dashed and named by the reason, and there is no pointer.
    await expect(meterOf(page, tC)).toHaveAccessibleName('Mark missing: DEF, Mon Oct 12 Stop −$201.00, Target +$599.00.');
    await expect(meterOf(page, tC)).toHaveAttribute('data-state', 'empty');
    await expect(dot('T-C')).toHaveCount(0);
    expect(await meterOf(page, tC).getByTestId('meter-track').evaluate((el) => getComputedStyle(el).borderStyle)).toBe('dashed');
    expect(await meterOf(page, tA).getByTestId('meter-track').evaluate((el) => getComputedStyle(el).borderStyle)).not.toBe('dashed');

    // The placed meters of the other Trades, and no number in any meter's visible text.
    await expect(meterOf(page, tF)).toHaveAccessibleName('P&L +$99.00, 40% of the way to the Target. Stop −$101.00, Target +$249.00.');
    await expect(meterOf(page, tE)).toHaveAccessibleName('P&L +$99.00, 10% of the way to the Target. Stop −$101.00, Target +$999.00.');
    for (const trade of [tA, tB, tC, tE, tF]) await expect(meterOf(page, trade)).toHaveText('');
    await context.close();
  });
});
