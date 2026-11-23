import type { Locator } from '@playwright/test';
import { expectNoSidewaysScroll } from '../d7p/support.ts';
import { BREN, detailReplayButton, expect, expectAccessible, expectFitsOneScreen, openStandardDetail, replay, setViewport, test } from '../d9ar/support.ts';

test.use({ actionTimeout: 15_000 });

// B9.7 (plan section 7.2, AC-UI-001, AC-UI-002, D9A-R): R-BREN-U to Mon 11-16 in the Detail's Replay overlay at 375 and 320 px wide (667 high). The implied volatility chip's small chart is opened by keyboard and
// measured inside the full-screen overlay: it lies inside the viewport, nothing scrolls sideways and axe finds no WCAG 2.1 A or AA violation with it open.
const SIZES = [
  { width: 375, height: 667 },
  { width: 320, height: 667 },
] as const;

const volatilityChip = (scope: Locator): Locator => scope.getByTestId('chips').getByRole('button', { name: /^Implied volatility/ });
const smallChart = (scope: Locator): Locator => scope.getByRole('group', { name: 'Implied volatility by session' });

for (const size of SIZES) {
  test.describe(`B9.7 The estimates, accessible, at ${size.width} px`, () => {
    test(`should keep the chip's small chart inside the overlay with no sideways scroll and no axe violation at ${size.width} px`, async ({ profile, copySetup }) => {
      test.setTimeout(240_000);
      const { context, page } = await openStandardDetail(profile, copySetup, BREN);
      await setViewport(page, size.width, size.height);
      await detailReplayButton(page).click();
      const scope = replay(page);
      await expect(scope).toBeVisible();
      const where = `the overlay at ${size.width} px`;
      await scope.getByRole('slider', { name: 'Session' }).focus();
      for (let presses = 0; presses < 12 && !(await volatilityChip(scope).evaluate((el) => el === document.activeElement)); presses += 1) await page.keyboard.press('Tab');
      await expect(volatilityChip(scope), `${where}: Tab reaches the chip`).toBeFocused();
      await expect(smallChart(scope), `${where}: the chart is open`).toBeVisible();
      // Measured inside the overlay: the dialog is the whole viewport, and the chart's box and its drawing lie inside it.
      const dialog = (await scope.boundingBox())!;
      expect(dialog, `${where}: the overlay is the whole viewport`).toEqual({ x: 0, y: 0, width: size.width, height: size.height });
      const pop = (await smallChart(scope).boundingBox())!;
      const drawing = (await smallChart(scope).locator('svg.replay-chip-chart').boundingBox())!;
      for (const [name, box] of [['chart box', pop], ['drawing', drawing]] as const) {
        expect(box.x, `${where}: ${name} left edge`).toBeGreaterThanOrEqual(-0.5);
        expect(box.x + box.width, `${where}: ${name} right edge`).toBeLessThanOrEqual(size.width + 0.5);
        expect(box.y, `${where}: ${name} top edge`).toBeGreaterThanOrEqual(-0.5);
        expect(box.y + box.height, `${where}: ${name} bottom edge`).toBeLessThanOrEqual(size.height + 0.5);
      }
      expect(drawing.width, `${where}: the drawing has room to read`).toBeGreaterThan(150);
      test.info().annotations.push({ type: 'chip chart width', description: `${size.width} px: box ${pop.width.toFixed(1)}, drawing ${drawing.width.toFixed(1)}` });
      console.log(`CHIP CHART ${size.width} px: box ${pop.width.toFixed(1)} x ${pop.height.toFixed(1)}, drawing ${drawing.width.toFixed(1)} x ${drawing.height.toFixed(1)}`);
      // The open chart moves nothing: the headline and both charts still fit, and the page does not scroll sideways.
      await expectFitsOneScreen(scope, size, where);
      await expectNoSidewaysScroll(page, where);
      await expectAccessible(page, where);
      await context.close();
    });
  });
}
