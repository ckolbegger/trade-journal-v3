import type { BrowserContext, Page } from '@playwright/test';
import {
  acknowledgeMark, answerIn, cardItem, createTrades, enterMark, exitReflection, expect, expectInsideCell, expectNoSidewaysScroll, expectShownInFull, firstPage, FOUR_TRADES, launchAt, MONDAY_1700, onboardedAt,
  openExitForm, openReview, openTradeFromOpenList, READY, reachCard, recordEntry, fillRows, sell, setClock, setWidth, sliderOf, test, tradeCard, TUESDAY_NOON, WIDTHS, writeSellQuantities,
  type Profile,
} from './support.ts';

// Layout of the worded reasons (plan section 6.3): each case runs at 320 and 375 px. The expected words are the module's
// (section 1.4's texts, with the app's short date), spelled out here so a change to the module shows as a failure.
test.use({ actionTimeout: 15_000 });

const DATE = 'Mon Oct 12';
const nav = (page: Page) => page.getByRole('navigation', { name: 'Primary' });
const TWO_FINDINGS = [
  'Sell of 120 XYZ on Mon Oct 12, 13:00 is more than the 100 shares in the position',
  'Sell of 130 XYZ on Mon Oct 12, 14:00 is more than the 100 shares in the position',
];
const FACTS_INCOHERENT = "Facts can't be replayed";
const MARK_MISSING_ABC = `Mark missing: ABC, ${DATE}`;
const [XYZ, ABC, DEF] = FOUR_TRADES;

// XYZ (100 shares bought) is sold in two parts, 40 at 13:00 and 20 at 14:00 on Monday.
async function sellXyzInTwoParts(page: Page): Promise<void> {
  for (const [quantity, time] of [['40', '2026-10-12T13:00'], ['20', '2026-10-12T14:00']] as const) {
    await page.goto('/');
    await openTradeFromOpenList(page, 'XYZ');
    await openExitForm(page);
    await fillRows(page, [sell(quantity, '51.00', '1.00', time)]);
    await answerIn(exitReflection(page));
    await page.getByRole('button', { name: 'Save exit' }).click();
    await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible();
  }
}

// XYZ's facts cannot be replayed (both Sells are more than the 100 shares open, edited into the stored records before launch,
// A187), ABC has no Monday Mark, DEF's Monday Mark is acknowledged unavailable. Returns the context launched on the result.
async function launchScenario(profile: Profile): Promise<{ context: BrowserContext; page: Page }> {
  const { context: setup, page: first } = await onboardedAt(profile, MONDAY_1700);
  await createTrades(first, [XYZ!, ABC!, DEF!]);
  await sellXyzInTwoParts(first);
  await openReview(first);
  await acknowledgeMark(first, 'DEF', DATE, 'No quote available.');
  await setup.close();
  await writeSellQuantities(profile.dir, 'XYZ', ['120', '130']);
  const context = await launchAt(profile, MONDAY_1700);
  const page = await firstPage(context);
  await page.goto('/');
  return { context, page };
}

test.describe('T7P.11 Layout of the worded reasons', () => {
  test('should show both finding sentences in full in the Trade Detail findings table at 320 and 375 px', async ({ server, profile }) => {
    test.setTimeout(240_000);
    server.use('dist-faults');
    const { context, page } = await launchScenario(profile);
    await openTradeFromOpenList(page, 'XYZ');
    const panel = page.getByRole('region', { name: FACTS_INCOHERENT });
    await expect(panel).toBeVisible(READY);
    for (const width of WIDTHS) {
      await setWidth(page, width);
      await expectNoSidewaysScroll(page, `Detail at ${width}`);
      const cells = panel.getByRole('table', { name: 'Facts that cannot be replayed' }).locator('tbody td');
      await expect(cells).toHaveCount(TWO_FINDINGS.length);
      for (const [index, sentence] of TWO_FINDINGS.entries()) await expectShownInFull(cells.nth(index), sentence, `finding ${index + 1} at ${width}`);
    }
    await context.close();
  });

  test('should keep the Facts cannot be replayed and Mark missing badges inside their cells in the Trades list at 320 and 375 px', async ({ server, profile }) => {
    test.setTimeout(240_000);
    server.use('dist-faults');
    const { context, page } = await launchScenario(profile);
    await nav(page).getByRole('link', { name: 'Trades' }).click();
    const list = page.getByRole('table', { name: 'Open Trades' });
    await expect(list).toBeVisible(READY);
    for (const width of WIDTHS) {
      await setWidth(page, width);
      await expectNoSidewaysScroll(page, `Trades list at ${width}`);
      await expectInsideCell(list.getByRole('row', { name: /XYZ/ }).getByText(FACTS_INCOHERENT, { exact: true }), `Facts can't be replayed badge at ${width}`);
      await expectInsideCell(list.getByRole('row', { name: /ABC/ }).getByText('Mark missing', { exact: true }), `Mark missing badge at ${width}`);
    }
    await context.close();
  });

  test('should show Mark missing and Awaiting the close in full in an Open Detail at 320 and 375 px', async ({ server, profile }) => {
    test.setTimeout(240_000);
    server.use('dist-faults');
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page, [ABC!, DEF!]);
    // DEF has its Monday Mark; ABC has none. On Tuesday noon, 40 more DEF shares entered at 10:00 await the Monday close.
    await openReview(page);
    await enterMark(page, 'DEF', DATE, '40.50');
    await setClock(context, page, TUESDAY_NOON);
    await openTradeFromOpenList(page, 'DEF');
    await recordEntry(page, [{ quantity: '40', price: '40.30', fee: '1.00', time: '2026-10-13T10:00' }]);
    await page.getByRole('link', { name: 'Back to the Trade' }).click();
    await expect(page.getByRole('region', { name: 'Valuation', exact: true })).toContainText(`Awaiting the close after ${DATE}`, READY);
    const valuation = page.getByRole('region', { name: 'Valuation', exact: true });
    for (const width of WIDTHS) {
      await setWidth(page, width);
      await expectNoSidewaysScroll(page, `DEF Detail at ${width}`);
      await expectShownInFull(valuation.locator('dt:text-is("Open P&L") + dd'), `Awaiting the close after ${DATE}`, `Awaiting the close at ${width}`);
    }
    await page.goto('/');
    await openTradeFromOpenList(page, 'ABC');
    const abcValuation = page.getByRole('region', { name: 'Valuation', exact: true });
    await expect(abcValuation).toBeVisible(READY);
    for (const width of WIDTHS) {
      await setWidth(page, width);
      await expectNoSidewaysScroll(page, `ABC Detail at ${width}`);
      await expectShownInFull(abcValuation.locator('dt:text-is("Open P&L") + dd'), MARK_MISSING_ABC, `Mark missing at ${width}`);
    }
    await context.close();
  });

  test('should show the attention sentences, slider figures and blockers in full in the Review at 320 and 375 px', async ({ server, profile }) => {
    test.setTimeout(240_000);
    server.use('dist-faults');
    const { context, page } = await launchScenario(profile);
    await openReview(page);
    const blockers = page.getByRole('list', { name: 'Blockers' });
    await expect(blockers).toBeVisible(READY);
    for (const width of WIDTHS) {
      await setWidth(page, width);
      await expectNoSidewaysScroll(page, `Review at ${width}`);
      // Blockers: the Mark missing sentence with its card link, and the incoherent Trade's first finding and "and 1 more".
      const items = blockers.getByRole('listitem');
      await expectShownInFull(items.filter({ hasText: 'Mark missing for ABC' }), `Mark missing for ABC on ${DATE}`, `Mark missing blocker at ${width}`);
      await expectShownInFull(items.filter({ hasText: 'XYZ:' }), `XYZ: ${TWO_FINDINGS[0]} and 1 more`, `incoherent blocker at ${width}`);
      await expectShownInFull(items.filter({ hasText: 'Mark missing for ABC' }).getByRole('link', { name: 'ABC', exact: true }), 'ABC', `card link at ${width}`);
      await expectShownInFull(items.filter({ hasText: 'XYZ:' }).getByRole('link', { name: 'XYZ', exact: true }), 'XYZ', `Detail link at ${width}`);
    }
    // The cards: the attention sentence of each open card, and the slider's figure text.
    const sentences = [
      ['ABC', `Mark missing for ABC on ${DATE}`, MARK_MISSING_ABC],
      ['DEF', `Mark acknowledged unavailable for DEF on ${DATE}`, `Acknowledged unavailable: DEF, ${DATE}`],
      ['XYZ', `${TWO_FINDINGS[0]} and 1 more`, 'Not available'],
    ] as const;
    for (const [symbol, sentence, figure] of sentences) {
      await reachCard(page, symbol);
      for (const width of WIDTHS) {
        await setWidth(page, width);
        await expectNoSidewaysScroll(page, `${symbol} card at ${width}`);
        await expectShownInFull(tradeCard(page, symbol).locator('p', { hasText: sentence }).first(), sentence, `${symbol} attention sentence at ${width}`);
        const slider = sliderOf(page, symbol);
        await expect(slider).toHaveAccessibleName(new RegExp(figure.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        const box = await slider.boundingBox();
        expect(box!.x + box!.width, `${symbol} slider inside the viewport at ${width}`).toBeLessThanOrEqual(width);
      }
      await cardItem(page, symbol).getByRole('button', { name: new RegExp(`^Review ${symbol}`) }).click();
    }
    await context.close();
  });
});
