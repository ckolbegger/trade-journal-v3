// UI alignment measurements (plan D02-ui-alignment section 3): browser measurements against dist-faults.
import { expect, onboardedPage, test } from './support.ts';

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
