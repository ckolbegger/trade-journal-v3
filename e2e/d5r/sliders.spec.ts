import type { Locator, Page } from '@playwright/test';
import {
  createCardFixture, enterMarkOf, expect, headerOf, MONDAY, MONDAY_1700, onboardedAt, openReview, panelHeaderOf, READY, sliderOf, tagCards, test, tradeCard, type CardTrade,
} from './support.ts';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Primary' });

test.describe('B5R.6 Missing-Mark link', () => {
  test('should open the Review with T-C’s card open on its Marks panel and focus on DEF when the Open list’s Mark missing link is followed', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createCardFixture(page);

    await nav(page).getByRole('link', { name: 'Trades' }).click();
    const list = page.getByRole('table', { name: 'Open Trades' });
    await expect(list).toBeVisible(READY);
    await list.getByRole('row', { name: /DEF/ }).getByRole('link', { name: /^Mark missing: DEF/ }).click();

    // Navigation and focus: raw locators.
    await expect(page.getByRole('heading', { name: 'Review', level: 1 })).toBeVisible(READY);
    await expect(headerOf(page, 'T-C')).toHaveAttribute('aria-expanded', 'true', READY);
    await expect(panelHeaderOf(page, 'T-C', 'Marks')).toHaveAttribute('aria-expanded', 'true');
    await expect(tradeCard(page, 'DEF').getByRole('region', { name: `DEF Mark, ${MONDAY}`, exact: true }).getByLabel('Price')).toBeFocused();
    // No other card is open.
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
    await createCardFixture(page);
    await openReview(page);
    await tagCards(page);
    // Monday Marks for every Instrument but DEF.
    await enterMarkOf(page, 'T-A', MONDAY, '52.00');
    await enterMarkOf(page, 'T-B', MONDAY, '27.50');
    await enterMarkOf(page, 'T-E', MONDAY, '21.00');

    const dot = (trade: CardTrade) => sliderOf(page, trade).locator('.slider-now');
    const tick = (trade: CardTrade) => sliderOf(page, trade).locator('.slider-entry');

    // T-A: placed at 53% with entry at 32%, so the dot sits right of the tick, in the round shape.
    await expect(sliderOf(page, 'T-A')).toHaveAccessibleName('53% of the way from the Stop to the Target, entry at 32%. Risk to stop $450.00, P&L +$180.00, Reward : risk 0.89.');
    expect(await centre(dot('T-A'))).toBeGreaterThan(await centre(tick('T-A')));
    await expect(dot('T-A')).not.toHaveClass(/slider-pinned/);
    const round = await radiusOf(dot('T-A'));

    // T-B: past the Stop, so the dot is pinned at the Stop end (the slider's left edge) in a different shape.
    await expect(sliderOf(page, 'T-B')).toHaveAccessibleName('Past the Stop, entry at 25%. Risk to stop $0.00, P&L −$251.00, Reward : risk Not applicable.');
    await expect(dot('T-B')).toHaveClass(/slider-pinned/);
    expect(await radiusOf(dot('T-B'))).not.toBe(round);
    const track = (await sliderOf(page, 'T-B').boundingBox())!;
    expect(Math.abs((await centre(dot('T-B'))) - track.x)).toBeLessThanOrEqual(1);
    expect(await centre(tick('T-B'))).toBeGreaterThan(track.x + 1);

    // T-C: no Mark, so the track is grey (no red-to-green gradient) and there is no dot.
    await expect(sliderOf(page, 'T-C')).toHaveAccessibleName('Mark missing: DEF, Mon Oct 12');
    await expect(sliderOf(page, 'T-C')).toHaveClass(/slider-none/);
    await expect(dot('T-C')).toHaveCount(0);
    await expect(tick('T-C')).toHaveCount(0);
    expect(await sliderOf(page, 'T-C').locator('.slider-track').evaluate((el) => getComputedStyle(el).backgroundImage)).toBe('none');
    expect(await sliderOf(page, 'T-A').locator('.slider-track').evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('linear-gradient');

    // The placed sliders of the other Trades, and no number in any slider's visible text.
    await expect(sliderOf(page, 'T-F')).toHaveAccessibleName('57% of the way from the Stop to the Target, entry at 29%. Risk to stop $200.00, P&L +$99.00, Reward : risk 0.75.');
    await expect(sliderOf(page, 'T-E')).toHaveAccessibleName('18% of the way from the Stop to the Target, entry at 9%. Risk to stop $200.00, P&L +$99.00, Reward : risk 4.5.');
    for (const trade of ['T-A', 'T-B', 'T-C', 'T-E', 'T-F'] as const) await expect(sliderOf(page, trade)).toHaveText('');
    await context.close();
  });
});
