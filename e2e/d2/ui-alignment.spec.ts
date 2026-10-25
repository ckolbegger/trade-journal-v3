// UI alignment measurements (plan D02-ui-alignment section 3): browser measurements against dist-faults.
import { expect, expectAccessible, onboardedPage, test } from './support.ts';

const WIDTHS = [390, 320] as const;

test.describe('T2.36-B1 bottom navigation fit', () => {
  test('should keep every bottom bar link inside the viewport with no horizontal overflow in the bar', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await nav.getByRole('link', { name: 'Trades' }).click();
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 844 });
      await expect(nav).toHaveAttribute('data-placement', 'bottom');
      const bar = await nav.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        links: [...el.querySelectorAll('a')].map((a) => {
          const box = a.getBoundingClientRect();
          return { name: a.textContent ?? '', left: box.left, right: box.right };
        }),
      }));
      expect(bar.links.length, `links at ${width}`).toBe(4);
      for (const link of bar.links) {
        expect(link.left, `${link.name} left at ${width}`).toBeGreaterThanOrEqual(0);
        expect(link.right, `${link.name} right at ${width}`).toBeLessThanOrEqual(width);
      }
      expect(bar.scrollWidth, `bar overflow at ${width}`).toBeLessThanOrEqual(bar.clientWidth);
    }
    await context.close();
  });
});

const rgb = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};

test.describe('T2.37 navigation and durability banner', () => {
  test('should fill the current sidebar link with ink and white text', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await page.setViewportSize({ width: 1280, height: 900 });
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await nav.getByRole('link', { name: 'Trades' }).click();
    const colours = await nav.locator('a[aria-current="page"]').evaluate((el) => {
      const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
      const probe = document.createElement('span');
      probe.style.color = ink;
      document.body.append(probe);
      const inkRgb = getComputedStyle(probe).color;
      probe.remove();
      const style = getComputedStyle(el);
      return { background: style.backgroundColor, color: style.color, inkRgb };
    });
    expect(colours.background).toBe(colours.inkRgb);
    expect(colours.color).toBe(rgb('#ffffff'));
    await context.close();
  });

  test('should stack each bottom bar icon above its label', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await page.setViewportSize({ width: 390, height: 844 });
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await nav.getByRole('link', { name: 'Trades' }).click();
    const boxes = await nav.evaluate((el) =>
      [...el.querySelectorAll('a')].map((a) => {
        const icon = a.querySelector('svg')!.getBoundingClientRect();
        const range = document.createRange();
        const text = [...a.childNodes].find((n) => n.nodeType === Node.TEXT_NODE)!;
        range.selectNodeContents(text);
        const label = range.getBoundingClientRect();
        return { name: a.textContent ?? '', iconBottom: icon.bottom, labelTop: label.top };
      }),
    );
    expect(boxes.length).toBe(4);
    for (const box of boxes) expect(box.iconBottom, box.name).toBeLessThanOrEqual(box.labelTop + 0.5);
    await context.close();
  });

  for (const [width, height] of [[390, 844], [1280, 900]] as const) {
    test(`should style the durability banner with the warning ground and keep it compact at ${width}`, async ({ server, profile }) => {
      void server;
      const context = await profile.launch();
      const page = await onboardedPage(context);
      await page.setViewportSize({ width, height });
      await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
      const banner = page.getByRole('region', { name: 'Storage protection' });
      await expect(banner).toBeVisible();
      const measured = await banner.evaluate((el) => {
        const probe = document.createElement('span');
        probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--warning-ground').trim();
        document.body.append(probe);
        const ground = getComputedStyle(probe).color;
        probe.remove();
        const box = el.getBoundingClientRect();
        const texts = [...el.querySelectorAll('p')].map((p) => p.getBoundingClientRect());
        const button = el.querySelector('button')?.getBoundingClientRect();
        return {
          background: getComputedStyle(el).backgroundColor,
          ground,
          height: box.height,
          textTop: Math.min(...texts.map((t) => t.top)),
          textBottom: Math.max(...texts.map((t) => t.bottom)),
          buttonCentre: button ? (button.top + button.bottom) / 2 : null,
        };
      });
      expect(measured.background).toBe(measured.ground);
      if (width === 390) expect(measured.height).toBeLessThanOrEqual(120);
      if (width === 1280 && measured.buttonCentre !== null) {
        expect(measured.buttonCentre).toBeGreaterThanOrEqual(measured.textTop);
        expect(measured.buttonCentre).toBeLessThanOrEqual(measured.textBottom);
      }
      await expectAccessible(page, `Trades at ${width}`);
      await context.close();
    });
  }
});
