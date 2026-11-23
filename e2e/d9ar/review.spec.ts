import type { Page } from '@playwright/test';
import {
  actionEntriesOf, actionFormOf, boxOf, cardReplayButton, closeButton, detail, expect, headline, openCardReplay, openStandardReview, pressSave, probe, reachCard, LAUNCH, replay, seek, sliderValue, test, tradeCard, workspaceOf,
  type TradeRef,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// B9AR.2 (plan section 7.2, AC-JOUR-001, AC-REV-003): the three-Trade Review (BREN, AXIO on R-AXIO-D, DALE-hold), every Trade Marked to Mon 11-16. On BREN's card an Action is started (Exit and an
// Intent), the Replay overlay is opened, the slider moved and the overlay closed; then opened again, Price History used and the way back taken; then the Action is saved. AXIO's and DALE-hold's
// cards are opened for their Now boxes, which caption the line each has passed (W86).
const actions = async (page: Page): Promise<number> => actionEntriesOf(workspaceOf(await probe(page))!).length;
const INTENT = 'The Target is reached; take the profit.';

async function startAction(page: Page, trade: TradeRef): Promise<void> {
  const form = await actionFormOf(page, trade);
  await form.getByRole('radio', { name: 'Exit', exact: true }).check();
  await form.getByLabel(/^Why are you taking this action\?/).fill(INTENT);
}
async function expectActionStarted(page: Page, trade: TradeRef, where: string, intent: string = INTENT): Promise<void> {
  const form = await actionFormOf(page, trade);
  await expect(form.getByRole('radio', { name: 'Exit', exact: true }), `${where}: Exit`).toBeChecked();
  await expect(form.getByLabel(/^Why are you taking this action\?/), `${where}: Intent`).toHaveValue(intent);
}

test.describe('B9AR.2 The overlay in the Review, and the summary', () => {
  // T9AR.24-B3 (C9AR.5, AC-JOUR-001, AC-REV-003): the Review is left for Price History and read again on the way back, yet the started Action is still on the card, and one press saves it.
  test('should restore a started Action on each card after the Price History round trip, and save exactly it with one press', async ({ profile, copySetup }) => {
    test.setTimeout(420_000);
    const { context, page, trades } = await openStandardReview(profile, copySetup);
    const [bren, axio] = trades as [TradeRef, TradeRef];
    let saved = 0;
    for (const trade of [bren, axio]) {
      const intent = `Why ${trade.symbol}: the Trade has run its course.`;
      await reachCard(page, trade);
      // No replay inside the card and no overlay until the button is pressed.
      await expect(tradeCard(page, trade).locator('.replay-card')).toHaveCount(0);
      await expect(replay(page)).toHaveCount(0);
      const form = await actionFormOf(page, trade);
      await form.getByRole('radio', { name: 'Exit', exact: true }).check();
      await form.getByLabel(/^Why are you taking this action\?/).fill(intent);
      // Moved from the dropped "keep a started Action across the overlay" case: open, move and Close once, before the round trip.
      const section = await openCardReplay(page, trade);
      await expect(tradeCard(page, trade).locator('.replay-card')).toHaveCount(0);
      if (trade === bren) await expect(headline(section)).toHaveText('+$988.00 · 3.05R');
      await seek(page, section, 'ArrowLeft', 2);
      await expect(sliderValue(section)).toHaveText('Thu Nov 12 · 9 of 11');
      await closeButton(section).click();
      await expect(replay(page)).toHaveCount(0);
      await expect(cardReplayButton(page, trade)).toBeFocused();
      await expectActionStarted(page, trade, `${trade.symbol} after Close`, intent);
      expect(await actions(page), `opening, moving and closing the overlay records nothing (${trade.symbol})`).toBe(saved);
      await cardReplayButton(page, trade).click();
      await expect(replay(page)).toBeVisible();
      await seek(page, replay(page), 'End');
      await seek(page, replay(page), 'ArrowLeft', 2);
      await expect(sliderValue(replay(page))).toHaveText('Thu Nov 12 · 9 of 11');
      await replay(page).getByRole('link', { name: 'Price History' }).click();
      await expect(detail.heading(page, trade.symbol)).toBeVisible();
      expect(await actions(page), `the trip away records nothing (${trade.symbol})`).toBe(saved);
      await page.getByRole('link', { name: 'Back to the Review' }).click();
      await expect(replay(page)).toBeVisible();
      await expect(sliderValue(replay(page))).toHaveText('Thu Nov 12 · 9 of 11');
      if (trade === bren) await expect(headline(replay(page))).toHaveText('+$982.00 · 3.03R');
      await closeButton(replay(page)).click();
      await expect(replay(page)).toHaveCount(0);
      const back = await actionFormOf(page, trade);
      await expect(back.getByRole('radio', { name: 'Exit', exact: true }), `${trade.symbol}: Exit after the return`).toBeChecked();
      await expect(back.getByLabel(/^Why are you taking this action\?/), `${trade.symbol}: Intent after the return`).toHaveValue(intent);
      await pressSave(back);
      saved += 1;
      expect(await actions(page), 'one press saves one Action').toBe(saved);
      const mine = actionEntriesOf(workspaceOf(await probe(page))!).find((entry) => entry.obligationKey?.[2] === trade.tradeId);
      const answers = (mine?.versions as { responses: { promptId: string; value: unknown }[] }[] | undefined)?.at(-1)?.responses;
      expect(answers?.find((r) => r.promptId === 'prompt.daily-trade-review.action')?.value, `${trade.symbol}: the choice saved`).toEqual({ kind: 'Option', optionId: 'option.daily-trade-review.action.exit' });
      expect(answers?.find((r) => r.promptId === 'prompt.daily-trade-review.intent')?.value, `${trade.symbol}: the Intent saved`).toEqual({ kind: 'Text', text: intent });
    }
    await context.close();
  });

  // T9AR.24-B3-B2 (C9AR.5): the browser's Forward to Price History and Back again, after one round trip, keep the started Action too.
  test('should keep a started Action when the browser goes Forward to Price History and Back again after a round trip', async ({ profile, copySetup }) => {
    test.setTimeout(420_000);
    const { context, page, trades } = await openStandardReview(profile, copySetup);
    const bren = trades[0]!;
    await reachCard(page, bren);
    await startAction(page, bren);
    await openCardReplay(page, bren);
    await replay(page).getByRole('link', { name: 'Price History' }).click();
    await expect(detail.heading(page, 'BREN')).toBeVisible();
    await page.getByRole('link', { name: 'Back to the Review' }).click();
    await expect(replay(page)).toBeVisible();
    await expectActionStarted(page, bren, 'after the round trip');
    // The link back pushed a new entry, so Forward is only possible after Back: Back to Price History, Back to the first Review entry,
    // then the browser's Forward to Price History and its Back to the Review.
    await page.goBack();
    await expect(detail.heading(page, 'BREN')).toBeVisible();
    await page.goBack();
    await expect(replay(page)).toBeVisible();
    await page.goForward();
    await expect(detail.heading(page, 'BREN')).toBeVisible();
    await page.goBack();
    await expect(replay(page)).toBeVisible();
    await closeButton(replay(page)).click();
    await expectActionStarted(page, bren, 'after Forward and Back');
    expect(await actions(page), 'the browser trips record nothing').toBe(0);
    await context.close();
  });

  // T9AR.24-B11 (gate critic-2, defect 3, W46): Price History from the Review's overlay arrives with the session's column header focused and in view.
  test('should arrive at Price History from the Review with the slider session column header focused and inside its scroller', async ({ profile, copySetup }) => {
    test.setTimeout(420_000);
    const { context, page, trades } = await openStandardReview(profile, copySetup);
    const axio = trades[1]!;
    await reachCard(page, axio);
    const section = await openCardReplay(page, axio);
    await seek(page, section, 'ArrowLeft', 5);
    await expect(sliderValue(section)).toHaveText(/^Mon Nov 9 · /);
    await section.getByRole('link', { name: 'Price History' }).click();
    await expect(detail.heading(page, 'AXIO')).toBeVisible();
    await expect(page).toHaveURL(/drawer=price-history&session=2026-11-09&from=review/);
    const header = page.getByRole('columnheader', { name: /Mon\s*Nov 9/ });
    await expect(header).toBeFocused();
    const scroller = page.getByRole('region', { name: 'Price History' });
    const [h, s] = [await boxOf(header), await boxOf(scroller)];
    expect(h.x, 'column starts inside the scroller').toBeGreaterThanOrEqual(s.x - 1);
    expect(h.x + h.width, 'column ends inside the scroller').toBeLessThanOrEqual(s.x + s.width + 1);
    await context.close();
  });

  // T9AR.24-B11-B1: a reload with Replay open on a Price History address does not arrive; Close returns focus to the Replay button (A273).
  test('should return focus to Replay on Close after a reload of the Price History address with Replay open', async ({ profile, copySetup }) => {
    test.setTimeout(420_000);
    const { context, page, trades } = await openStandardReview(profile, copySetup);
    const axio = trades[1]!;
    await reachCard(page, axio);
    const section = await openCardReplay(page, axio);
    await section.getByRole('link', { name: 'Price History' }).click();
    await expect(detail.heading(page, 'AXIO')).toBeVisible();
    await page.getByRole('button', { name: 'Replay' }).click();
    await expect(page).toHaveURL(/drawer=price-history&session=[\d-]+.*replay=open/);
    await page.reload();
    const dialog = page.getByRole('dialog', { name: /^Replay/ });
    await expect(dialog).toBeVisible(LAUNCH);
    await closeButton(dialog).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Replay' })).toBeFocused();
    await context.close();
  });

  test('should caption the line each card has passed in the Now box, with no zero Overrun', async ({ profile, copySetup }) => {
    test.setTimeout(420_000);
    const { context, page, trades } = await openStandardReview(profile, copySetup);
    const [bren, axio, dale] = trades as [TradeRef, TradeRef, TradeRef];
    await reachCard(page, bren);
    const caption = (card: TradeRef, line: 'stop' | 'target') => tradeCard(page, card).locator(`.now-box [data-caption="${line}"]`);
    await expect(caption(bren, 'target')).toHaveText('$0.16 past Target (+$32.00 so far)');
    await expect(caption(bren, 'stop')).toContainText(' to Stop (lose ');
    await reachCard(page, axio);
    await expect(caption(axio, 'stop')).toHaveText('$3.00 past Stop (−$300.00 so far)');
    await expect(tradeCard(page, axio)).not.toContainText('$0.00 · 0.00R');
    await reachCard(page, dale);
    await expect(caption(dale, 'stop')).toHaveText(/^\$[\d.]+ past Stop \(−\$552\.00 so far\)$/);
    await expect(tradeCard(page, dale)).not.toContainText('$0.00 · 0.00R');
    await context.close();
  });
});
