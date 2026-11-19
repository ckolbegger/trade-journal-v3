import type { Locator, Page } from '@playwright/test';
import {
  actionEntriesOf, actionFormOf, boxOf, buildReview,cardReplayButton, closeButton, detail, expect, headline, openCardReplay, probe, reachCard, READY, replay, seek, sliderValue, test, tradeCard, workspaceOf,
  type TradeRef,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// B9AR.2 (plan section 7.2, AC-JOUR-001, AC-REV-003): the three-Trade Review (BREN, AXIO on R-AXIO-D, DALE-hold), every Trade Marked to Mon 11-16. On BREN's card an Action is started (Exit and an
// Intent), the Replay overlay is opened, the slider moved and the overlay closed; then opened again, Price History used and the way back taken; then the Action is saved. AXIO's and DALE-hold's
// cards are opened for their summaries, which read in the replay's words (W56, W70).
const row = (card: Locator, term: string): Locator => card.locator('dl > div').filter({ has: card.page().locator('dt', { hasText: new RegExp(`^${term}$`) }) }).locator('dd');
const actions = async (page: Page): Promise<number> => actionEntriesOf(workspaceOf(await probe(page))!).length;
const INTENT = 'The Target is reached; take the profit.';

async function startAction(page: Page, trade: TradeRef): Promise<void> {
  const form = await actionFormOf(page, trade);
  await form.getByRole('radio', { name: 'Exit', exact: true }).check();
  await form.getByLabel(/^Why are you taking this action\?/).fill(INTENT);
}
async function expectActionStarted(page: Page, trade: TradeRef, where: string): Promise<void> {
  const form = await actionFormOf(page, trade);
  await expect(form.getByRole('radio', { name: 'Exit', exact: true }), `${where}: Exit`).toBeChecked();
  await expect(form.getByLabel(/^Why are you taking this action\?/), `${where}: Intent`).toHaveValue(INTENT);
}

test.describe('B9AR.2 The overlay in the Review, and the summary', () => {
  test('should keep a started Action across the overlay, return to the same session from Price History, and save with one press', async ({ profile }) => {
    test.setTimeout(420_000);
    const { context, page, trades } = await buildReview(profile);
    const bren = trades[0]!;
    await reachCard(page, bren);
    // No replay inside the card until the button is pressed.
    await expect(tradeCard(page, bren).locator('.replay-card')).toHaveCount(0);
    await expect(replay(page)).toHaveCount(0);
    await startAction(page, bren);
    const section = await openCardReplay(page, bren);
    await expect(tradeCard(page, bren).locator('.replay-card')).toHaveCount(0);
    await expect(headline(section)).toHaveText('+$988.00 · 3.05R');
    await seek(page, section, 'ArrowLeft', 2);
    await expect(sliderValue(section)).toHaveText('Thu Nov 12 · 9 of 11');
    await closeButton(section).click();
    await expect(replay(page)).toHaveCount(0);
    await expect(cardReplayButton(page, bren)).toBeFocused();
    await expectActionStarted(page, bren, 'after Close');
    expect(await actions(page), 'opening, moving and closing the overlay records nothing').toBe(0);

    // Price History, and the way back: the overlay returns on the same session.
    await cardReplayButton(page, bren).click();
    await expect(replay(page)).toBeVisible();
    await seek(page, replay(page), 'End');
    await seek(page, replay(page), 'ArrowLeft', 2);
    await expect(sliderValue(replay(page))).toHaveText('Thu Nov 12 · 9 of 11');
    await replay(page).getByRole('link', { name: 'Price History' }).click();
    await expect(detail.heading(page, 'BREN')).toBeVisible(READY);
    await page.getByRole('link', { name: 'Back to the Review' }).click();
    await expect(page.getByRole('heading', { name: 'Review', level: 1 })).toBeVisible(READY);
    await expect(replay(page)).toBeVisible(READY);
    await expect(sliderValue(replay(page))).toHaveText('Thu Nov 12 · 9 of 11');
    await expect(headline(replay(page))).toHaveText('+$982.00 · 3.03R');
    await closeButton(replay(page)).click();
    await expect(replay(page)).toHaveCount(0);

    // One press saves the Action (the draft is whatever the card holds: the Exit and its Intent, entered again only if the trip away dropped them).
    const form = await actionFormOf(page, bren);
    if (!(await form.getByRole('radio', { name: 'Exit', exact: true }).isChecked())) await startAction(page, bren);
    await expectActionStarted(page, bren, 'before Save');
    const hidden = await form.elementHandle();
    await form.getByRole('button', { name: 'Save' }).click();
    await hidden.waitForElementState('hidden', READY);
    expect(await actions(page), 'one press saves one Action').toBe(1);
    await context.close();
  });

  // T9AR.24-B3 (C9AR.5, AC-JOUR-001, AC-REV-003): the Review is left for Price History and read again on the way back, yet the started Action is still on the card, and one press saves it.
  test('should restore a started Action on each card after the Price History round trip, and save exactly it with one press', async ({ profile }) => {
    test.setTimeout(420_000);
    const { context, page, trades } = await buildReview(profile);
    const [bren, axio] = trades as [TradeRef, TradeRef];
    let saved = 0;
    for (const trade of [bren, axio]) {
      const intent = `Why ${trade.symbol}: the Trade has run its course.`;
      await reachCard(page, trade);
      const form = await actionFormOf(page, trade);
      await form.getByRole('radio', { name: 'Exit', exact: true }).check();
      await form.getByLabel(/^Why are you taking this action\?/).fill(intent);
      await openCardReplay(page, trade);
      await seek(page, replay(page), 'End');
      await seek(page, replay(page), 'ArrowLeft', 2);
      await expect(sliderValue(replay(page))).toHaveText('Thu Nov 12 · 9 of 11');
      await replay(page).getByRole('link', { name: 'Price History' }).click();
      await expect(detail.heading(page, trade.symbol)).toBeVisible(READY);
      expect(await actions(page), `the trip away records nothing (${trade.symbol})`).toBe(saved);
      await page.getByRole('link', { name: 'Back to the Review' }).click();
      await expect(replay(page)).toBeVisible(READY);
      await expect(sliderValue(replay(page))).toHaveText('Thu Nov 12 · 9 of 11');
      await closeButton(replay(page)).click();
      await expect(replay(page)).toHaveCount(0);
      const back = await actionFormOf(page, trade);
      await expect(back.getByRole('radio', { name: 'Exit', exact: true }), `${trade.symbol}: Exit after the return`).toBeChecked();
      await expect(back.getByLabel(/^Why are you taking this action\?/), `${trade.symbol}: Intent after the return`).toHaveValue(intent);
      const hidden = await back.elementHandle();
      await back.getByRole('button', { name: 'Save' }).click();
      await hidden.waitForElementState('hidden', READY);
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
  test('should keep a started Action when the browser goes Forward to Price History and Back again after a round trip', async ({ profile }) => {
    test.setTimeout(420_000);
    const { context, page, trades } = await buildReview(profile);
    const bren = trades[0]!;
    await reachCard(page, bren);
    await startAction(page, bren);
    await openCardReplay(page, bren);
    await replay(page).getByRole('link', { name: 'Price History' }).click();
    await expect(detail.heading(page, 'BREN')).toBeVisible(READY);
    await page.getByRole('link', { name: 'Back to the Review' }).click();
    await expect(replay(page)).toBeVisible(READY);
    await expectActionStarted(page, bren, 'after the round trip');
    // The link back pushed a new entry, so Forward is only possible after Back: Back to Price History, Back to the first Review entry,
    // then the browser's Forward to Price History and its Back to the Review.
    await page.goBack();
    await expect(detail.heading(page, 'BREN')).toBeVisible(READY);
    await page.goBack();
    await expect(replay(page)).toBeVisible(READY);
    await page.goForward();
    await expect(detail.heading(page, 'BREN')).toBeVisible(READY);
    await page.goBack();
    await expect(replay(page)).toBeVisible(READY);
    await closeButton(replay(page)).click();
    await expectActionStarted(page, bren, 'after Forward and Back');
    expect(await actions(page), 'the browser trips record nothing').toBe(0);
    await context.close();
  });

  // T9AR.24-B11 (gate critic-2, defect 3, W46): Price History from the Review's overlay arrives with the session's column header focused and in view.
  test('should arrive at Price History from the Review with the slider session column header focused and inside its scroller', async ({ profile }) => {
    test.setTimeout(420_000);
    const { context, page, trades } = await buildReview(profile);
    const axio = trades[1]!;
    await reachCard(page, axio);
    const section = await openCardReplay(page, axio);
    await seek(page, section, 'ArrowLeft', 5);
    await expect(sliderValue(section)).toHaveText(/^Mon Nov 9 · /);
    await section.getByRole('link', { name: 'Price History' }).click();
    await expect(detail.heading(page, 'AXIO')).toBeVisible(READY);
    await expect(page).toHaveURL(/drawer=price-history&session=2026-11-09&from=review/);
    const header = page.getByRole('columnheader', { name: /Mon\s*Nov 9/ });
    await expect(header).toBeFocused(READY);
    const scroller = page.getByRole('region', { name: 'Price History' });
    const [h, s] = [await boxOf(header), await boxOf(scroller)];
    expect(h.x, 'column starts inside the scroller').toBeGreaterThanOrEqual(s.x - 1);
    expect(h.x + h.width, 'column ends inside the scroller').toBeLessThanOrEqual(s.x + s.width + 1);
    await context.close();
  });

  // T9AR.24-B11-B1: a reload with Replay open on a Price History address does not arrive; Close returns focus to the Replay button (A273).
  test('should return focus to Replay on Close after a reload of the Price History address with Replay open', async ({ profile }) => {
    test.setTimeout(420_000);
    const { context, page, trades } = await buildReview(profile);
    const axio = trades[1]!;
    await reachCard(page, axio);
    const section = await openCardReplay(page, axio);
    await section.getByRole('link', { name: 'Price History' }).click();
    await expect(detail.heading(page, 'AXIO')).toBeVisible(READY);
    await page.getByRole('button', { name: 'Replay' }).click();
    await expect(page).toHaveURL(/drawer=price-history&session=[\d-]+.*replay=open/);
    await page.reload();
    const dialog = page.getByRole('dialog', { name: /^Replay/ });
    await expect(dialog).toBeVisible(READY);
    await closeButton(dialog).click();
    await expect(dialog).toBeHidden(READY);
    await expect(page.getByRole('button', { name: 'Replay' })).toBeFocused(READY);
    await context.close();
  });

  test('should read each card’s summary in the replay’s words, with no zero Overrun', async ({ profile }) => {
    test.setTimeout(420_000);
    const { context, page, trades } = await buildReview(profile);
    const [bren, axio, dale] = trades as [TradeRef, TradeRef, TradeRef];
    await reachCard(page, bren);
    await expect(row(tradeCard(page, bren), 'Trade P&L')).toHaveText('+$988.00 · +3.05R');
    await expect(row(tradeCard(page, bren), 'Remaining Reward')).toHaveText('Past the Target by $32.00 (0.10R)');
    await expect(row(tradeCard(page, bren), 'Current Risk · At Stop')).toHaveCount(1);
    await reachCard(page, axio);
    await expect(row(tradeCard(page, axio), 'Current Risk')).toHaveText('Past the Stop by $300.00 (0.50R)');
    await expect(tradeCard(page, axio)).not.toContainText('$0.00 · 0.00R');
    await reachCard(page, dale);
    await expect(row(tradeCard(page, dale), 'Current Risk')).toHaveText('Past the Stop by $552.00 (0.36R)');
    await expect(tradeCard(page, dale)).not.toContainText('$0.00 · 0.00R');
    await context.close();
  });
});
