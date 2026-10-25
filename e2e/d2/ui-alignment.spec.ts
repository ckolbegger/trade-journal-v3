// UI alignment measurements (plan D02-ui-alignment section 3): browser measurements against dist-faults.
import type { Locator, Page } from '@playwright/test';
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
  openEntryForm,
  openPlanned,
  PC1,
  PC2,
  PLAN,
  READY,
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

  test('should put each Execution row on the tint with its money right-aligned', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await openTradeWithJournal(page);
    const section = page.getByRole('region', { name: 'Executions (3)', exact: true });
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expectLayout(page, width);
      const tint = await tokenColour(page, '--tint');
      const rows = await section.locator('ul.executions > li').evaluateAll((els) =>
        els.map((el) => {
          const money = el.querySelector<HTMLElement>('.execution-money');
          const summary = el.querySelector<HTMLElement>('.execution-summary');
          const what = el.querySelector<HTMLElement>('.execution-what');
          return {
            ground: getComputedStyle(el).backgroundColor,
            align: money ? getComputedStyle(money).textAlign : '',
            moneyRight: money?.getBoundingClientRect().right ?? Number.NaN,
            summaryRight: summary?.getBoundingClientRect().right ?? Number.NaN,
            moneyLeft: money?.getBoundingClientRect().left ?? Number.NaN,
            whatRight: what?.getBoundingClientRect().right ?? Number.NaN,
          };
        }),
      );
      expect(rows.length, `rows at ${width}`).toBe(3);
      for (const row of rows) {
        expect(row.ground, `row ground at ${width}`).toBe(tint);
        expect(row.align, `money alignment at ${width}`).toBe('right');
        expect(Math.abs(row.moneyRight - row.summaryRight), `money flush right at ${width}`).toBeLessThanOrEqual(1);
        expect(row.moneyLeft, `money after the action text at ${width}`).toBeGreaterThanOrEqual(row.whatRight);
      }
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
          const money = el.querySelector('.execution-money') as HTMLElement;
          return { ground: getComputedStyle(el).backgroundColor, align: getComputedStyle(money).textAlign, moneyRight: money.getBoundingClientRect().right, right: el.getBoundingClientRect().right - parseFloat(getComputedStyle(el).paddingRight), text: el.textContent };
        }),
      );
      expect(rows.length, `receipt rows at ${width}`).toBe(2);
      expect(rows[0]!.text, 'receipt row text').toMatch(/^Buy 30 XYZ @ \$50\.00, fee \$0\.50$/);
      for (const row of rows) {
        expect(row.ground, `receipt row ground at ${width}`).toBe(tint);
        expect(row.align, `receipt money alignment at ${width}`).toBe('right');
        expect(row.right - row.moneyRight, `receipt money flush right at ${width}`).toBeLessThanOrEqual(1);
      }
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
