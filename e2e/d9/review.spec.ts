import {
  actionFormOf, BREN, openCardReplay, detail, expect, going, headline, openDrawer, openReview, readoutValue, reachCard, LAUNCH, replay, seek, slider, sliderValue, test, tradeCard,
} from './support.ts';
import { openStandardDetail } from '../d9ar/support.ts';

test.use({ actionTimeout: 15_000 });

// B9.3 (plan section 7.2): R-BREN-U with Mon 11-16's Marks saved; the Review card opened. The Replay strip sits above the card's panels and its overlay links only to Price
// History; the slider moves (the Review's address and the Trade's facts are unchanged); Price History opens on the slider's session; "Back to the Review" returns to the same card,
// panel and session (/review?trade=<id>&panel=Action&session=<date>).
test.describe('B9.3 Replay in the Review, and the round trip', () => {
  test('should show the Replay button in the strip, not in the Action panel, opening the replay with Price History as its only link', async ({ profile, copySetup }) => {
    test.setTimeout(240_000);
    const { context, page, trade } = await openStandardDetail(profile, copySetup, BREN);
    await page.goto('/');
    await openReview(page);
    await reachCard(page, trade);
    // T95.56: in the card's Replay strip, none in the Action panel, and no replay inside the card until the button is pressed.
    await expect(tradeCard(page, trade).getByRole('region', { name: 'Replay strip' }).locator('button.review-card-replay')).toHaveCount(1);
    await expect(tradeCard(page, trade).locator('[id$="-Action"]').locator('button.review-card-replay')).toHaveCount(0);
    await expect(replay(page)).toHaveCount(0);
    const section = await openCardReplay(page, trade);
    // A318: the Trade is past its Target, first reached on Thu 11-12, so the Replay opens there and not on the newest session.
    await expect(sliderValue(section)).toHaveText('Thu Nov 12 · 9 of 11');
    await expect(headline(section)).toHaveText('+$982.00 · 3.03R');
    await expect(going(section)).toHaveText('Target reached, $26.00 past it.');
    // The card's replay places no Journal items and links only to Price History.
    await expect(section.getByRole('link')).toHaveText(['Price History']);
    await expect(section.getByRole('button', { name: /^(Position|Journal)$/ })).toHaveCount(0);
    await section.getByRole('button', { name: 'Close' }).click();
    await expect(actionFormOf(page, trade).then((form) => form.getByRole('button', { name: 'Save' }))).resolves.toBeVisible();
    await context.close();
  });

  test('should move the slider on the card, open Price History on that session and return to the same card, panel and session', async ({ profile, copySetup }) => {
    test.setTimeout(240_000);
    const { context, page, trade } = await openStandardDetail(profile, copySetup, BREN);
    await page.goto('/');
    await openReview(page);
    await reachCard(page, trade);
    const section = await openCardReplay(page, trade);
    // A318: it opens on Thu 11-12; the slider moves away to Wed 11-11 and back.
    await expect(sliderValue(section)).toHaveText('Thu Nov 12 · 9 of 11');
    await seek(page, section, 'ArrowLeft');
    await expect(sliderValue(section)).toHaveText('Wed Nov 11 · 8 of 11');
    await seek(page, section, 'ArrowRight');
    await expect(sliderValue(section)).toHaveText('Thu Nov 12 · 9 of 11');
    await expect(headline(section)).toHaveText('+$982.00 · 3.03R');
    await expect(readoutValue(section, 'Realized')).toHaveText('+$478.00');
    // Moving the slider writes nothing and does not leave the Review; the address names the open overlay and the session it opened on.
    expect(new URL(page.url()).pathname).toBe('/review');
    expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({ trade: trade.tradeId, panel: 'Action', replay: 'open', session: '2026-11-12' });

    await section.getByRole('link', { name: 'Price History' }).click();
    await expect(detail.heading(page, 'BREN')).toBeVisible(LAUNCH);
    const url = new URL(page.url());
    expect(url.pathname).toBe(`/trades/${trade.tradeId}`);
    expect(Object.fromEntries(url.searchParams)).toEqual({ drawer: 'price-history', session: '2026-11-12', from: 'review', panel: 'Action' });
    // Price History is the selected drawer (with its Thu Nov 12 column), and the address names that session for the Replay overlay too (A257).
    await expect(page.getByRole('tablist', { name: 'Detail' }).getByRole('tab', { selected: true })).toHaveText(/^Price History/);
    await expect(page.locator('#drawer-panel-price-history th[data-session="2026-11-12"]')).toHaveText('ThuNov 12');
    // The Replay overlay, opened here, is on the same session; the page under it is inert, so it is closed before the link is used.
    await openDrawer(page, 'Replay');
    await expect(sliderValue(replay(page))).toHaveText('Thu Nov 12 · 9 of 11');
    await replay(page).getByRole('button', { name: 'Close' }).click();

    await page.getByRole('link', { name: 'Back to the Review' }).click();
    await expect(page).toHaveURL(new RegExp(`/review\\?trade=${trade.tradeId}&panel=Action&replay=open&session=2026-11-12$`));
    await expect(page.getByRole('heading', { name: 'Review', level: 1 })).toBeVisible();
    const returned = replay(page);
    await expect(returned).toBeVisible();
    await expect(tradeCard(page, trade).getByRole('button', { name: /^Action\b/ })).toHaveAttribute('aria-expanded', 'true');
    await expect(sliderValue(returned)).toHaveText('Thu Nov 12 · 9 of 11');
    await expect(slider(returned)).toHaveValue('8');
    await expect(headline(returned)).toHaveText('+$982.00 · 3.03R');
    await context.close();
  });
});
