// UI alignment measurements (plan D02-ui-alignment section 3): browser measurements against dist-faults.
import type { Locator, Page } from '@playwright/test';
import {
  BASE_URL,
  backToTrade,
  checkForUpdate,
  confirmD1Plan,
  confirmReference,
  expect,
  completeReflection,
  expectAccessible,
  fillRows,
  fillPlan,
  firstPage,
  onboardedD1Page,
  onboardedPage,
  openEntryForm,
  openPlanned,
  PC1,
  PC2,
  PLAN,
  READY,
  reflectionSection,
  recordEntry,
  reloadFromNotice,
  SECOND_PLAN,
  startJournal,
  tabTo,
  test,
  writeIntegrityFixture,
} from './support.ts';

// AppShell switches its data-layout at WIDE_LAYOUT_MIN_WIDTH (src/ui/AppShell.tsx); importing that
// module would pull React into the e2e runner, so the value is repeated here.
const WIDE_LAYOUT_MIN_WIDTH = 960;

// The shell sets data-layout after the viewport change; measuring before it switches gives the old layout.
async function expectLayout(page: Page, width: number): Promise<void> {
  await expect(page.locator('.shell')).toHaveAttribute('data-layout', width >= WIDE_LAYOUT_MIN_WIDTH ? 'wide' : 'narrow');
}

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

test.describe('T2.37 navigation styling', () => {
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
});

// T2.60 (decision U8) replaced the T2.37 banner measurements (warning ground, compact height, button
// centred on the text): the full card is on About only, and every other screen shows the icon.
test.describe('T2.60 storage warning icon', () => {
  const NAME = 'Storage not protected: see About';
  for (const [width, height] of [[320, 700], [390, 844], [1280, 900]] as const) {
    test(`should show a focusable warning icon linking to About and no storage card outside About at ${width}`, async ({ server, profile }) => {
      void server;
      const context = await profile.launch();
      const page = await onboardedPage(context);
      await page.setViewportSize({ width, height });
      await expectLayout(page, width);
      await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
      const icon = page.getByRole('link', { name: NAME });
      await expect(icon).toBeVisible();
      await expect(icon).toHaveAttribute('href', '/about');
      await expect(page.getByRole('region', { name: 'Storage protection' })).toHaveCount(0);
      await expect(page.getByText('This browser may clear your journal data')).toHaveCount(0);
      const box = await icon.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { right: r.right, top: r.top, width: r.width, height: r.height };
      });
      expect(box.right, 'right edge inside the viewport').toBeLessThanOrEqual(width);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      await expectAccessible(page, `Trades with the storage icon at ${width}`);

      await tabTo(page, icon);
      const outline = await icon.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return { style: style.outlineStyle, width: parseFloat(style.outlineWidth), offset: parseFloat(style.outlineOffset), top: r.top, right: window.innerWidth - r.right };
      });
      expect(outline.style).not.toBe('none');
      const reach = outline.width + outline.offset;
      expect(outline.top, 'outline room above').toBeGreaterThanOrEqual(reach);
      expect(outline.right, 'outline room at the right').toBeGreaterThanOrEqual(reach);
      await expectAccessible(page, `Trades with the focused storage icon at ${width}`);

      await icon.click();
      await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
      const card = page.getByRole('region', { name: 'Storage protection' });
      await expect(card).toBeVisible();
      await expect(card.getByText('Back up your journal')).toHaveCount(0);
      await expectAccessible(page, `About with the storage card at ${width}`);
      await context.close();
    });
  }
});

// T2.60-B4: the icon sits on the page title's row at its far right, instead of a row of its own.
// The T2.60 case above measured the icon alone (size, focus room, link); it had no measurement of its
// row, so none is replaced. Its checks stay valid on the title row: the icon overhangs the title row
// upward by a few pixels, which still leaves the outline room above it.
test.describe('T2.60-B4 storage icon on the page title row', () => {
  const NAME = 'Storage not protected: see About';
  type Title = { name: string; iconCentre: number; iconRight: number; iconLeft: number; iconWidth: number; iconHeight: number; h1Top: number; h1PageTop: number; h1Bottom: number; textRight: number; columnRight: number };

  const measureTitle = (page: Page, name: string): Promise<Title> =>
    page.evaluate((viewName) => {
      const h1 = document.querySelector('main h1')!;
      const icon = document.querySelector('a[aria-label="Storage not protected: see About"]')!.getBoundingClientRect();
      const box = h1.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(h1);
      const main = document.querySelector('main')!;
      const columnRight = main.getBoundingClientRect().right - parseFloat(getComputedStyle(main).paddingRight);
      return {
        name: viewName,
        iconCentre: icon.top + icon.height / 2,
        iconRight: icon.right,
        iconLeft: icon.left,
        iconWidth: icon.width,
        iconHeight: icon.height,
        h1Top: box.top,
        h1Bottom: box.bottom,
        h1PageTop: box.top + window.scrollY,
        textRight: range.getBoundingClientRect().right,
        columnRight,
      };
    }, name);

  const h1Top = (page: Page): Promise<number> => page.evaluate(() => document.querySelector('main h1')!.getBoundingClientRect().top + window.scrollY);

  for (const [width, height] of [[320, 700], [390, 844], [1280, 900]] as const) {
    test(`should put the storage icon at the far right of the title row on Trades, a Detail, New Plan and About at ${width}`, async ({ server, profile }) => {
      void server;
      const context = await profile.launch();
      const page = await onboardedPage(context);
      await page.setViewportSize({ width, height });
      await expectLayout(page, width);
      const nav = page.getByRole('navigation', { name: 'Primary' });
      const go = async (link: string, heading: string): Promise<void> => {
        await nav.getByRole('link', { name: link }).click();
        await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
      };
      const views: [string, () => Promise<void>][] = [
        ['Trades', () => go('Trades', 'Trades')],
        ['Detail', async () => {
          await go('New Plan', 'New Plan');
          await fillPlan(page, PLAN);
          await page.getByRole('button', { name: 'Confirm Plan' }).click();
          await expect(page.getByRole('heading', { name: PLAN.symbol, level: 1 })).toBeVisible();
        }],
        ['New Plan', () => go('New Plan', 'New Plan')],
        ['About', () => go('About', 'About')],
      ];
      const shown: Record<string, number> = {};
      for (const [view, open] of views) {
        await open();
        const icon = page.getByRole('link', { name: NAME });
        await expect(icon).toBeVisible();
        const m = await measureTitle(page, view);
        expect(m.iconCentre, `${view} icon centre below h1 top at ${width}`).toBeGreaterThanOrEqual(m.h1Top);
        expect(m.iconCentre, `${view} icon centre above h1 bottom at ${width}`).toBeLessThanOrEqual(m.h1Bottom);
        expect(Math.abs(m.iconRight - m.columnRight), `${view} icon right edge vs column at ${width}`).toBeLessThanOrEqual(1);
        expect(m.textRight, `${view} h1 text clear of the icon at ${width}`).toBeLessThanOrEqual(m.iconLeft);
        expect(m.iconWidth, `${view} icon width`).toBeGreaterThanOrEqual(44);
        expect(m.iconHeight, `${view} icon height`).toBeGreaterThanOrEqual(44);
        shown[view] = m.h1PageTop;
        // Reset the keyboard starting point: the nav link just clicked would otherwise start the Tab walk after the content.
        await page.evaluate(() => {
          window.scrollTo(0, 0);
          document.body.tabIndex = -1;
          document.body.focus();
          document.body.removeAttribute('tabindex');
        });
        await tabTo(page, icon);
        const reach = await icon.evaluate((el) => {
          const style = getComputedStyle(el);
          return { style: style.outlineStyle, reach: parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset), right: window.innerWidth - el.getBoundingClientRect().right };
        });
        expect(reach.style).not.toBe('none');
        expect(reach.right, `${view} outline room at the right at ${width}`).toBeGreaterThanOrEqual(reach.reach);
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth), { message: `${view} page width at ${width}` })
          .toBeLessThanOrEqual(width);
        await expectAccessible(page, `${view} with the title-row storage icon at ${width}`);
        if (view === 'Detail' && width === 320) {
          // A long Detail title wraps inside its own column and never runs under the icon.
          await page.evaluate(() => {
            document.querySelector('main h1')!.textContent = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          });
          const long = await measureTitle(page, 'long');
          expect(long.textRight, 'long title clear of the icon').toBeLessThanOrEqual(long.iconLeft);
          expect(await page.evaluate(() => document.documentElement.scrollWidth), 'long title page width').toBeLessThanOrEqual(width);
        }
      }

      // Protected: no icon, and no row is reserved, so every title keeps the same top.
      await page.addInitScript(() => {
        Object.defineProperty(navigator.storage, 'persisted', { value: () => Promise.resolve(true) });
      });
      await page.reload();
      await expect(page.locator('.shell')).toBeVisible(READY);
      await expectLayout(page, width);
      for (const [view, open] of views) {
        if (view === 'Detail') {
          await go('Trades', 'Trades');
          await openPlanned(page);
          await page.getByRole('link', { name: new RegExp(PLAN.symbol) }).first().click();
          await expect(page.getByRole('heading', { name: PLAN.symbol, level: 1 })).toBeVisible();
        } else await open();
        await expect(page.getByRole('link', { name: NAME })).toHaveCount(0);
        expect(Math.abs((await h1Top(page)) - shown[view]!), `${view} h1 top with and without the icon at ${width}`).toBeLessThanOrEqual(1);
      }
      await context.close();
    });
  }
});

// The first-run and onboarding screens have no About to link to (no routes before a Workspace
// exists), so they keep the full card; T2.60 leaves these measurements as they were.
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

// T2.60: the shell banner is gone outside About, so the heading is now the reference edge.
test.describe('T2.38 one content column and side gutters', () => {
  test('should keep the heading, tabs and first card on one left edge on Trades and Open Detail at 1280', async ({ server, profile }) => {
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
          h1: left('main h1'),
          tablist: left('[role="tablist"]'),
          card: left('main .card, main .table-scroll'),
        };
        return Object.fromEntries(Object.entries(found).filter(([, x]) => x !== undefined)) as Record<string, number>;
      });
    const detail = await lefts();
    expect(Object.keys(detail).sort(), 'Open Detail elements').toEqual(['card', 'h1']);
    for (const [name, x] of Object.entries(detail)) expect.soft(Math.abs(x - detail['h1']!), `Detail ${name} left ${JSON.stringify(detail)}`).toBeLessThanOrEqual(1);
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    await expect(page.getByRole('table', { name: 'Open Trades' })).toBeVisible(READY);
    const trades = await lefts();
    expect(Object.keys(trades), 'Trades elements').toEqual(expect.arrayContaining(['h1', 'tablist', 'card']));
    for (const [name, x] of Object.entries(trades)) expect.soft(Math.abs(x - trades['h1']!), `Trades ${name} left ${JSON.stringify(trades)}`).toBeLessThanOrEqual(1);
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

// ---- T2.40 Trades tables: Underlying and Trade columns, pinned Underlying, scroll shadows (U1, I1; F9) ----

// The columns whose figures the Trade cell's second line carries; they are hidden on narrow.
const MOVED = { Open: ['Net cost'], Planned: ['1R', 'Reward : risk'] } as const;
const OUTLINE = 5; // the 3 px focus outline plus its 2 px offset
const TABS = ['Open', 'Planned'] as const;

// Two Open Trades and two Planned Trades, ending on the Trades view.
async function seedTrades(page: Page): Promise<void> {
  const plan = (symbol: string): typeof PLAN => ({ ...PLAN, symbol });
  await confirmReference(page, plan('XYZ'));
  await recordEntry(page, PC1);
  await confirmReference(page, plan('ABC'));
  await recordEntry(page, PC1);
  await confirmReference(page, plan('DEF'));
  await confirmReference(page, plan('GHI'));
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
  await expect(page.getByRole('table', { name: 'Open Trades' })).toBeVisible(READY);
}

interface Measured {
  readonly viewport: number;
  readonly region: { readonly left: number; readonly right: number };
  readonly scrollLeft: number;
  readonly scrollMax: number;
  readonly headers: readonly { readonly name: string; readonly display: string }[];
  readonly rows: readonly {
    readonly lefts: readonly number[];
    readonly pinned: { readonly left: number; readonly right: number };
    readonly trade: { readonly left: number; readonly right: number };
    readonly line: { readonly display: string; readonly right: number } | undefined;
    readonly badgeRight: number | undefined;
    readonly cellDisplays: readonly string[];
  }[];
}

const measure = (page: Page, tab: (typeof TABS)[number]): Promise<Measured> =>
  page.getByRole('region', { name: `${tab} Trades` }).evaluate((region) => {
    const box = region.getBoundingClientRect();
    return {
      viewport: window.innerWidth,
      region: { left: box.left, right: box.right },
      scrollLeft: region.scrollLeft,
      scrollMax: region.scrollWidth - region.clientWidth,
      headers: [...region.querySelectorAll('th')].map((th) => ({ name: th.textContent ?? '', display: getComputedStyle(th).display })),
      rows: [...region.querySelectorAll('tbody tr')].map((row) => {
        const cells = [...row.querySelectorAll('td')];
        const line = row.querySelector('.trade-line');
        const badge = row.querySelector('.badge');
        const rect = (el: Element) => el.getBoundingClientRect();
        return {
          lefts: cells.map((td) => rect(td).left),
          pinned: { left: rect(cells[0]!).left, right: rect(cells[0]!).right },
          trade: { left: rect(cells[1]!).left, right: rect(cells[1]!).right },
          line: line ? { display: getComputedStyle(line).display, right: rect(line).right } : undefined,
          badgeRight: badge ? rect(badge).right : undefined,
          cellDisplays: cells.map((td) => getComputedStyle(td).display),
        };
      }),
    };
  });

// How often a figure appears in the accessibility tree of a row: hidden cells are not in it.
async function occurrences(row: Locator, figure: string): Promise<number> {
  // The row's own line carries a name made of its cells' text, so only the lines beneath it count.
  const tree = (await row.ariaSnapshot()).split('\n').slice(1).join('\n');
  const escaped = figure.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return tree.match(new RegExp(`(?<![\\d.,])${escaped}(?![\\d])`, 'g'))?.length ?? 0;
}

// The figures in a row's second line: "Net cost $3,007.00" or "1R $250.00 · Reward : risk 2.4".
async function lineFigures(row: Locator): Promise<string[]> {
  const text = (await row.locator('.trade-line').first().textContent()) ?? '';
  return [...text.matchAll(/\$[\d,]+\.\d\d|(?<=risk )[\d.]+/g)].map((m) => m[0]);
}

async function expectTradesTables(page: Page, width: number): Promise<void> {
  const narrow = width < 960;
  for (const tab of TABS) {
    if (tab === 'Planned') await openPlanned(page);
    await expect(page.getByRole('table', { name: `${tab} Trades` })).toBeVisible(READY);
    const where = `${tab} at ${width}`;
    const unscrolled = await measure(page, tab);
    expect(unscrolled.rows.length, `${where} rows`).toBeGreaterThanOrEqual(2);
    // Hidden columns: header and cells are display none on narrow, shown on wide; the second line is the reverse.
    for (const name of MOVED[tab]) expect(unscrolled.headers.find((h) => h.name === name)?.display, `${where} header ${name}`).toBe(narrow ? 'none' : 'table-cell');
    for (const row of unscrolled.rows) {
      if (narrow) expect(row.cellDisplays.filter((d) => d === 'none').length, `${where} hidden cells`).toBe(MOVED[tab].length);
      else expect(row.cellDisplays.every((d) => d !== 'none'), `${where} cells shown`).toBe(true);
      expect(row.line?.display, `${where} second line`).toBe(narrow ? 'block' : 'none');
    }
    if (narrow) {
      // Underlying and Trade, with the second line and any badge, lie fully inside the viewport before scrolling.
      for (const row of unscrolled.rows) {
        expect(row.pinned.left, `${where} Underlying left`).toBeGreaterThanOrEqual(0);
        expect(row.trade.right, `${where} Trade right`).toBeLessThanOrEqual(unscrolled.viewport);
        expect(row.line!.right, `${where} second line right`).toBeLessThanOrEqual(unscrolled.viewport);
        if (row.badgeRight !== undefined) expect(row.badgeRight, `${where} badge right`).toBeLessThanOrEqual(unscrolled.viewport);
      }
      expect(unscrolled.scrollMax, `${where} scrolls`).toBeGreaterThan(0);
      // Pinned: after scrolling fully right, Underlying keeps its left edge and the other cells move.
      await page.getByRole('region', { name: `${tab} Trades` }).evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });
      const scrolled = await measure(page, tab);
      expect(scrolled.scrollLeft, `${where} scrolled`).toBeGreaterThan(0);
      scrolled.rows.forEach((row, i) => {
        const before = unscrolled.rows[i]!;
        expect(row.pinned.left, `${where} Underlying left after scrolling`).toBeCloseTo(before.pinned.left, 0);
        expect(row.lefts[row.lefts.length - 1]!, `${where} last cell moved`).toBeLessThan(before.lefts[before.lefts.length - 1]! - 1);
      });
      await page.getByRole('region', { name: `${tab} Trades` }).evaluate((el) => {
        el.scrollLeft = 0;
      });
      // Its own background and hairline, so scrolled cells pass beneath it; shadows on the scroll region.
      const pin = await page.getByRole('region', { name: `${tab} Trades` }).evaluate((region) => {
        const cell = region.querySelector('tbody td')!;
        const style = getComputedStyle(cell);
        return { position: style.position, background: style.backgroundColor, border: style.borderRightWidth, shadows: getComputedStyle(region).backgroundImage };
      });
      expect(pin.position, `${where} pinned`).toBe('sticky');
      expect(pin.background, `${where} pinned background`).not.toBe('rgba(0, 0, 0, 0)');
      expect(pin.border, `${where} pinned hairline`).toBe('1px');
      expect(pin.shadows, `${where} scroll shadows`).toContain('radial-gradient');
    }
    // Each figure appears exactly once in the accessibility tree.
    const row = page.getByRole('region', { name: `${tab} Trades` }).locator('tbody tr').first();
    const figures = await lineFigures(row);
    expect(figures.length, `${where} figures`).toBe(tab === 'Open' ? 1 : 2);
    for (const figure of figures) expect(await occurrences(row, figure), `${where} "${figure}" in the accessibility tree`).toBe(1);
    // A focused Underlying link shows its full outline.
    const link = page.getByRole('region', { name: `${tab} Trades` }).locator('tbody tr td:first-child a').first();
    await tabTo(page, link);
    const outline = await link.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const region = el.closest('.table-scroll')!.getBoundingClientRect();
      return { style: getComputedStyle(el).outlineStyle, left: r.left - region.left, top: r.top - region.top, bottom: region.bottom - r.bottom };
    });
    expect(outline.style, `${where} outline`).not.toBe('none');
    for (const side of ['left', 'top', 'bottom'] as const) expect(outline[side], `${where} outline room ${side}`).toBeGreaterThanOrEqual(OUTLINE);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${where} page width`).toBeLessThanOrEqual(width);
    await expectAccessible(page, `${where} Trades`);
  }
}

test.describe('T2.40 Trades tables', () => {
  for (const width of [390, 320, 1280]) {
    test(`should pin Underlying, keep Underlying and Trade in view and show each figure once in both tables at ${width}`, async ({ server, profile }) => {
      void server;
      const context = await profile.launch();
      const page = await onboardedPage(context);
      await seedTrades(page);
      await page.setViewportSize({ width, height: width === 1280 ? 900 : 844 });
      await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveAttribute('data-placement', width === 1280 ? 'sidebar' : 'bottom');
      await expectTradesTables(page, width);
      await context.close();
    });
  }

  for (const width of [390, 320]) {
    test(`should keep a Records disagree badge inside the viewport with the Trade cell at ${width}`, async ({ server, profile }) => {
      void server;
      const setup = await profile.launch();
      const page = await onboardedPage(setup);
      await confirmReference(page, { ...PLAN, symbol: 'ABC' });
      await recordEntry(page, PC1);
      await confirmReference(page, { ...PLAN, symbol: 'XYZ' });
      await recordEntry(page, PC1);
      await setup.close();
      // ABC is filed under Planned with its facts intact (findings); XYZ is filed under Planned and cannot be replayed.
      await writeIntegrityFixture(profile.dir, { kind: 'StoredLifecycle', underlying: 'ABC', lifecycle: 'Planned' });
      await writeIntegrityFixture(profile.dir, { kind: 'StoredLifecycle', underlying: 'XYZ', lifecycle: 'Planned' });
      await writeIntegrityFixture(profile.dir, { kind: 'UnknownPlannedLeg', underlying: 'XYZ' });
      const context = await profile.launch();
      const app = await firstPage(context);
      await app.setViewportSize({ width, height: 844 });
      await app.goto('/?lifecycle=Planned');
      await expect(app.getByRole('table', { name: 'Planned Trades' })).toBeVisible(READY);
      const measured = await measure(app, 'Planned');
      expect(measured.rows.filter((r) => r.badgeRight !== undefined).length, `badges at ${width}`).toBe(2);
      for (const row of measured.rows) {
        expect(row.trade.right, `Trade right at ${width}`).toBeLessThanOrEqual(width);
        expect(row.badgeRight!, `badge right at ${width}`).toBeLessThanOrEqual(width);
      }
      await expectAccessible(app, `Planned badges at ${width}`);
      await context.close();
    });
  }
});

test.describe('T2.41 wide Trades table styling', () => {
  test('should show one-line uppercase headers, a bold symbol link and right-aligned tabular figures at 1280', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await seedTrades(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const tab of TABS) {
      if (tab === 'Planned') await openPlanned(page);
      await expect(page.getByRole('table', { name: `${tab} Trades` })).toBeVisible(READY);
      const styled = await page.getByRole('region', { name: `${tab} Trades` }).evaluate((region) => {
        const lineHeight = (el: Element) => {
          const s = getComputedStyle(el);
          return Number.isNaN(parseFloat(s.lineHeight)) ? 1.2 * parseFloat(s.fontSize) : parseFloat(s.lineHeight);
        };
        const headers = [...region.querySelectorAll('th')].map((th) => {
          const s = getComputedStyle(th);
          return {
            name: th.textContent ?? '',
            // Content height (without the cell padding and rule) over the line-height: one line is 1, a wrapped header 2 or more.
            ratio: (th.getBoundingClientRect().height - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom) - parseFloat(s.borderBottomWidth)) / lineHeight(th),
            upper: s.textTransform === 'uppercase' || s.fontVariantCaps === 'small-caps' || s.fontVariantCaps === 'all-small-caps',
            fontSize: s.fontSize,
          };
        });
        const link = getComputedStyle(region.querySelector('tbody td a')!);
        const figures = [...region.querySelectorAll('th.number, td.number')].map((c) => {
          const s = getComputedStyle(c);
          return { align: s.textAlign, numeric: s.fontVariantNumeric };
        });
        return { headers, weight: Number(link.fontWeight), figures };
      });
      for (const h of styled.headers) {
        expect(h.ratio, `${tab} header ${h.name} one line`).toBeLessThanOrEqual(1.6);
        expect(h.upper, `${tab} header ${h.name} uppercase or small-caps`).toBe(true);
        expect(h.fontSize, `${tab} header ${h.name} size`).toBe('12.8px');
      }
      expect(styled.weight, `${tab} symbol link weight`).toBeGreaterThanOrEqual(600);
      expect(styled.figures.length, `${tab} figure cells`).toBeGreaterThan(0);
      for (const f of styled.figures) {
        expect(f.align, `${tab} figure align`).toBe('right');
        expect(f.numeric, `${tab} figure numerals`).toContain('tabular-nums');
      }
    }
    await context.close();
  });

  test('should keep a Records disagree badge and dates on one line in a wide row', async ({ server, profile }) => {
    void server;
    const setup = await profile.launch();
    const page = await onboardedPage(setup);
    await confirmReference(page, { ...PLAN, symbol: 'ABC' });
    await recordEntry(page, PC1);
    await setup.close();
    await writeIntegrityFixture(profile.dir, { kind: 'StoredLifecycle', underlying: 'ABC', lifecycle: 'Planned' });
    const context = await profile.launch();
    const app = await firstPage(context);
    await app.setViewportSize({ width: 1280, height: 900 });
    await app.goto('/?lifecycle=Planned');
    await expect(app.getByRole('table', { name: 'Planned Trades' })).toBeVisible(READY);
    const badge = await app.getByRole('region', { name: 'Planned Trades' }).evaluate((region) => {
      const el = region.querySelector('.badge')!;
      const s = getComputedStyle(el);
      return { height: el.getBoundingClientRect().height, line: parseFloat(s.lineHeight) || 1.2 * parseFloat(s.fontSize), nowrap: s.whiteSpace };
    });
    expect(badge.height, 'badge one line').toBeLessThanOrEqual(badge.line * 1.6);
    expect(badge.nowrap, 'badge white-space').toBe('nowrap');
    await context.close();
  });
});

test.describe('T2.42 semantic badge tones', () => {
  test('should give every tone text that reaches 4.5:1 on its background and use neither the green nor the red tokens', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    const tones = await page.evaluate(() => {
      const parse = (css: string) => (css.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const root = getComputedStyle(document.documentElement);
      const probe = document.createElement('span');
      probe.style.color = root.getPropertyValue('--error');
      document.body.append(probe);
      const errorRgb = parse(getComputedStyle(probe).color);
      probe.remove();
      return ['neutral', 'info', 'warning'].map((tone) => {
        const el = document.createElement('span');
        el.className = 'badge';
        el.dataset.tone = tone;
        el.textContent = tone;
        document.body.append(el);
        const s = getComputedStyle(el);
        const out = { tone, text: parse(s.color), ground: parse(s.backgroundColor), border: parse(s.borderTopColor), errorRgb };
        el.remove();
        return out;
      });
    });
    const lum = (rgb: number[]) => {
      const [r, g, b] = rgb.map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      }) as [number, number, number];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: number[], b: number[]) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
      return (hi + 0.05) / (lo + 0.05);
    };
    const hue = (rgb: number[]) => {
      const [r, g, b] = rgb.map((v) => v / 255) as [number, number, number];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;
      if (d === 0 || d / (1 - Math.abs(max + min - 1)) < 0.3) return null;
      const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return h * 60;
    };
    for (const t of tones) {
      expect(ratio(t.text, t.ground), `${t.tone} contrast`).toBeGreaterThanOrEqual(4.5);
      for (const [part, rgb] of [['text', t.text], ['ground', t.ground], ['border', t.border]] as const) {
        expect(rgb, `${t.tone} ${part} is not the error red`).not.toEqual(t.errorRgb);
        const h = hue(rgb);
        const reserved = h !== null && (h <= 15 || h >= 345 || (h >= 75 && h <= 165));
        expect(reserved, `${t.tone} ${part} hue ${h} is neither red nor green`).toBe(false);
      }
    }
    expect(new Set(tones.map((t) => t.ground.join())).size, 'the three tones differ').toBeGreaterThan(1);
    await context.close();
  });
});

test.describe('T2.43 prompt chip groups', () => {
  const lum = (rgb: number[]) => {
    const [r, g, b] = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: number[], b: number[]) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
    return (hi + 0.05) / (lo + 0.05);
  };

  // Measures the first radio group of a form: fieldset rule, hidden radio, checked chip, focused chip.
  async function measureChips(page: Page, form: string) {
    const group = page.getByRole('radiogroup').first();
    const radio = group.locator('input[type="radio"]').first();
    await radio.check();
    const checked = await group.locator('label.chip').first().evaluate((label) => {
      const s = getComputedStyle(label);
      const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
      const probe = document.createElement('span');
      probe.style.color = ink;
      document.body.append(probe);
      const inkRgb = getComputedStyle(probe).color;
      probe.remove();
      return { background: s.backgroundColor, color: s.color, inkRgb };
    });
    expect(checked.background, `${form} checked chip background`).toBe(checked.inkRgb);
    expect(checked.color, `${form} checked chip text`).toBe('rgb(255, 255, 255)');
    const fieldset = await group.evaluate((el) => getComputedStyle(el).borderTopStyle);
    expect(fieldset, `${form} fieldset border-style`).toBe('none');
    const hidden = await radio.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return { width: box.width, height: box.height, clipPath: s.clipPath, position: s.position };
    });
    const clipped = (hidden.width <= 1 && hidden.height <= 1) || hidden.clipPath !== 'none';
    expect(clipped, `${form} radio clipped (${JSON.stringify(hidden)})`).toBe(true);
    await page.locator('h1').click();
    await tabTo(page, radio);
    const chip = group.locator('label.chip').first();
    const ring = await chip.evaluate((label) => {
      const parse = (css: string) => (css.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const s = getComputedStyle(label);
      let el: HTMLElement | null = label.parentElement;
      let ground = [255, 255, 255];
      while (el) {
        const bg = getComputedStyle(el).backgroundColor;
        if (!bg.startsWith('rgba(0, 0, 0, 0')) {
          ground = parse(bg);
          break;
        }
        el = el.parentElement;
      }
      return { width: parseFloat(s.outlineWidth), style: s.outlineStyle, colour: parse(s.outlineColor), ground };
    });
    expect(ring.style, `${form} chip outline style`).not.toBe('none');
    expect(ring.width, `${form} chip outline width`).toBeGreaterThanOrEqual(2);
    expect(ratio(ring.colour, ring.ground), `${form} chip outline contrast`).toBeGreaterThanOrEqual(3);
    await expectAccessible(page, `${form} chips`);
  }

  test('should render prompt chips as borderless groups with an ink checked chip and a visible focus ring on New Plan and Record entry', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'New Plan' }).click();
    await expect(page.getByRole('heading', { name: 'New Plan', level: 1 })).toBeVisible(READY);
    await measureChips(page, 'New Plan');
    await confirmReference(page);
    await openEntryForm(page);
    await measureChips(page, 'Record entry');
    await context.close();
  });
});

test.describe('T2.43-B1 prompt chips in forced colors', () => {
  test('should distinguish a checked chip from an unchecked chip and keep the focus ring in forced colors', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await page.emulateMedia({ forcedColors: 'active' });
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'New Plan' }).click();
    await expect(page.getByRole('heading', { name: 'New Plan', level: 1 })).toBeVisible(READY);
    const group = page.getByRole('radiogroup').first();
    const radio = group.locator('input[type="radio"]').first();
    await radio.check();
    await page.locator('h1').click();
    const look = (label: Element) => {
      const s = getComputedStyle(label);
      // A transparent chip shows the first opaque ancestor, so a Canvas-coloured checked chip looks the same.
      let el: Element | null = label;
      while (el && getComputedStyle(el).backgroundColor.endsWith(', 0)')) el = el.parentElement;
      const shown = el ? getComputedStyle(el).backgroundColor : 'none';
      return [shown, s.borderTopWidth, s.borderTopColor, s.outlineStyle, s.outlineWidth, s.outlineColor].join('|');
    };
    const checked = await group.locator('label.chip').first().evaluate(look);
    const unchecked = await group.locator('label.chip').nth(1).evaluate(look);
    expect(checked, 'checked and unchecked chips differ in forced colors').not.toBe(unchecked);
    await tabTo(page, radio);
    const ring = await group.locator('label.chip').first().evaluate((label) => {
      const s = getComputedStyle(label);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(ring.style, 'focus outline style in forced colors').not.toBe('none');
    expect(ring.width, 'focus outline width in forced colors').toBeGreaterThanOrEqual(2);
    await context.close();
  });
});

test.describe('T2.44 execution rows as panels', () => {
  test('should render each Execution as a rounded panel with Quantity, Price and Fee in a grid and Economic Time on its own row', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmReference(page);
    await openEntryForm(page);
    await page.getByRole('button', { name: 'Add Execution' }).click();
    const row = page.getByRole('group', { name: 'Execution 1', exact: true });
    const panel = await row.evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.borderTopStyle, radius: parseFloat(s.borderTopLeftRadius) };
    });
    expect(panel.style, 'fieldset border-style').not.toBe('groove');
    expect(panel.radius, 'fieldset border-radius').toBeGreaterThanOrEqual(10);
    // One synchronous read after a frame, so a scroll or reflow cannot land between the four boxes.
    const tops = () =>
      row.evaluate(
        (el) =>
          new Promise<{ quantity: number; price: number; fee: number; time: number }>((resolve) =>
            requestAnimationFrame(() => {
              const top = (label: string) =>
                [...el.querySelectorAll('label')].find((l) => l.firstChild?.textContent === label)?.querySelector('input')?.getBoundingClientRect().top ?? Number.NaN;
              resolve({ quantity: top('Quantity'), price: top('Price'), fee: top('Fee'), time: top('Economic Time') });
            }),
          ),
      );
    await page.setViewportSize({ width: 1280, height: 900 });
    const wide = await tops();
    expect(wide.price, 'Price top at 1280').toBe(wide.quantity);
    expect(wide.fee, 'Fee top at 1280').toBe(wide.quantity);
    expect(wide.time, 'Economic Time below at 1280').toBeGreaterThan(wide.quantity);
    await page.setViewportSize({ width: 390, height: 844 });
    const narrow = await tops();
    expect(narrow.price, 'Price top at 390').toBe(narrow.quantity);
    expect(narrow.time, 'Economic Time below at 390').toBeGreaterThan(narrow.price);
    expect(narrow.fee, 'Fee wraps below at 390').toBeGreaterThan(narrow.quantity);
    const remove = page.getByRole('button', { name: 'Remove Execution 2' });
    await expect(remove).toBeVisible();
    // Red and green are reserved for signed results and Stop/Target (ui-contract), so Remove is ink or muted text.
    const look = await remove.evaluate((el) => {
      const rgb = (v: string) => (v.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
      const root = getComputedStyle(document.documentElement);
      const probe = document.createElement('span');
      probe.style.color = root.getPropertyValue('--error').trim();
      document.body.append(probe);
      const error = rgb(getComputedStyle(probe).color);
      probe.remove();
      return { colour: rgb(getComputedStyle(el).color), error, ground: rgb(getComputedStyle(el.parentElement as HTMLElement).backgroundColor), underline: getComputedStyle(el).textDecorationLine };
    });
    const lum = (rgb: number[]) => {
      const [r, g, b] = rgb.map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      }) as [number, number, number];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [hi, lo] = [lum(look.colour), lum(look.ground)].sort((x, y) => y - x) as [number, number];
    expect(look.colour, 'Remove button colour is not the error red').not.toEqual(look.error);
    expect((hi + 0.05) / (lo + 0.05), 'Remove button contrast on the panel').toBeGreaterThanOrEqual(4.5);
    expect(look.underline, 'Remove button stays underlined').toContain('underline');
    await context.close();
  });
});

test.describe('T2.45 New Plan grouped into cards', () => {
  test('should group the New Plan controls into Trade, Risk and Plan Reflection cards with a two-column Risk grid', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'New Plan' }).click();
    await expect(page.getByRole('heading', { name: 'New Plan' })).toBeVisible(READY);
    const controls = (name: string) =>
      page.getByRole('region', { name, exact: true }).evaluate((el) =>
        [...el.querySelectorAll('input, select, textarea')].map((c) => {
          const label = (c as HTMLInputElement).labels?.[0]?.firstChild?.textContent?.trim();
          return c.getAttribute('type') === 'radio' ? `radio:${c.getAttribute('name')}` : label;
        }),
      );
    expect(await controls('Trade'), 'Trade controls').toEqual(['Account', 'Strategy', 'Symbol', 'Plan time']);
    expect(await controls('Risk'), 'Risk controls').toEqual(['Quantity', 'Intended entry', 'Stop', 'Target']);
    const reflection = await controls('Plan Reflection');
    expect(reflection.filter((c) => !c?.startsWith('radio:')), 'Plan Reflection text prompts').toEqual(['Why this trade, why now?', 'What would invalidate the thesis?']);
    expect(reflection.some((c) => c?.startsWith('radio:')), 'Plan Reflection chips').toBe(true);
    const risk = page.getByRole('region', { name: 'Risk', exact: true });
    const tops = () =>
      risk.evaluate(
        (el) =>
          new Promise<{ quantity: number; entry: number; stop: number; target: number }>((resolve) =>
            requestAnimationFrame(() => {
              const top = (label: string) =>
                [...el.querySelectorAll('label')].find((l) => l.firstChild?.textContent === label)?.querySelector('input')?.getBoundingClientRect().top ?? Number.NaN;
              resolve({ quantity: top('Quantity'), entry: top('Intended entry'), stop: top('Stop'), target: top('Target') });
            }),
          ),
      );
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      // The shell re-lays out on its own media query after the resize; wait for it before measuring.
      await expectLayout(page, width);
      const t = await tops();
      expect(t.entry, `Intended entry top at ${width}`).toBe(t.quantity);
      expect(t.target, `Target top at ${width}`).toBe(t.stop);
      expect(t.stop, `Stop row below Quantity row at ${width}`).toBeGreaterThan(t.quantity);
    }
    await context.close();
  });
});

test.describe('T2.50 Executions as expandable rows', () => {
  test('should stack the expanded labels above their values at 320, keep each row time on one line, and clip nothing', async ({
    server,
    profile,
  }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmReference(page);
    await recordEntry(page, PC1);
    await backToTrade(page);
    const section = page.getByRole('region', { name: 'Executions (2)', exact: true });
    await expect(section).toBeVisible(READY);
    await section.getByRole('button', { name: /^Buy 30 XYZ @ .* 10:00 details$/ }).click();
    await expect(section.getByRole('button', { name: /^Buy 30 XYZ @ .* 10:00 details$/ })).toHaveAttribute('aria-expanded', 'true');
    const measure = () =>
      section.evaluate((el) => {
        const lineHeight = (node: Element) => Number.parseFloat(getComputedStyle(node).lineHeight);
        const details = el.querySelector('.execution-details dl') as HTMLElement;
        const pairs = [...details.querySelectorAll('dt')].map((dt) => ({
          label: dt.textContent ?? '',
          labelTop: dt.getBoundingClientRect().top,
          valueTop: (dt.nextElementSibling as HTMLElement).getBoundingClientRect().top,
        }));
        const times = [...el.querySelectorAll('.execution-summary .nowrap')].map((span) => ({
          height: span.getBoundingClientRect().height,
          // An inline span's box is its glyph box; compare lines through its client rects.
          lines: span.getClientRects().length,
          lineHeight: lineHeight(span),
        }));
        const rows = [...el.querySelectorAll('li')].map((li) => ({
          scrollWidth: li.scrollWidth,
          clientWidth: li.clientWidth,
          right: li.getBoundingClientRect().right,
        }));
        return { pairs, times, rows, pageScroll: document.documentElement.scrollWidth, inner: window.innerWidth };
      });
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expectLayout(page, width);
      const m = await measure();
      expect(m.pairs.length, `detail pairs at ${width}`).toBeGreaterThanOrEqual(4);
      for (const pair of m.pairs) {
        if (width < 640) expect(pair.labelTop, `${pair.label} label above its value at ${width}`).toBeLessThan(pair.valueTop);
        else expect(pair.labelTop, `${pair.label} label beside its value at ${width}`).toBe(pair.valueTop);
      }
      for (const time of m.times) {
        expect(time.lines, `time on one line at ${width}`).toBe(1);
        expect(time.height, `time height at ${width}`).toBeLessThanOrEqual(1.6 * time.lineHeight);
      }
      for (const row of m.rows) {
        expect(row.scrollWidth, `row not clipped at ${width}`).toBeLessThanOrEqual(row.clientWidth);
        expect(row.right, `row within the viewport at ${width}`).toBeLessThanOrEqual(width);
      }
      expect(m.pageScroll, `page width at ${width}`).toBeLessThanOrEqual(m.inner);
    }
    // Open Lots keeps its table with no header cut off by the pinned first column.
    await page.setViewportSize({ width: 320, height: 900 });
    const headers = await page
      .getByRole('table', { name: 'Open Lots' })
      .evaluate((table) =>
        [...table.querySelectorAll('th')].map((th) => ({
          name: th.textContent ?? '',
          scrollWidth: th.scrollWidth,
          clientWidth: th.clientWidth,
          lines: th.getClientRects().length,
        })),
      );
    const opened = await page.getByRole('table', { name: 'Open Lots' }).evaluate((table) =>
      [...table.querySelectorAll('tbody td:first-child')].map((td) => {
        const style = getComputedStyle(td);
        return {
          height: td.getBoundingClientRect().height - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom),
          lineHeight: Number.parseFloat(style.lineHeight),
        };
      }),
    );
    for (const cell of opened) expect(cell.height, 'Opened date and time on one line').toBeLessThanOrEqual(1.6 * cell.lineHeight);
    for (const th of headers) expect(th.scrollWidth, `${th.name} header not clipped`).toBeLessThanOrEqual(th.clientWidth);
    // Open Lots pins nothing, so its scroll shadow must start at the table edge, not inside it.
    const pin = await page.getByRole('region', { name: 'Open Lots', exact: true }).evaluate((el) => getComputedStyle(el).getPropertyValue('--pin').trim());
    expect(pin, 'Open Lots pin width').toBe('0px');
    await context.close();
  });
});

// ---- T2.53 Detail, receipt and Accounts styling --------------------------------------------

const channels = (css: string): number[] => (css.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
const luminance = (c: number[]): number => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrastOf = (a: number[], b: number[]): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
// A token's computed colour, read through a probe so the test never copies the hex.
const tokenColour = (page: Page, token: string, property: 'color' | 'backgroundColor' = 'backgroundColor'): Promise<string> =>
  page.evaluate(
    ([name, prop]) => {
      const probe = document.createElement('span');
      probe.style[prop as 'color'] = `var(${name})`;
      document.body.append(probe);
      const value = getComputedStyle(probe)[prop as 'color'];
      probe.remove();
      return value;
    },
    [token, property] as const,
  );

// An Open Trade with two Position Changes (the second declines its Reflection), so the Detail has
// Executions, Plan Baseline, Entry Quality and Journal items including a decline.
async function openTradeWithJournal(page: Page): Promise<void> {
  await confirmReference(page);
  await recordEntry(page, PC1);
  await backToTrade(page);
  await recordEntry(page, PC2, { decline: true });
  await backToTrade(page);
  await expect(page.getByRole('region', { name: 'Entry Quality', exact: true })).toBeVisible(READY);
}

test.describe('T2.53 Detail, receipt and Accounts styling', () => {
  test('should set the summary card figures at 18 px or more, bold and tabular', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await openTradeWithJournal(page);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await expectLayout(page, width);
      const figures = await page.getByRole('region', { name: 'Summary', exact: true }).locator('dd').evaluateAll((els) =>
        els.map((el) => {
          const s = getComputedStyle(el);
          return { text: el.textContent ?? '', size: parseFloat(s.fontSize), weight: Number(s.fontWeight), numeric: s.fontVariantNumeric };
        }),
      );
      expect(figures.length, `summary figures at ${width}`).toBeGreaterThanOrEqual(5);
      for (const f of figures) {
        expect(f.size, `${f.text} font size at ${width}`).toBeGreaterThanOrEqual(18);
        expect(f.weight, `${f.text} weight at ${width}`).toBeGreaterThanOrEqual(600);
        expect(f.numeric, `${f.text} numerals at ${width}`).toContain('tabular-nums');
      }
    }
    await context.close();
  });

  test('should show Stop and Target with their labels in colours that reach 4.5:1 on white', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await openTradeWithJournal(page);
    const summary = page.getByRole('region', { name: 'Summary', exact: true });
    const white = channels(await tokenColour(page, '--card'));
    for (const [label, token] of [['Stop', '--stop'], ['Target', '--target']] as const) {
      const term = summary.locator('dt', { hasText: new RegExp(`^${label}$`) });
      await expect(term, `${label} label`).toBeVisible();
      const value = term.locator('xpath=following-sibling::dd[1]');
      const colour = channels(await value.evaluate((el) => getComputedStyle(el).color));
      expect(colour, `${label} uses its token`).toEqual(channels(await tokenColour(page, token, 'color')));
      expect(contrastOf(colour, white), `${label} contrast on white`).toBeGreaterThanOrEqual(4.5);
    }
    await context.close();
  });

  test('should lay Plan Baseline and Entry Quality out as a two-column figure grid at 1280 with no row wider than 480 px', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await openTradeWithJournal(page);
    const rowsOf = (name: string) =>
      page.getByRole('region', { name, exact: true }).locator('dl > div').evaluateAll((els) =>
        els.map((el) => {
          const box = el.getBoundingClientRect();
          return { text: el.textContent ?? '', left: Math.round(box.left), top: Math.round(box.top), width: box.width };
        }),
      );
    for (const [name, count] of [['Plan Baseline', 3], ['Entry Quality', 7]] as const) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await expectLayout(page, 1280);
      const wide = await rowsOf(name);
      expect(wide.length, `${name} rows`).toBe(count);
      for (const row of wide) expect(row.width, `${name} row ${row.text} width at 1280`).toBeLessThanOrEqual(480.5);
      expect(new Set(wide.map((r) => r.left)).size, `${name} columns at 1280`).toBe(2);
      expect(wide[1]!.top, `${name} second row beside the first at 1280`).toBe(wide[0]!.top);
      await page.setViewportSize({ width: 390, height: 844 });
      await expectLayout(page, 390);
      const narrow = await rowsOf(name);
      expect(new Set(narrow.map((r) => r.left)).size, `${name} columns at 390`).toBe(1);
    }
    await context.close();
  });

  test('should show Plan Reflection answers as prose sections with hairline dividers', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmReference(page);
    const section = page.getByRole('region', { name: 'Plan Reflection', exact: true });
    await expect(section).toBeVisible(READY);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expectLayout(page, width);
      const rows = await section.locator('dl > div').evaluateAll((els) =>
        els.map((el) => {
          const dt = el.querySelector('dt')!.getBoundingClientRect();
          const dd = el.querySelector('dd')!.getBoundingClientRect();
          const s = getComputedStyle(el);
          return { dtBottom: dt.bottom, ddTop: dd.top, ddLeft: dd.left, dtLeft: dt.left, border: parseFloat(s.borderTopWidth), style: s.borderTopStyle };
        }),
      );
      expect(rows.length, `answers at ${width}`).toBeGreaterThanOrEqual(3);
      rows.forEach((row, index) => {
        expect(row.ddTop, `answer ${index} below its prompt at ${width}`).toBeGreaterThanOrEqual(row.dtBottom - 1);
        expect(row.ddLeft, `answer ${index} aligned with its prompt at ${width}`).toBe(row.dtLeft);
        if (index > 0) {
          expect(row.border, `divider above answer ${index} at ${width}`).toBeGreaterThanOrEqual(1);
          expect(row.style, `divider style at ${width}`).toBe('solid');
        }
      });
    }
    await context.close();
  });

  // U9(d) (T2.62) replaced the right-aligned money with one phrase, so this asserts the tint only; the price
  // placement is measured under T2.62 line breaks.
  test('should put each Execution row on the tint', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await openTradeWithJournal(page);
    const section = page.getByRole('region', { name: 'Executions (3)', exact: true });
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expectLayout(page, width);
      const tint = await tokenColour(page, '--tint');
      const grounds = await section.locator('ul.executions > li').evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
      expect(grounds.length, `rows at ${width}`).toBe(3);
      for (const ground of grounds) expect(ground, `row ground at ${width}`).toBe(tint);
    }
    await context.close();
  });

  test('should style the receipt rows as Execution rows and Back to the Trade as an ink pill link', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmReference(page);
    await recordEntry(page, PC1);
    const receipt = page.getByRole('region', { name: 'Entry recorded', exact: true });
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expectLayout(page, width);
      const tint = await tokenColour(page, '--tint');
      const rows = await receipt.locator('ul.executions > li').evaluateAll((els) =>
        els.map((el) => {
          return { ground: getComputedStyle(el).backgroundColor, text: el.textContent };
        }),
      );
      expect(rows.length, `receipt rows at ${width}`).toBe(2);
      expect(rows[0]!.text, 'receipt row text').toMatch(/^Buy 30 XYZ @ \$50\.00, fee \$0\.50$/);
      for (const row of rows) expect(row.ground, `receipt row ground at ${width}`).toBe(tint);
      const link = receipt.getByRole('link', { name: 'Back to the Trade' });
      const look = await link.evaluate((el) => {
        const s = getComputedStyle(el);
        return { background: s.backgroundColor, colour: s.color, radius: parseFloat(s.borderTopLeftRadius) };
      });
      expect(look.background, `link background at ${width}`).toBe(await tokenColour(page, '--ink'));
      expect(look.colour, `link text at ${width}`).toBe('rgb(255, 255, 255)');
      expect(look.radius, `link radius at ${width}`).toBeGreaterThanOrEqual(20);
    }
    await context.close();
  });

  test('should list Accounts as rows with no bullets', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Accounts' }).click();
    await expect(page.getByRole('heading', { name: 'Accounts', level: 1 })).toBeVisible(READY);
    await page.getByRole('button', { name: 'Add Account' }).click();
    await page.getByLabel('Account name').fill('Second account');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Second account' })).toBeVisible(READY);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expectLayout(page, width);
      const rows = await page.locator('.accounts ul > li').evaluateAll((els) =>
        els.map((el) => {
          const s = getComputedStyle(el);
          const list = getComputedStyle(el.parentElement!);
          return { listStyle: s.listStyleType, indent: parseFloat(list.paddingInlineStart), border: parseFloat(s.borderTopWidth), height: el.getBoundingClientRect().height };
        }),
      );
      expect(rows.length, `Account rows at ${width}`).toBeGreaterThanOrEqual(2);
      for (const row of rows) {
        expect(row.listStyle, `bullet at ${width}`).toBe('none');
        expect(row.indent, `list indent at ${width}`).toBe(0);
        expect(row.border, `row divider at ${width}`).toBeGreaterThanOrEqual(1);
        expect(row.height, `row height at ${width}`).toBeGreaterThanOrEqual(40);
      }
    }
    await context.close();
  });

  test('should not overflow at 320 and 390 and stay axe clean on the Detail, the receipt and Accounts', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    const overflow = (state: string) =>
      page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).then((extra) => expect(extra, `page overflow on ${state}`).toBeLessThanOrEqual(0));
    const eachWidth = async (state: string, axe = true) => {
      for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        // The shell re-lays out on its own media query after the resize; wait for it before measuring.
        await expectLayout(page, width);
        if (width < 1280) await overflow(`${state} at ${width}`);
        if (axe) await expectAccessible(page, `${state} at ${width}`);
      }
    };
    await confirmReference(page);
    await recordEntry(page, PC1);
    await eachWidth('receipt');
    await backToTrade(page);
    await recordEntry(page, PC2, { decline: true });
    await backToTrade(page);
    await expect(page.getByRole('region', { name: 'Journal (3)', exact: true })).toBeVisible(READY);
    await page.getByRole('region', { name: 'Executions (3)', exact: true }).getByRole('button', { name: /^Buy 30 XYZ @ .* 10:00 details$/ }).click();
    await eachWidth('Detail');
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Accounts' }).click();
    await expect(page.getByRole('heading', { name: 'Accounts', level: 1 })).toBeVisible(READY);
    await eachWidth('Accounts');
    await context.close();
  });
});

test.describe('T2.55-B1 Planned Detail Trade Summary', () => {
  test('should lead the summary card of a just-confirmed Planned Detail, and of the same Detail reloaded, with the Trade Summary', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmReference(page);
    const summary = page.getByRole('region', { name: 'Summary', exact: true });
    await expect(summary.getByText('Long 100 shares @ $50.00')).toBeVisible(READY);
    expect(await summary.locator(':scope > *').first().textContent(), 'first element of the card').toBe('Long 100 shares @ $50.00');
    await page.reload();
    await expect(summary.getByText('Long 100 shares @ $50.00')).toBeVisible(READY);
    await context.close();
  });
});

// One label/value row per div of a dl, or per dt/dd pair of a plain dl; Plan Reflection answers are prose.
const detailRows = (page: Page) =>
  page.locator('main dl:not(.answers)').evaluateAll((lists) =>
    lists.flatMap((list) => {
      const card = list.closest('section')?.getAttribute('aria-label') ?? list.closest('section')?.querySelector('h2')?.textContent ?? '';
      const rect = (el: Element) => el.getBoundingClientRect();
      const wrapped = [...list.children].filter((c) => c.tagName === 'DIV');
      const pairs = wrapped.length > 0 ? wrapped.map((row) => [row.querySelector('dt')!, row.querySelector('dd')!] as const) : [...list.querySelectorAll(':scope > dt')].map((dt) => [dt, dt.nextElementSibling!] as const);
      return pairs.map(([dt, dd]) => ({ card, label: dt.textContent ?? '', width: rect(dd).right - rect(dt).left, valueRight: rect(dd).right, valueClass: dd.className }));
    }),
  );

test.describe('T2.55-B2 capped Detail label/value rows', () => {
  test('should keep every label/value row on the Planned and Open Details at most 480 px wide at 1280, with the summary values on one right edge', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmReference(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await expectLayout(page, 1280);
    const check = async (state: string) => {
      const rows = await detailRows(page);
      expect(rows.length, `${state} rows`).toBeGreaterThan(8);
      for (const row of rows) expect(row.width, `${state} ${row.card} / ${row.label} width`).toBeLessThanOrEqual(480.5);
      const edges = (await page.getByRole('region', { name: 'Summary', exact: true }).locator('dd').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right)));
      expect(Math.max(...edges) - Math.min(...edges), `${state} summary value right edges`).toBeLessThanOrEqual(1);
    };
    await check('Planned');
    await recordEntry(page, PC1);
    await backToTrade(page);
    await expect(page.getByRole('region', { name: 'Entry Quality', exact: true })).toBeVisible(READY);
    await check('Open');
    await page.getByRole('region', { name: 'Executions (2)', exact: true }).getByRole('button', { name: /details$/ }).first().click();
    await check('Open with an Execution expanded');
    await context.close();
  });
});

test.describe('T2.55-B3 Last activity on the Open Detail', () => {
  test('should show Last activity in the Position card as the latest Position Change time', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmReference(page);
    await recordEntry(page, PC1);
    await backToTrade(page);
    await recordEntry(page, PC2);
    await backToTrade(page);
    const position = page.getByRole('region', { name: 'Position', exact: true });
    await expect(position.locator('dt', { hasText: /^Last activity$/ })).toBeVisible(READY);
    await expect(position.locator('dt', { hasText: /^Last activity$/ }).locator('xpath=following-sibling::dd[1]')).toHaveText('2026-10-12 11:00');
    await context.close();
  });
});

test.describe('T2.55-B4 narrow Net cost on an incoherent Open row', () => {
  for (const width of [1280, 390, 320]) {
    test(`should show Net cost once in the accessibility tree of an incoherent Open row at ${width}`, async ({ server, profile }) => {
      void server;
      const setup = await profile.launch();
      const page = await onboardedPage(setup);
      await confirmReference(page, { ...PLAN, symbol: 'ABC' });
      await recordEntry(page, PC1);
      await setup.close();
      await writeIntegrityFixture(profile.dir, { kind: 'UnknownPlannedLeg', underlying: 'ABC' });
      const context = await profile.launch();
      const app = await firstPage(context);
      await app.setViewportSize({ width, height: 844 });
      await app.goto('/');
      await expectLayout(app, width);
      await expect(app.getByRole('table', { name: 'Open Trades' })).toBeVisible(READY);
      const row = app.getByRole('region', { name: 'Open Trades' }).locator('tbody tr').first();
      const tree = (await row.ariaSnapshot()).split('\n').slice(1).join('\n');
      if (width < WIDE_LAYOUT_MIN_WIDTH) expect(tree.match(/Net cost Not available/g)?.length, `Net cost line at ${width}`).toBe(1);
      else expect(tree, `no second line at ${width}`).not.toContain('Net cost');
      // Wide: the Net cost cell itself reads Not available.
      if (width >= WIDE_LAYOUT_MIN_WIDTH) await expect(row.locator('td').nth(2)).toHaveText('Not available');
      await context.close();
    });
  }
});

test.describe('T2.55-B5 price issues on the field that fails', () => {
  for (const blank of ['Stop', 'Target'] as const) {
    test(`should mark a blank ${blank}, not the valid Intended entry, after Confirm Plan`, async ({ server, profile }) => {
      void server;
      const context = await profile.launch();
      const page = await onboardedPage(context);
      await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'New Plan' }).click();
      await fillPlan(page, { ...PLAN, [blank.toLowerCase()]: '' });
      await page.getByRole('button', { name: 'Confirm Plan' }).click();
      await expect(page.getByRole('region', { name: 'This Plan can’t be confirmed yet' })).toBeVisible(READY);
      await expect(page.getByLabel(blank)).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByLabel(blank)).toHaveAccessibleDescription(/price greater than zero/);
      await expect(page.getByLabel('Intended entry')).not.toHaveAttribute('aria-invalid', 'true');
      await context.close();
    });
  }
});

test.describe('T2.55-B6 narrow 1R and Reward : risk on an incoherent Planned row', () => {
  for (const width of [1280, 390, 320]) {
    test(`should show 1R and Reward : risk once in the accessibility tree of an incoherent Planned row at ${width}`, async ({ server, profile }) => {
      void server;
      const setup = await profile.launch();
      const page = await onboardedPage(setup);
      await confirmReference(page, { ...PLAN, symbol: 'ABC' });
      await recordEntry(page, PC1);
      await setup.close();
      // Raw stored records are edited before launch: the Open Trade is filed under Planned and its facts cannot be replayed.
      await writeIntegrityFixture(profile.dir, { kind: 'StoredLifecycle', underlying: 'ABC', lifecycle: 'Planned' });
      await writeIntegrityFixture(profile.dir, { kind: 'UnknownPlannedLeg', underlying: 'ABC' });
      const context = await profile.launch();
      const app = await firstPage(context);
      await app.setViewportSize({ width, height: 844 });
      await app.goto('/?lifecycle=Planned');
      await expectLayout(app, width);
      await expect(app.getByRole('table', { name: 'Planned Trades' })).toBeVisible(READY);
      const row = app.getByRole('region', { name: 'Planned Trades' }).locator('tbody tr').first();
      const tree = (await row.ariaSnapshot()).split('\n').slice(1).join('\n');
      if (width < WIDE_LAYOUT_MIN_WIDTH) {
        expect(tree.match(/1R Not available/g)?.length, `1R line at ${width}`).toBe(1);
        expect(tree.match(/Reward : risk Not available/g)?.length, `Reward : risk line at ${width}`).toBe(1);
      } else {
        expect(tree, `no second line at ${width}`).not.toContain('1R Not available');
        await expect(row.locator('td').nth(2)).toHaveText('Not available');
        await expect(row.locator('td').nth(3)).toHaveText('Not available');
      }
      await context.close();
    });
  }
});

// Client rects of the first "@" and of the price after it, and of "fee" and its amount, found by walking the
// element's text so spans and inline markup do not matter. Runs in the page, so it is self-contained.
interface AtPair {
  readonly text: string;
  readonly atTop: number;
  readonly priceTop: number;
  readonly atRight: number;
  readonly priceLeft: number;
  readonly feeTop: number | undefined;
  readonly feeAmountTop: number | undefined;
}

const atPairs = (loc: Locator): Promise<AtPair[]> =>
  loc.evaluateAll((els) => {
    const rectOf = (el: Element, from: number, to: number): DOMRect => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let offset = 0;
      let started = false;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const len = (n.textContent ?? '').length;
        if (!started && from < offset + len) {
          range.setStart(n, from - offset);
          started = true;
        }
        if (started && to <= offset + len) {
          range.setEnd(n, to - offset);
          break;
        }
        offset += len;
      }
      return range.getBoundingClientRect();
    };
    return els.map((el) => {
      const text = el.textContent ?? '';
      const at = text.indexOf('@');
      const price = text.indexOf('$', at);
      const fee = text.indexOf('fee');
      const feeAmount = fee < 0 ? -1 : text.indexOf('$', fee);
      const atRect = rectOf(el, at, at + 1);
      const priceRect = rectOf(el, price, price + 1);
      return {
        text,
        atTop: atRect.top,
        priceTop: priceRect.top,
        atRight: atRect.right,
        priceLeft: priceRect.left,
        feeTop: fee < 0 ? undefined : rectOf(el, fee, fee + 3).top,
        feeAmountTop: feeAmount < 0 ? undefined : rectOf(el, feeAmount, feeAmount + 1).top,
      };
    });
  });

function expectAtWithPrice(pairs: readonly AtPair[], where: string): void {
  for (const p of pairs) {
    expect(Math.abs(p.priceTop - p.atTop), `${where}: price on the line of its "@" in "${p.text}"`).toBeLessThanOrEqual(1);
    if (p.feeTop !== undefined) expect(Math.abs(p.feeAmountTop! - p.feeTop), `${where}: fee beside its amount in "${p.text}"`).toBeLessThanOrEqual(1);
  }
}

test.describe('T2.62 line breaks', () => {
  for (const width of [320, 390, 1280]) {
    test(`should keep the Underlying header on one line and each Trade cell's "@" with its price at ${width}`, async ({ server, profile }) => {
      void server;
      const context = await profile.launch();
      const page = await onboardedPage(context);
      await seedTrades(page);
      await page.setViewportSize({ width, height: width === 1280 ? 900 : 844 });
      await expectLayout(page, width);
      for (const tab of TABS) {
        if (tab === 'Planned') await openPlanned(page);
        const table = page.getByRole('table', { name: `${tab} Trades` });
        await expect(table).toBeVisible(READY);
        const header = await table.locator('thead th').first().evaluate((th) => {
          const range = document.createRange();
          range.selectNodeContents(th);
          return { text: th.textContent, height: range.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(th).lineHeight) };
        });
        expect(header.text).toBe('Underlying');
        expect(header.height, `${tab} Underlying header height at ${width}`).toBeLessThanOrEqual(1.6 * header.lineHeight);
        expectAtWithPrice(await atPairs(table.locator('tbody tr td:nth-child(2)')), `${tab} Trade cell at ${width}`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${tab} page overflow at ${width}`).toBeLessThanOrEqual(0);
      }
      await context.close();
    });
  }

  // T2.65-B1: the Detail summary card's Trade text breaks like the Trades cells' (prices over $1,000 are the widest).
  test('should keep "@" with its price in the Detail summary card Trade text at 320, 340 and 390', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    const planned = { ...PLAN, symbol: 'PLN', quantity: '1000', entry: '1500', stop: '1400', target: '1700' };
    const open = { ...PLAN, symbol: 'OPN', quantity: '100', entry: '1234', stop: '1200', target: '1300' };
    const rows = [
      { quantity: '60', price: '1234.50', fee: '0.50', time: '2026-10-12T10:00' },
      { quantity: '40', price: '1240.00', fee: '0.50', time: '2026-10-12T10:01' },
    ];
    await confirmReference(page, planned);
    await confirmReference(page, open);
    await recordEntry(page, rows);
    await backToTrade(page, 'OPN');
    const checks = [
      ['Open', 'Long 100 shares @ $1,236.70'],
      ['Planned', 'Long 1000 shares @ $1,500.00'],
    ] as const;
    const summary = page.getByRole('region', { name: 'Summary', exact: true }).locator('.summary-text');
    for (const [kind, expected] of checks) {
      if (kind === 'Planned') {
        await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
        await openPlanned(page);
        await page.getByRole('table', { name: 'Planned Trades' }).getByRole('link', { name: 'PLN' }).click(READY);
        await expect(page.getByRole('heading', { name: 'PLN', level: 1 })).toBeVisible();
      }
      for (const width of [320, 340, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await expectLayout(page, width);
        await expect(summary).toHaveText(expected);
        expectAtWithPrice(await atPairs(summary), `${kind} summary Trade text at ${width}`);
      }
    }
    await context.close();
  });

  // Right edges (cell, its descendants) of the pinned and Trade cells against the scroll region's client box, before any scrolling.
  const insideRegion = (page: Page, tab: (typeof TABS)[number]) =>
    page.getByRole('region', { name: `${tab} Trades` }).evaluate((region) => {
      const limit = region.getBoundingClientRect().left + region.clientLeft + region.clientWidth;
      return [...region.querySelectorAll('tbody tr')].flatMap((row) =>
        [row.querySelector('td:nth-child(1)')!, row.querySelector('td:nth-child(2)')!].map((cell, i) => ({
          cell: i === 0 ? 'Underlying' : 'Trade',
          limit,
          right: Math.max(cell.getBoundingClientRect().right, ...[...cell.querySelectorAll('*')].map((d) => d.getBoundingClientRect().right)),
        })),
      );
    });

  for (const width of [320, 390]) {
    test(`should keep the Underlying and Trade cells, with the second line and any badge, inside the scroll region at ${width}`, async ({ server, profile }) => {
      void server;
      const context = await profile.launch();
      const page = await onboardedPage(context);
      await seedTrades(page);
      await page.setViewportSize({ width, height: 844 });
      await expectLayout(page, width);
      for (const tab of TABS) {
        if (tab === 'Planned') await openPlanned(page);
        await expect(page.getByRole('table', { name: `${tab} Trades` })).toBeVisible(READY);
        for (const c of await insideRegion(page, tab)) expect(c.right, `${tab} ${c.cell} cell right edge at ${width}`).toBeLessThanOrEqual(c.limit + 0.5);
      }
      await context.close();
    });

    test(`should keep a Records disagree badge inside the scroll region at ${width}`, async ({ server, profile }) => {
      void server;
      const setup = await profile.launch();
      const page = await onboardedPage(setup);
      await confirmReference(page, { ...PLAN, symbol: 'ABC' });
      await recordEntry(page, PC1);
      await setup.close();
      await writeIntegrityFixture(profile.dir, { kind: 'StoredLifecycle', underlying: 'ABC', lifecycle: 'Planned' });
      const context = await profile.launch();
      const app = await firstPage(context);
      await app.setViewportSize({ width, height: 844 });
      await app.goto('/?lifecycle=Planned');
      await expect(app.getByRole('table', { name: 'Planned Trades' })).toBeVisible(READY);
      expect((await measure(app, 'Planned')).rows.filter((r) => r.badgeRight !== undefined).length, `badges at ${width}`).toBe(1);
      for (const c of await insideRegion(app, 'Planned')) expect(c.right, `Planned ${c.cell} cell right edge at ${width}`).toBeLessThanOrEqual(c.limit + 0.5);
      await context.close();
    });

    test(`should keep the UNDERLYING header inside its own cell on one line at ${width}`, async ({ server, profile }) => {
      void server;
      const context = await profile.launch();
      const page = await onboardedPage(context);
      await seedTrades(page);
      await page.setViewportSize({ width, height: 844 });
      await expectLayout(page, width);
      for (const tab of TABS) {
        if (tab === 'Planned') await openPlanned(page);
        const table = page.getByRole('table', { name: `${tab} Trades` });
        await expect(table).toBeVisible(READY);
        const h = await table.locator('thead tr').first().evaluate((tr) => {
          const first = tr.querySelectorAll('th')[0]!;
          const second = tr.querySelectorAll('th')[1]!;
          const range = document.createRange();
          range.selectNodeContents(first);
          const s = getComputedStyle(first);
          const probe = document.createElement('div');
          probe.style.width = 'var(--pin)';
          first.closest('.table-scroll')!.append(probe);
          const pin = probe.getBoundingClientRect().width;
          probe.remove();
          return {
            width: first.getBoundingClientRect().width,
            pin,
            scrollWidth: first.scrollWidth,
            clientWidth: first.clientWidth,
            textRight: range.getBoundingClientRect().right,
            tradeLeft: second.getBoundingClientRect().left,
            height: range.getBoundingClientRect().height,
            lineHeight: parseFloat(s.lineHeight),
          };
        });
        expect(h.width, `${tab} pinned header cell stays at the pin width at ${width}`).toBeLessThanOrEqual(h.pin + 0.5);
        expect(h.scrollWidth, `${tab} UNDERLYING scrollWidth at ${width}`).toBeLessThanOrEqual(h.clientWidth);
        expect(h.textRight, `${tab} UNDERLYING text right edge at ${width}`).toBeLessThanOrEqual(h.tradeLeft);
        expect(h.height, `${tab} UNDERLYING one line at ${width}`).toBeLessThanOrEqual(1.6 * h.lineHeight);
      }
      await context.close();
    });
  }

  test('should read each Detail Execution as one phrase with the price straight after the "@" at 320, 390 and 1280', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await openTradeWithJournal(page);
    const rows = page.getByRole('region', { name: 'Executions (3)', exact: true }).locator('ul.executions > li .execution-summary');
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expectLayout(page, width);
      const pairs = await atPairs(rows);
      expect(pairs.length, `Execution rows at ${width}`).toBe(3);
      expectAtWithPrice(pairs, `Execution row at ${width}`);
      for (const p of pairs) expect(p.priceLeft - p.atRight, `price follows the "@" at ${width} in "${p.text}"`).toBeLessThanOrEqual(12);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `overflow at ${width}`).toBeLessThanOrEqual(0);
    }
    await context.close();
  });

  test('should read each receipt row as one phrase with the price after the "@" and "fee" beside its amount at 320, 390 and 1280', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmReference(page);
    await recordEntry(page, PC1);
    const rows = page.getByRole('region', { name: 'Entry recorded', exact: true }).locator('ul.executions > li');
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expectLayout(page, width);
      const pairs = await atPairs(rows);
      expect(pairs.length, `receipt rows at ${width}`).toBe(2);
      expectAtWithPrice(pairs, `receipt row at ${width}`);
      for (const p of pairs) {
        expect(p.feeTop, 'receipt shows a fee').toBeDefined();
        expect(p.priceLeft - p.atRight, `price follows the "@" at ${width} in "${p.text}"`).toBeLessThanOrEqual(12);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `overflow at ${width}`).toBeLessThanOrEqual(0);
    }
    await context.close();
  });
});

test.describe('T2.63 R lines', () => {
  async function expectSecondLinesBelow(entryQuality: Locator, page: Page, where: string, width: number): Promise<void> {
    for (const [term, second] of [['Actual initial risk', '1.08R'], ['Reward : risk', 'planned 2.4']] as const) {
      const value = entryQuality.locator('dt', { hasText: term }).locator('xpath=following-sibling::dd[1]');
      const parts = await value.evaluate((dd) =>
        Array.from(dd.children).map((el) => {
          const box = el.getBoundingClientRect();
          return { text: el.textContent ?? '', top: box.top, bottom: box.bottom };
        }),
      );
      const [amount, line] = parts;
      expect(line?.text, `${where} ${term} second line at ${width}`).toBe(second);
      expect(line!.top, `${where} ${term} second line top at ${width}`).toBeGreaterThanOrEqual(amount!.bottom - 0.5);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${where} overflow at ${width}`).toBeLessThanOrEqual(0);
  }

  test('should put the second line at or below the amount on the receipt and in Entry Quality at 320 and 1280', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmReference(page);
    await recordEntry(page, PC1);
    await backToTrade(page);
    await recordEntry(page, PC2, { decline: true });
    const receipt = page.getByRole('region', { name: 'Entry recorded', exact: true }).getByRole('region', { name: 'Entry Quality', exact: true });
    await expect(receipt).toBeVisible(READY);
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expectLayout(page, width);
      await expectSecondLinesBelow(receipt, page, 'receipt', width);
    }
    await backToTrade(page);
    const detail = page.getByRole('region', { name: 'Entry Quality', exact: true });
    await expect(detail).toBeVisible(READY);
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expectLayout(page, width);
      await expectSecondLinesBelow(detail, page, 'Detail', width);
    }
    await context.close();
  });
});

test.describe('T2.64 Detail cards', () => {
  const LONG_NOTE = 'Scaled in over three fills because the first two filled below my intended entry and the market kept pressing the stop, so I held the last tranche until the retest of the breakout level held. '.repeat(2);

  test('should align the Fulfillment row with the other rows, set Journal answers below their questions, and stay accessible at 1280 and 320', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmReference(page);
    await openEntryForm(page);
    await fillRows(page, PC1);
    await completeReflection(page);
    await reflectionSection(page).getByLabel('Note').fill(LONG_NOTE);
    await page.getByRole('button', { name: 'Save entry' }).click();
    await expect(page.getByRole('heading', { name: 'Entry recorded' })).toBeVisible();
    await backToTrade(page);
    await expect(page.getByRole('region', { name: 'Entry Quality', exact: true })).toBeVisible(READY);
    const fulfillment = page.getByRole('region', { name: 'Planned-Leg Fulfillment', exact: true });
    const journal = page.getByRole('region', { name: /^Journal/ });
    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expectLayout(page, width);
      if (width === 1280) {
        const row = await fulfillment.locator('dt').first().evaluate((dt) => {
          const box = dt.parentElement!.getBoundingClientRect();
          return { width: box.width, valueRight: dt.nextElementSibling!.getBoundingClientRect().right };
        });
        expect(row.width, 'Fulfillment row width').toBeLessThanOrEqual(480.5);
        const edges = await page.getByRole('region', { name: 'Summary', exact: true }).locator('dd').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
        expect(Math.abs(row.valueRight - Math.max(...edges)), `Fulfillment value right edge ${row.valueRight} vs summary ${edges.join(',')}`).toBeLessThanOrEqual(1);
      }
      const pairs = await journal.locator('dl.answers dt').evaluateAll((dts) =>
        dts.map((dt) => {
          const q = dt.getBoundingClientRect();
          const a = dt.nextElementSibling!.getBoundingClientRect();
          return { text: dt.textContent ?? '', questionBottom: q.bottom, answerTop: a.top, answerWidth: a.width };
        }),
      );
      expect(pairs.length, `answers at ${width}`).toBeGreaterThanOrEqual(3);
      for (const p of pairs) expect(p.answerTop, `${p.text} answer below its question at ${width}`).toBeGreaterThanOrEqual(p.questionBottom - 0.5);
      if (width === 1280) {
        const note = pairs.find((p) => p.text === 'Note');
        expect(note?.answerWidth, 'long Note answer width at 1280').toBeGreaterThan(480);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `overflow at ${width}`).toBeLessThanOrEqual(0);
      await expectAccessible(page, `Open Detail with fulfillment row and Journal prose at ${width}`);
    }
    await context.close();
  });
});
