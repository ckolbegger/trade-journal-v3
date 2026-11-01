import {
  actionFormOfTrade, cardItem, completion, createCardFixture, expect, expectAccessible, FRIDAY, headerOf, markRowOf, MONDAY, MONDAY_1700, onboardedAt, openReview, panelHeaderOf, reachTradePanel, READY, remainsOf, sliderOf, status, tabTo, tagCards,
  test, tradeCard, type CardTrade,
} from './support.ts';

const TRADES: readonly CardTrade[] = ['T-A', 'T-B', 'T-C', 'T-E', 'T-F'];
const INTENT = /^Why are you taking this action\?/;

test.describe('B5R.11 Responsive and accessible', () => {
  test('should keep drafts and the open panel through 390 px and back, put the slider on its own row at narrow width, report no WCAG 2.1 AA violations, say band, status and Unsaved in text, and complete a card by keyboard with visible focus', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createCardFixture(page);
    await openReview(page);
    await tagCards(page);

    // Wide: the slider sits beside the header, in the same row.
    const rowOf = async (trade: CardTrade) => {
      const head = (await cardItem(page, trade).locator('.review-card-head').boundingBox())!;
      const button = (await headerOf(page, trade).boundingBox())!;
      const slider = (await sliderOf(page, trade).boundingBox())!;
      return { head, button, slider };
    };
    const wide = await rowOf('T-B');
    expect(wide.slider.x).toBeGreaterThanOrEqual(wide.button.x + wide.button.width - 1);
    expect(wide.slider.y).toBeLessThan(wide.button.y + wide.button.height);

    // Half-fill drafts at 1280 px: a price and a half-written "Can't get a price" in the Marks panel, an Exit and a half-written Intent in the Action panel.
    const monday = await markRowOf(page, 'T-A', MONDAY);
    await monday.getByLabel('Price').fill('52.00');
    const friday = await markRowOf(page, 'T-A', FRIDAY);
    await friday.getByRole('button', { name: "Can't get a price" }).click();
    await friday.getByLabel('Reason (required)').fill('No quo');
    // Band, status and Unsaved are words.
    await expect(cardItem(page, 'T-A')).toContainText('Evidence limited');
    await expect(remainsOf(page, 'T-A')).toHaveText('1 Mark · 1 reflection due · Action');
    await expect(status(page)).toContainText('Incomplete');
    await expect(monday.getByText('Unsaved')).toBeVisible();
    await expect(friday.getByText('Unsaved')).toBeVisible();
    await expect(panelHeaderOf(page, 'T-A', 'Marks')).toContainText('1 needed');
    const action = await actionFormOfTrade(page, 'T-A');
    await action.getByRole('radio', { name: 'Exit', exact: true }).check();
    await action.getByLabel(INTENT).fill('Half written');

    // Axe on the card list, then on the open card with each panel open, with the drafts held; the sliders are in every state.
    for (const trade of TRADES) await expect(sliderOf(page, trade)).toHaveAttribute('role', 'img');
    for (const panel of ['Marks', 'Reflections', 'Action'] as const) {
      await reachTradePanel(page, 'T-A', panel);
      await expectAccessible(page, `T-A's card with the ${panel} panel open, drafts held`);
    }
    await expectAccessible(page, 'Card list, drafts held');

    // Resize to 390 px: the slider moves to its own full-width row; the open panel and the drafts stay.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(panelHeaderOf(page, 'T-A', 'Action')).toHaveAttribute('aria-expanded', 'true');
    await expect(async () => {
      const narrow = await rowOf('T-B');
      expect(narrow.slider.y).toBeGreaterThanOrEqual(narrow.button.y + narrow.button.height - 1);
      expect(narrow.slider.width).toBeGreaterThanOrEqual(narrow.head.width - 2);
    }).toPass({ timeout: 5000 });
    await expectAccessible(page, 'Card list and open card, narrow');
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(panelHeaderOf(page, 'T-A', 'Action')).toHaveAttribute('aria-expanded', 'true');
    await expect(async () => {
      const back = await rowOf('T-B');
      expect(back.slider.x).toBeGreaterThanOrEqual(back.button.x + back.button.width - 1);
    }).toPass({ timeout: 5000 });
    await expect((await actionFormOfTrade(page, 'T-A')).getByRole('radio', { name: 'Exit', exact: true })).toBeChecked();
    await expect((await actionFormOfTrade(page, 'T-A')).getByLabel(INTENT)).toHaveValue('Half written');
    await expect((await markRowOf(page, 'T-A', MONDAY)).getByLabel('Price')).toHaveValue('52.00');
    await expect((await markRowOf(page, 'T-A', FRIDAY)).getByLabel('Reason (required)')).toHaveValue('No quo');

    // Put the drafts away (mouse), then complete T-B's card with the keyboard only.
    await tradeCard(page, 'XYZ').getByRole('button', { name: 'Discard' }).click();
    const form = await actionFormOfTrade(page, 'T-A');
    await form.getByRole('radio', { name: 'Hold', exact: true }).check();
    await form.getByLabel(INTENT).fill('');
    await headerOf(page, 'T-A').focus();
    await tabTo(page, headerOf(page, 'T-B'));
    await page.keyboard.press('Enter');
    await expect(headerOf(page, 'T-B')).toHaveAttribute('aria-expanded', 'true', READY);
    await expect(headerOf(page, 'T-B')).toBeFocused();
    // Keyboard and focus steps assert navigation itself (section 6.4, rule 4): raw locators, no reaches.
    const abc = tradeCard(page, 'ABC');
    const price = abc.getByRole('region', { name: `ABC Mark, ${MONDAY}`, exact: true }).getByLabel('Price');
    await tabTo(page, price);
    await page.keyboard.type('27.50');
    await page.keyboard.press('Enter');
    await expect(abc.getByRole('button', { name: /^Save Marks/ })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(panelHeaderOf(page, 'T-B', 'Action')).toHaveAttribute('aria-expanded', 'true', READY);
    const save = abc.getByRole('form', { name: 'Action' }).getByRole('button', { name: 'Save' });
    await expect(save).toBeEnabled(READY);
    await expect(abc.getByRole('radio', { name: 'Hold', exact: true })).toBeChecked();
    await tabTo(page, save);
    await page.keyboard.press('Enter');
    await expect(remainsOf(page, 'T-B')).toHaveText('Done · Action saved', READY);
    await expect(completion(page)).toHaveText('Incomplete');
    // A Done card, a pinned slider and a grey one are in the list: the page is still accessible.
    await expectAccessible(page, 'Card list with a Done card and a pinned slider');
    await context.close();
  });
});
