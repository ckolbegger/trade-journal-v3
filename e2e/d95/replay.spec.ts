import type { Locator } from '@playwright/test';
import { cardHeader, expect, openExpiration, openReview, reachCard, test, tradeCard } from '../d7/support.ts';
import { setWidth } from '../d7p/support.ts';
import { boxOf, closeButton, replay, sliderValue } from '../d9ar/support.ts';
import { atBothWidths, enterExpiryMarks, openAbcClosed, openSettlement, WIDTHS } from './support.ts';

test.use({ actionTimeout: 15_000 });

// The strip of the card in hand: the chart, the words and the Replay button; the chart beside the words on a wide page, above them on a phone.
async function expectStrip(strip: Locator, words: string, width: number): Promise<void> {
  const at = `at ${width}`;
  await expect(strip.getByText(words, { exact: true }), `the strip's words ${at}`).toBeVisible();
  const chart = await boxOf(strip.getByRole('img', { name: 'Trade P&L by session' }));
  const line = await boxOf(strip.getByText(words, { exact: true }));
  if (width < 480) expect(chart.y + chart.height, `the chart is above the words ${at}`).toBeLessThanOrEqual(line.y + 1);
  else expect(chart.x + chart.width, `the chart is beside the words ${at}`).toBeLessThanOrEqual(line.x + 1);
  const button = strip.getByRole('button', { name: 'Replay', exact: true });
  await expect(button, `the Replay button ${at}`).toBeVisible();
  expect((await boxOf(button)).height, `the Replay button is a touch target ${at}`).toBeGreaterThanOrEqual(44);
}

// The Replay's touch targets: the slider, its step buttons, the key-moments drop-down and Close.
async function expectTouchTargets(scope: Locator, width: number): Promise<void> {
  const targets = [scope.getByRole('slider', { name: 'Session' }), scope.getByRole('button', { name: 'Previous session' }), scope.getByRole('button', { name: 'Next session' }), scope.getByRole('combobox', { name: 'Key moments' })];
  // The 44 px route is the phone's; the Close button is the one control a wide page draws smaller.
  if (width < 480) targets.push(closeButton(scope));
  for (const target of targets) expect((await boxOf(target)).height, `a touch target at ${width}`).toBeGreaterThanOrEqual(44);
  expect(await scope.evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth), `no sideways scroll at ${width}`).toBe(true);
}

test.describe('B95.13 The Replay from every kind of card (decisions 136, 140)', () => {
  test('should show the strip on a closed Trade\'s card and open its Replay with what you did that day, the Action row and its key moments at both widths', async ({ profile, copySetup }) => {
    test.setTimeout(240_000);
    const { context, page, ids } = await openAbcClosed(profile, copySetup);
    const card = page.locator(`li.review-card[data-trade-id="${ids.ABC}"]`);
    const header = card.getByRole('button', { name: /^Review ABC/ });
    await atBothWidths(page, async (width) => {
      if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
      const strip = card.getByRole('region', { name: 'Replay strip' });
      await expectStrip(strip, '1 session · low −$242.00 on Mon Oct 12. Walk it before you write.', width);
      await strip.getByRole('button', { name: 'Replay', exact: true }).click();
      const scope = replay(page);
      await expect(scope, `the Replay opens at ${width}`).toBeVisible();
      // It opens on the one session the Trade has.
      await expect(sliderValue(scope), `where it opens at ${width}`).toHaveText('Mon Oct 12 · 1 of 1');
      const day = scope.getByRole('region', { name: 'What you did that day' });
      await expect(day).toContainText('Bought 100 at $30.00. Sold 100 at $27.60.');
      await expect(day).toContainText('Action: Exit · no reason given');
      await expect(scope.getByRole('list', { name: 'Action by session' }).getByRole('listitem'), `the Action row at ${width}`).toHaveText(['EMon Oct 12: Exit']);
      await expect(scope.getByText('H Hold · E Exit · R Roll · A Adjust · – no Review')).toBeVisible();
      const moments = scope.getByRole('combobox', { name: 'Key moments' });
      await expect(moments.getByRole('option')).toHaveText(['Choose a moment', '1. Entry + Low + High + Sale + End · Mon Oct 12']);
      await expectTouchTargets(scope, width);
      // Escape closes it and focus returns to the button that opened it.
      await page.keyboard.press('Escape');
      await expect(scope, `closed by Escape at ${width}`).toHaveCount(0);
      await expect(strip.getByRole('button', { name: 'Replay', exact: true }), `focus back on the Replay button at ${width}`).toBeFocused();
    });
    await context.close();
  });

  test('should show the strip on an expired contract\'s card and open its Replay on the newest session at both widths', async ({ profile, copySetup }) => {
    test.setTimeout(240_000);
    const { context, page, t3 } = await openSettlement(profile, copySetup);
    await openReview(page);
    await reachCard(page, t3);
    await atBothWidths(page, async (width) => {
      const strip = tradeCard(page, t3).getByRole('region', { name: 'Replay strip' });
      await expectStrip(strip, 'Session 30 of this Trade. See the path.', width);
      await strip.getByRole('button', { name: 'Replay', exact: true }).click();
      const scope = replay(page);
      await expect(sliderValue(scope), `where it opens at ${width}`).toHaveText('Fri Nov 20 · 30 of 30');
      await expect(scope.getByRole('combobox', { name: 'Key moments' }).getByRole('option')).toHaveText(['Choose a moment', '1. Entry · Mon Oct 12', '2. Now · Fri Nov 20']);
      // Nothing was recorded on the expiry day.
      await expect(scope.getByRole('region', { name: 'What you did that day' })).toContainText('Nothing recorded.');
      await expect(scope.getByRole('list', { name: 'Action by session' }).getByRole('listitem'), `one mark for each session before the newest at ${width}`).toHaveCount(29);
      await expectTouchTargets(scope, width);
      await closeButton(scope).click();
      await expect(scope).toHaveCount(0);
    });
    await context.close();
  });

  for (const width of WIDTHS) {
    test(`should say in the Replay that Exercised: record later was chosen on the expiry day at ${width}`, async ({ profile, copySetup }) => {
      test.setTimeout(240_000);
      const { context, page, t1 } = await openSettlement(profile, copySetup);
      await setWidth(page, width);
      await openReview(page);
      await enterExpiryMarks(page);
      const block = await openExpiration(page, t1);
      await block.getByRole('button', { name: 'Exercised: record later', exact: true }).click();
      await expect(cardHeader(page, t1)).toContainText('Done · Settle Later');
      await reachCard(page, t1);
      await tradeCard(page, t1).getByRole('region', { name: 'Replay strip' }).getByRole('button', { name: 'Replay', exact: true }).click();
      const scope = replay(page);
      await expect(sliderValue(scope)).toHaveText('Fri Nov 20 · 30 of 30');
      await expect(scope.getByRole('region', { name: 'What you did that day' })).toContainText('Expired. You chose Exercised: record later.');
      await closeButton(scope).click();
      await context.close();
    });
  }
});
