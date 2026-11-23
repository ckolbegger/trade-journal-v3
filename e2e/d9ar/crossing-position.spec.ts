import type { Locator } from '@playwright/test';
import { AXIO, expect, going, openDrawer, openStandardDetail, replay, setViewport, stake, test } from './support.ts';

test.use({ actionTimeout: 15_000 });

// T9AR.18-D1 (W64): the first-crossing sentence sits after the status line on a wide screen and, on a phone (860 px and under), after the charts and above the readout.
const top = async (locator: Locator): Promise<number> => (await locator.boundingBox())!.y;

test.describe('T9AR.18-D1 Where the first-crossing sentence sits', () => {
  test('should put the first-crossing sentence after the charts on a phone and after the status line on a wide screen', async ({ profile, copySetup }) => {
    test.setTimeout(240_000);
    const { context, page } = await openStandardDetail(profile, copySetup, AXIO);
    await openDrawer(page, 'Replay');
    const scope = replay(page);
    const crossing = scope.getByTestId('crossing');
    await expect(crossing).toBeVisible();
    const chartBottom = async () => {
      const box = (await scope.locator('.replay-chart-box').last().boundingBox())!;
      return box.y + box.height;
    };
    // Wide: after the status line, before the stake sentence.
    await setViewport(page, 1280, 900);
    await expect(crossing).toBeVisible();
    expect(await top(crossing)).toBeGreaterThan(await top(going(scope)));
    expect(await top(crossing)).toBeLessThan(await top(stake(scope)));
    // A phone: after the charts, above the readout.
    for (const width of [860, 375]) {
      await setViewport(page, width, 800);
      await expect(crossing).toBeVisible();
      expect(await top(crossing), `${width}px: after the charts`).toBeGreaterThanOrEqual((await chartBottom()) - 0.5);
      expect(await top(crossing), `${width}px: above the readout`).toBeLessThan(await top(scope.locator('.replay-readout')));
    }
    // Past the phone breakpoint it is back after the status line.
    await setViewport(page, 861, 900);
    expect(await top(crossing)).toBeLessThan(await top(stake(scope)));
    await context.close();
  });
});
