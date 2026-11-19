import {
  boxOf, BREN, build, closeButton, closeOf, detail, detailReplayButton, expect, headline, PRICE_HISTORY, READY, replay, seek, slider, sliderValue, test,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// B9AR.1 (plan section 7.2, AC-UI-001): R-BREN-U to Mon 11-16, on Trade Detail. The six drawers and the Replay button beside them (W54); the overlay named "Replay, BREN" with W53's header; each way
// of closing it (Escape, Close, the browser's Back) leaves the Trade's page and puts focus on the button; a reload inside it reopens it; Price History closes it and focuses that session's column;
// and at 1280 the readout is beside the charts.
test.describe('B9AR.1 The overlay on Trade Detail', () => {
  test('should open the overlay from the Replay button beside six drawers, named and headed as W53 says', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    const tabs = page.getByRole('tablist', { name: 'Detail' });
    await expect(tabs.getByRole('tab')).toHaveText(['Today', 'Position', 'Plan and Risk', PRICE_HISTORY, /^Journal( \d+ owed)?$/, 'Payoff']);
    await expect(detailReplayButton(page)).toHaveCount(1);
    await expect(replay(page)).toHaveCount(0);
    await detailReplayButton(page).click();
    const dialog = page.getByRole('dialog', { name: 'Replay, BREN', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('BREN · Trade P&L +$988.00');
    await expect(headline(dialog)).toHaveText('+$988.00 · 3.05R');
    // It covers the whole page: the dialog's box is the viewport's.
    const viewport = page.viewportSize()!;
    expect(await boxOf(dialog)).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
    await context.close();
  });

  test('should close by Escape, by Close and by the browser’s Back, each leaving the Trade’s page with focus on the Replay button', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page, trade } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    const onTrade = async (how: string): Promise<void> => {
      await expect(replay(page), how).toHaveCount(0);
      expect(new URL(page.url()).pathname, `${how}: still the Trade's page`).toBe(`/trades/${trade.tradeId}`);
      await expect(detail.heading(page, 'BREN'), how).toBeVisible();
      await expect(detailReplayButton(page), `${how}: focus`).toBeFocused();
    };
    await detailReplayButton(page).click();
    await expect(replay(page)).toBeVisible();
    await expect(closeButton(replay(page))).toBeFocused();
    await page.keyboard.press('Escape');
    await onTrade('Escape');
    await detailReplayButton(page).click();
    await expect(replay(page)).toBeVisible();
    await closeButton(replay(page)).click();
    await onTrade('Close');
    await detailReplayButton(page).click();
    await expect(replay(page)).toBeVisible();
    await page.goBack();
    await onTrade('Back');
    await context.close();
  });

  test('should reopen on a reload inside the overlay, and let Price History close it and focus that session’s column', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page, trade } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    await detailReplayButton(page).click();
    await seek(page, replay(page), 'ArrowLeft', 2);
    await expect(sliderValue(replay(page))).toHaveText('Thu Nov 12 · 9 of 11');
    await page.reload();
    await expect(replay(page)).toBeVisible(READY);
    // The address names the open overlay, not the slider's session, so the slider is put back on Thu 11-12 before Price History is used.
    await seek(page, replay(page), 'ArrowLeft', 2);
    await expect(sliderValue(replay(page))).toHaveText('Thu Nov 12 · 9 of 11');
    await expect(slider(replay(page))).toHaveValue('8');
    await replay(page).getByRole('button', { name: 'Price History' }).click();
    await expect(replay(page)).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe(`/trades/${trade.tradeId}`);
    await expect(page.getByRole('tablist', { name: 'Detail' }).getByRole('tab', { selected: true })).toHaveText(PRICE_HISTORY);
    const column = page.locator('#drawer-panel-price-history th[data-session="2026-11-12"]');
    await expect(column).toBeVisible();
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('th[data-session="2026-11-12"]'))).toBe(true);
    await context.close();
  });

  test('should put the readout beside the charts at 1280', async ({ profile }) => {
    test.setTimeout(240_000);
    // Product disagrees with the plan (reported to the main session): `.replay-chart-box` is the grid child since T9AR.16 and spans both columns, so the readout sits below the charts, not beside them.
    const { context, page } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    expect(page.viewportSize()!.width).toBe(1280);
    await detailReplayButton(page).click();
    const scope = replay(page);
    await expect(headline(scope)).toBeVisible();
    // Geometry, not the stylesheet: the readout's box is to the right of the charts' box, and the two overlap vertically.
    const charts = await boxOf(scope.locator('.replay-chart-box'));
    const readout = await boxOf(scope.getByTestId('readout'));
    await page.screenshot({ path: 'evidence/D09AR/screenshots/B9AR.1-overlay-1280.png' });
    expect(readout.x, `the readout (x ${Math.round(readout.x)}) starts at or right of the charts' right edge (${Math.round(charts.x + charts.width)})`).toBeGreaterThanOrEqual(charts.x + charts.width - 1);
    const overlap = Math.min(charts.y + charts.height, readout.y + readout.height) - Math.max(charts.y, readout.y);
    expect(overlap, `the readout (y ${Math.round(readout.y)} to ${Math.round(readout.y + readout.height)}) overlaps the charts (y ${Math.round(charts.y)} to ${Math.round(charts.y + charts.height)}) vertically`).toBeGreaterThan(0);
    await context.close();
  });
});
