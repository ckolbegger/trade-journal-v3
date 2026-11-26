import { setWidth } from '../d7p/support.ts';
import { boxOf, closeButton, expect, openStandardReview, reachCard, replay, test, tradeCard } from '../d9ar/support.ts';
import { WIDTHS } from './support.ts';

// T95.56 (W146): the Replay strip on a Review card at 1280 and at 375 wide: a small chart, one line of words and the Replay button, the chart beside
// the words on a wide page and above them on a phone. BREN is past its Target, first reached on Thu 11-12.
test.describe('T95.56 The Replay strip on a card', () => {
  test('should show the chart, the words and the Replay button, stacked at 375 wide, and open the Replay from the button', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page, trades } = await openStandardReview(profile, copySetup);
    const bren = trades[0]!;
    for (const width of WIDTHS) {
      if (width !== WIDTHS[0]) await page.reload();
      await setWidth(page, width);
      await reachCard(page, bren);
      const strip = tradeCard(page, bren).getByRole('region', { name: 'Replay strip' });
      await expect(strip.getByText('At the Target since Thu Nov 12', { exact: false })).toBeVisible();
      const chart = await boxOf(strip.getByRole('img', { name: 'Trade P&L by session' }));
      const words = await boxOf(strip.getByText('At the Target since', { exact: false }));
      if (width < 480) expect(chart.y + chart.height, `the chart is above the words at ${width}`).toBeLessThanOrEqual(words.y + 1);
      else expect(chart.x + chart.width, `the chart is beside the words at ${width}`).toBeLessThanOrEqual(words.x + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `no sideways scroll at ${width}`).toBe(true);
      await strip.getByRole('button', { name: 'Replay' }).click();
      await replay(page).waitFor();
      await closeButton(replay(page)).click();
      await expect(replay(page)).toHaveCount(0);
    }
    await context.close();
  });
});
