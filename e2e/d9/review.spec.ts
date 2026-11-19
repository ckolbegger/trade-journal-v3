import {
  actionFormOf, BREN, build, cardReplay, closeOf, detail, expect, going, headline, openDrawer, openReview, readoutValue, reachCard, READY, replay, seek, slider, sliderValue, test, tradeCard,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// B9.3 (plan section 7.2): R-BREN-U with Mon 11-16's Marks saved; the Review card opened. The Replay section sits above the Action form in the card's Action panel and links only to Price
// History; the slider moves (the Review's address and the Trade's facts are unchanged); Price History opens on the slider's session; "Back to the Review" returns to the same card,
// panel and session (/review?trade=<id>&panel=Action&session=<date>).
test.describe('B9.3 Replay in the Review, and the round trip', () => {
  test('should show the Replay section above the Action form, headed Replay, with Price History as its only link', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page, trade } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    await page.goto('/');
    await openReview(page);
    await reachCard(page, trade);
    const section = cardReplay(page, trade);
    await expect(section.getByRole('heading', { name: 'Replay', level: 5 })).toBeVisible(READY);
    // Above the Action form, both in the Action panel.
    const action = tradeCard(page, trade).locator('[id$="-Action"]');
    await expect(action.locator('section.review-card-replay')).toHaveCount(1);
    const order = await action.evaluate((panel) => {
      const replaySection = panel.querySelector('section.review-card-replay')!;
      const form = panel.querySelector('form[aria-label="Action"]')!;
      return replaySection.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING ? 'replay first' : 'form first';
    });
    expect(order).toBe('replay first');
    await expect(headline(section)).toHaveText('+$988.00 · 3.05R');
    await expect(going(section)).toHaveText('Target reached, $32.00 past it.');
    await expect(sliderValue(section)).toHaveText('Mon Nov 16 · 11 of 11');
    // The card's replay places no Journal items and links only to Price History.
    await expect(section.getByRole('link')).toHaveText(['Price History']);
    await expect(section.getByRole('button', { name: /^(Position|Journal)$/ })).toHaveCount(0);
    await expect(actionFormOf(page, trade).then((form) => form.getByRole('button', { name: 'Save' }))).resolves.toBeVisible();
    await context.close();
  });

  test('should move the slider on the card, open Price History on that session and return to the same card, panel and session', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page, trade } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    await page.goto('/');
    await openReview(page);
    await reachCard(page, trade);
    const section = cardReplay(page, trade);
    await seek(page, section, 'ArrowLeft', 2);
    await expect(sliderValue(section)).toHaveText('Thu Nov 12 · 9 of 11');
    await expect(headline(section)).toHaveText('+$982.00 · 3.03R');
    await expect(readoutValue(section, 'Banked')).toHaveText('+$478.00');
    // Moving the slider writes nothing and does not leave the Review.
    expect(new URL(page.url()).pathname).toBe('/review');
    expect(new URL(page.url()).search).toBe('');

    await section.getByRole('link', { name: 'Price History' }).click();
    await expect(detail.heading(page, 'BREN')).toBeVisible(READY);
    const url = new URL(page.url());
    expect(url.pathname).toBe(`/trades/${trade.tradeId}`);
    expect(Object.fromEntries(url.searchParams)).toEqual({ drawer: 'price-history', session: '2026-11-12', from: 'review' });
    // Price History is the selected drawer (with its Thu Nov 12 column), and the address names that session for the Replay drawer too (A257).
    await expect(page.getByRole('tablist', { name: 'Detail' }).getByRole('tab', { selected: true })).toHaveText(/^Price History/);
    await expect(page.locator('#drawer-panel-price-history th[data-session="2026-11-12"]')).toHaveText('ThuNov 12');
    // The Replay overlay, opened here, is on the same session; the page under it is inert, so it is closed before the link is used.
    await openDrawer(page, 'Replay');
    await expect(sliderValue(replay(page))).toHaveText('Thu Nov 12 · 9 of 11');
    await replay(page).getByRole('button', { name: 'Close' }).click();

    await page.getByRole('link', { name: 'Back to the Review' }).click();
    await expect(page).toHaveURL(new RegExp(`/review\\?trade=${trade.tradeId}&panel=Action&replay=open&session=2026-11-12$`));
    await expect(page.getByRole('heading', { name: 'Review', level: 1 })).toBeVisible(READY);
    const returned = cardReplay(page, trade);
    await expect(returned).toBeVisible(READY);
    await expect(tradeCard(page, trade).getByRole('button', { name: /^Action\b/ })).toHaveAttribute('aria-expanded', 'true');
    await expect(sliderValue(returned)).toHaveText('Thu Nov 12 · 9 of 11');
    await expect(slider(returned)).toHaveValue('8');
    await expect(headline(returned)).toHaveText('+$982.00 · 3.03R');
    await context.close();
  });
});
