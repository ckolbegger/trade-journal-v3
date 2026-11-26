import type { Locator } from '@playwright/test';
import { setWidth } from '../d7p/support.ts';
import { saveAction } from '../d4/support.ts';
import { closeButton, expect, hits, openCardReplay, openStandardReview, reachCard, replay, sliderValue, test, boxOf } from '../d9ar/support.ts';
import { WIDTHS } from './support.ts';

// T95.57 (A317, A318, W147 to W149, U12): the Replay opened from a Review card, at 1280 and at 375 wide with the same information. BREN is past its Target, first reached on Thu 11-12, where 2 of
// its 4 contracts were sold; no Review was written on any of its sessions.
test.describe('T95.57 The Replay: what you did that day, the Action row, Key moments', () => {
  test('should open on the first crossing and show what you did that day, the Action row and the key moments at both widths', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page, trades } = await openStandardReview(profile, copySetup);
    const bren = trades[0]!;
    for (const width of WIDTHS) {
      // The card keeps the slider where it was left while the page stays loaded, so each width starts from a fresh load.
      if (width !== WIDTHS[0]) await page.reload();
      await setWidth(page, width);
      await reachCard(page, bren);
      const scope = await openCardReplay(page, bren);
      // A318: the session of the Target's first crossing, not the newest.
      await expect(sliderValue(scope), `opens on the first crossing at ${width}`).toHaveText('Thu Nov 12 · 9 of 11');
      // W147: the fills of the day, and the Review that was not written.
      const day = scope.getByRole('region', { name: 'What you did that day' });
      await expect(day).toContainText('Sold 2 at $4.00.');
      await expect(day).toContainText('No Review this session.');
      // W149: one mark for each session up to the slider's, and the key.
      await expect(scope.getByRole('list', { name: 'Action by session' }).getByRole('listitem')).toHaveCount(9);
      await expect(scope.getByText('H Hold · E Exit · R Roll · A Adjust · – no Review')).toBeVisible();
      // The mark stands under its session's point in the chart (the row's columns are the plot's).
      const cell = await boxOf(scope.getByRole('list', { name: 'Action by session' }).getByRole('listitem').filter({ hasText: 'Thu Nov 12' }));
      const point = await boxOf(hits(scope).getByRole('button', { name: 'Thu Nov 12', exact: true }));
      expect(Math.abs(cell.x + cell.width / 2 - (point.x + point.width / 2)), `the Action row lines up with the chart at ${width}`).toBeLessThanOrEqual(3);
      // W148: every key moment, the slider's session among them.
      const moments = scope.getByRole('combobox', { name: 'Key moments' });
      await expect(moments).toHaveValue('2026-11-12');
      await expect(moments.getByRole('option')).toContainText(['Choose a moment', '1. Entry · Mon Nov 2', '2. Low · Fri Nov 6', '3. Target + Sale · Thu Nov 12', '4. High · Fri Nov 13', '5. Now · Mon Nov 16']);
      // U12: the slider, its step buttons and the drop-down are 44 px touch targets.
      for (const target of [scope.getByRole('slider', { name: 'Session' }), scope.getByRole('button', { name: 'Previous session' }), scope.getByRole('button', { name: 'Next session' }), moments]) {
        expect((await boxOf(target)).height, `a touch target at ${width}`).toBeGreaterThanOrEqual(44);
      }
      expect(await scope.evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth), `no sideways scroll at ${width}`).toBe(true);
      // Choosing a moment moves the slider to it; a session that is no moment says so.
      await moments.selectOption('2026-11-02');
      await expect(sliderValue(scope)).toHaveText('Mon Nov 2 · 1 of 11');
      await expect(day).toContainText('Bought 4 at $1.61.');
      await expect(scope.getByRole('list', { name: 'Action by session' }).getByRole('listitem')).toHaveCount(1);
      await scope.getByRole('button', { name: 'Next session' }).click();
      await expect(sliderValue(scope)).toHaveText('Tue Nov 3 · 2 of 11');
      await expect(scope.getByText('No key moment this session.')).toBeVisible();
      await closeButton(scope).click();
      await expect(replay(page)).toHaveCount(0);
    }
    await context.close();
  });

  test('should show a saved Action with its reason, its letter in the Action row, and the newest session still waiting for one at both widths', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page, trades } = await openStandardReview(profile, copySetup);
    const bren = trades[0]!;
    const rowOf = (scope: Locator) => scope.getByRole('list', { name: 'Action by session' }).getByRole('listitem');
    // Before any Action is saved for Mon Nov 16: that session is the one still to come.
    await reachCard(page, bren);
    let scope = await openCardReplay(page, bren);
    await scope.getByRole('slider', { name: 'Session' }).focus();
    await page.keyboard.press('End');
    await expect(sliderValue(scope)).toHaveText('Mon Nov 16 · 11 of 11');
    await expect(scope.getByRole('region', { name: 'What you did that day' })).toContainText('Action: not chosen yet.');
    await expect(rowOf(scope)).toHaveCount(10);
    await closeButton(scope).click();
    await saveAction(page, 'Hold', 'Target passed, letting it run.', bren);
    for (const width of WIDTHS) {
      await page.reload();
      await setWidth(page, width);
      await reachCard(page, bren);
      scope = await openCardReplay(page, bren);
      await scope.getByRole('slider', { name: 'Session' }).focus();
      await page.keyboard.press('End');
      await expect(sliderValue(scope)).toHaveText('Mon Nov 16 · 11 of 11');
      await expect(scope.getByRole('region', { name: 'What you did that day' }), `the saved Action at ${width}`).toContainText('Action: Hold · “Target passed, letting it run.”');
      await expect(rowOf(scope)).toHaveCount(11);
      await expect(rowOf(scope).last(), `its letter in the Action row at ${width}`).toContainText('HMon Nov 16: Hold');
      await closeButton(scope).click();
    }
    await context.close();
  });
});
