// The cockpit shell's layout (D08P T8P.5-B2, ocr findings 3 and 4): the rail beside the drawers at a wide viewport, the banner across both,
// and one column at a narrow viewport. Measured as bounding boxes against dist-faults.
import {
  confirmReference,
  detail,
  expect,
  firstPage,
  onboardedPage,
  openPlanned,
  PC1,
  READY,
  recordEntry,
  test,
  writeIntegrityFixture,
} from './support.ts';

test.describe('T8P.5-B2 cockpit layout', () => {
  test('should place the rail beside the drawers at a wide viewport, with the banner across both, and stack them at a narrow one', async ({ server, profile }) => {
    void server;
    const setup = await profile.launch();
    const first = await onboardedPage(setup);
    await confirmReference(first);
    await recordEntry(first, PC1);
    await setup.close();
    // An Open Trade stored as Planned shows the Records disagree banner above the rail, so the banner's span can be measured.
    await writeIntegrityFixture(profile.dir, { kind: 'StoredLifecycle', underlying: 'XYZ', lifecycle: 'Planned' });

    const context = await profile.launch({ width: 1280 });
    const page = await firstPage(context);
    await page.goto('/');
    await expect(page.getByRole('tablist', { name: 'Trades by lifecycle' })).toBeVisible(READY);
    await openPlanned(page);
    await page.getByRole('row', { name: /XYZ/ }).getByRole('link', { name: 'XYZ', exact: true }).click();
    await expect(detail.heading(page, 'XYZ')).toBeVisible();

    const banner = detail.recordsDisagree(page);
    const rail = page.getByRole('region', { name: 'State of play' });
    const drawers = page.locator('.cockpit-drawers');
    await expect(banner).toBeVisible();
    const boxes = async () => {
      const [b, r, d] = await Promise.all([banner.boundingBox(), rail.boundingBox(), drawers.boundingBox()]);
      return { banner: b!, rail: r!, drawers: d! };
    };

    // Wide: the rail's column is left of the drawers', both start at the same height below the banner, which spans both.
    await expect(page.locator('.shell')).toHaveAttribute('data-layout', 'wide');
    const wide = await boxes();
    expect(wide.rail.x + wide.rail.width, 'rail right edge, wide').toBeLessThanOrEqual(wide.drawers.x);
    expect(wide.rail.width, 'rail width, wide').toBeCloseTo(320, 0);
    expect(wide.drawers.y, 'drawers top, wide').toBeCloseTo(wide.rail.y, 0);
    expect(wide.banner.y + wide.banner.height, 'banner bottom, wide').toBeLessThanOrEqual(wide.rail.y);
    expect(wide.banner.x, 'banner left, wide').toBeLessThanOrEqual(wide.rail.x);
    expect(wide.banner.x + wide.banner.width, 'banner right, wide').toBeGreaterThanOrEqual(wide.drawers.x + wide.drawers.width - 1);

    // Narrow: one column, the banner, then the rail, then the drawers, all on one left edge.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.shell')).toHaveAttribute('data-layout', 'narrow');
    const narrow = await boxes();
    expect(narrow.rail.x, 'rail left, narrow').toBeCloseTo(narrow.drawers.x, 0);
    expect(narrow.banner.x, 'banner left, narrow').toBeCloseTo(narrow.rail.x, 0);
    expect(narrow.drawers.y, 'drawers top, narrow').toBeGreaterThanOrEqual(narrow.rail.y + narrow.rail.height);
    expect(narrow.rail.y, 'rail top, narrow').toBeGreaterThanOrEqual(narrow.banner.y + narrow.banner.height);
    await context.close();
  });
});
