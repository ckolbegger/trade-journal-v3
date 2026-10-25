// UI alignment measurements (plan D02-ui-alignment section 3): browser measurements against dist-faults.
import type { Page } from '@playwright/test';
import {
  BASE_URL,
  backToTrade,
  checkForUpdate,
  confirmD1Plan,
  confirmReference,
  expect,
  expectAccessible,
  firstPage,
  onboardedD1Page,
  onboardedPage,
  PC1,
  PLAN,
  READY,
  recordEntry,
  reloadFromNotice,
  SECOND_PLAN,
  startJournal,
  test,
} from './support.ts';

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

test.describe('T2.37-B1 durability banner before the shell renders', () => {
  for (const stage of ['first run', 'account onboarding'] as const) {
    test(`should keep the storage banner compact with the warning ground on ${stage} at 390`, async ({ server, profile }) => {
      void server;
      const context = await profile.launch();
      const page = await firstPage(context);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(BASE_URL);
      if (stage === 'account onboarding') await startJournal(page);
      const banner = page.getByRole('region', { name: 'Storage protection' });
      await expect(banner).toBeVisible();
      const measured = await banner.evaluate((el) => {
        const probe = document.createElement('span');
        probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--warning-ground').trim();
        document.body.append(probe);
        const ground = getComputedStyle(probe).color;
        probe.remove();
        return { background: getComputedStyle(el).backgroundColor, ground, height: el.getBoundingClientRect().height };
      });
      expect(measured.background).toBe(measured.ground);
      expect(measured.height, `banner height on ${stage}`).toBeLessThanOrEqual(120);
      await context.close();
    });
  }
});

// ---- T2.38 one content column and side gutters (absorbs F8) ----------------------------------

const GUTTER = 16;
// Trades has no .card when it lists rows; its table region is the top-level block there.
const CARDS = '.card, .first-run, .onboarding, .gate, .table-scroll';

// Every top-level card keeps a 16 px side gutter and the page does not scroll sideways.
async function expectGutters(page: Page, view: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth), { message: `${view} at ${width} page width` })
    .toBeLessThanOrEqual(width);
  const cards = await page.evaluate((selector) => {
    return [...document.querySelectorAll(selector)].map((el) => {
      const box = el.getBoundingClientRect();
      return { name: el.getAttribute('aria-label') ?? el.querySelector('h1, h2')?.textContent ?? el.className, left: box.left, right: box.right };
    });
  }, CARDS);
  expect(cards.length, `${view} has a card at ${width}`).toBeGreaterThan(0);
  for (const card of cards) {
    expect(card.left, `${view} "${card.name}" left at ${width}`).toBeGreaterThanOrEqual(GUTTER);
    expect(card.right, `${view} "${card.name}" right at ${width}`).toBeLessThanOrEqual(width - GUTTER);
  }
}

test.describe('T2.38 one content column and side gutters', () => {
  test('should keep the banner, heading, tabs and first card on one left edge on Trades and Open Detail at 1280', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmReference(page);
    await recordEntry(page, PC1);
    await backToTrade(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveAttribute('data-placement', 'sidebar');
    const lefts = (): Promise<Record<string, number>> =>
      page.evaluate(() => {
        const left = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().left;
        const found: Record<string, number | undefined> = {
          banner: left('.banner'),
          h1: left('main h1'),
          tablist: left('[role="tablist"]'),
          card: left('main .card, main .table-scroll'),
        };
        return Object.fromEntries(Object.entries(found).filter(([, x]) => x !== undefined)) as Record<string, number>;
      });
    const detail = await lefts();
    expect(Object.keys(detail).sort(), 'Open Detail elements').toEqual(['banner', 'card', 'h1']);
    for (const [name, x] of Object.entries(detail)) expect.soft(Math.abs(x - detail['banner']!), `Detail ${name} left ${JSON.stringify(detail)}`).toBeLessThanOrEqual(1);
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    await expect(page.getByRole('table', { name: 'Open Trades' })).toBeVisible(READY);
    const trades = await lefts();
    expect(Object.keys(trades), 'Trades elements').toEqual(expect.arrayContaining(['banner', 'h1', 'tablist', 'card']));
    for (const [name, x] of Object.entries(trades)) expect.soft(Math.abs(x - trades['banner']!), `Trades ${name} left ${JSON.stringify(trades)}`).toBeLessThanOrEqual(1);
    await context.close();
  });

  for (const width of WIDTHS) {
    test(`should keep a 16 px gutter on first run and onboarding at ${width}`, async ({ server, profile }) => {
      void server;
      const context = await profile.launch();
      const page = await firstPage(context);
      await page.goto(BASE_URL);
      await expect(page.getByRole('heading', { name: 'Start your journal' })).toBeVisible(READY);
      await expectGutters(page, 'first run', width);
      await startJournal(page);
      await expect(page.getByRole('heading', { name: 'Add your brokerage account' })).toBeVisible(READY);
      await expectGutters(page, 'onboarding', width);
      await context.close();
    });

    test(`should keep a 16 px gutter on Trades and Open Detail at ${width}`, async ({ server, profile }) => {
      void server;
      const context = await profile.launch();
      const page = await onboardedPage(context);
      await confirmReference(page);
      await recordEntry(page, PC1);
      await backToTrade(page);
      await expectGutters(page, 'Open Detail', width);
      await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
      await expect(page.getByRole('table', { name: 'Open Trades' })).toBeVisible(READY);
      await expectGutters(page, 'Trades', width);
      await context.close();
    });
  }

  test('should keep a 16 px gutter on Migration Blocked at 390 and 320', async ({ server, profile }) => {
    server.use('dist-releases/d1');
    const context = await profile.launch();
    const page = await onboardedD1Page(context);
    await confirmD1Plan(page, PLAN);
    await confirmD1Plan(page, SECOND_PLAN);
    // The D1 release ignores the parameter; the update's Reload keeps it, so the faults build launches with it.
    await page.goto('/?faults=migration:validate');
    await expect(page.getByRole('row', { name: /ABC/ })).toBeVisible(READY);
    server.use('dist-faults');
    expect(await checkForUpdate(page)).toEqual({ waiting: 'installed' });
    await reloadFromNotice(page);
    await expect(page.getByRole('heading', { name: 'Your journal could not be converted to this release' })).toBeVisible(READY);
    for (const width of WIDTHS) await expectGutters(page, 'Migration Blocked', width);
    await context.close();
  });
});
