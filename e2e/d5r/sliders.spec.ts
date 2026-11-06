import type { Locator, Page } from '@playwright/test';
import {
  cardHeader, createCardFixture, enterMark, expect, MONDAY, MONDAY_1700, onboardedAt, openReview, panelHeader, READY, sliderOf, test, tradeCard, type CardTrade,
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

test.describe('B5R.7 Slider states', () => {
  test('should draw T-A’s dot right of its entry tick, T-B’s dot pinned at the Stop end in the pinned shape, T-C’s track grey with no dot, each with the description T5R.7 states', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    const trades = await createCardFixture(page);
    const { 'T-A': tA, 'T-B': tB, 'T-C': tC, 'T-E': tE, 'T-F': tF } = trades;
    await openReview(page);
    // Monday Marks for every Instrument but DEF.
    await enterMark(page, tA, MONDAY, '52.00');
    await enterMark(page, tB, MONDAY, '27.50');
    await enterMark(page, tE, MONDAY, '21.00');

    const dot = (trade: CardTrade) => sliderOf(page, trades[trade]).locator('.slider-now');
    const tick = (trade: CardTrade) => sliderOf(page, trades[trade]).locator('.slider-entry');

    // T-A: placed at 53% with entry at 32%, so the dot sits right of the tick, in the round shape.
    await expect(sliderOf(page, tA)).toHaveAccessibleName('53% of the way from the Stop to the Target, entry at 32%. Risk to stop $450.00, P&L +$180.00, Reward : risk 0.89.');
    expect(await centre(dot('T-A'))).toBeGreaterThan(await centre(tick('T-A')));
    await expect(dot('T-A')).not.toHaveClass(/slider-pinned/);
    const round = await radiusOf(dot('T-A'));

    // T-B: past the Stop, so the dot is pinned at the Stop end (the slider's left edge) in a different shape.
    await expect(sliderOf(page, tB)).toHaveAccessibleName('Past the Stop, entry at 25%. Risk to stop $0.00, P&L −$251.00, Reward : risk Not applicable: no risk to the Stop.');
    await expect(dot('T-B')).toHaveClass(/slider-pinned/);
    expect(await radiusOf(dot('T-B'))).not.toBe(round);
    const track = (await sliderOf(page, tB).boundingBox())!;
    expect(Math.abs((await centre(dot('T-B'))) - track.x)).toBeLessThanOrEqual(1);
    expect(await centre(tick('T-B'))).toBeGreaterThan(track.x + 1);

    // T-C: no Mark, so the track is grey (no red-to-green gradient) and there is no dot.
    await expect(sliderOf(page, tC)).toHaveAccessibleName('Mark missing: DEF, Mon Oct 12');
    await expect(sliderOf(page, tC)).toHaveClass(/slider-none/);
    await expect(dot('T-C')).toHaveCount(0);
    await expect(tick('T-C')).toHaveCount(0);
    expect(await sliderOf(page, tC).locator('.slider-track').evaluate((el) => getComputedStyle(el).backgroundImage)).toBe('none');
    expect(await sliderOf(page, tA).locator('.slider-track').evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('linear-gradient');

    // The placed sliders of the other Trades, and no number in any slider's visible text.
    await expect(sliderOf(page, tF)).toHaveAccessibleName('57% of the way from the Stop to the Target, entry at 29%. Risk to stop $200.00, P&L +$99.00, Reward : risk 0.75.');
    await expect(sliderOf(page, tE)).toHaveAccessibleName('18% of the way from the Stop to the Target, entry at 9%. Risk to stop $200.00, P&L +$99.00, Reward : risk 4.5.');
    for (const trade of [tA, tB, tC, tE, tF]) await expect(sliderOf(page, trade)).toHaveText('');
    await context.close();
  });
});
