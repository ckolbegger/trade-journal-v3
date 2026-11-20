import type { Locator, Page } from '@playwright/test';
import { expectNoSidewaysScroll } from '../d7p/support.ts';
import { AXIO_U, BREN, buildOn, closeOf, CORV, DALE_D, detail, expect, expectAccessible, listMeters, onboardedAt, openOpenList, openReview, READY, reviewMeters, setViewport, test, type Fixture, type TradeRef } from './support.ts';

test.use({ actionTimeout: 15_000 });

// B9.11 (plan section 7.2, AC-UI-001, AC-UI-002, W51): the four Trades of I9.10 at Fri 11-13, with the meter on the Open list, on a Review card and in the Detail's rail (its Conditions card) at 1280 x 800
// and at 375 and 320 px wide (667 high). At each size: no sideways scroll, no WCAG 2.1 A or AA violation, every meter inside the viewport; on a phone exactly one meter per Open row, under the figures
// line (the wide layout's copy in the P&L column is hidden below 960 px, and the narrow copy above it); and the meter never leans on colour alone.
const SIZES = [
  { width: 1280, height: 800 },
  { width: 375, height: 667 },
  { width: 320, height: 667 },
] as const;

// Every shown meter lies inside the viewport's width.
async function expectInside(meters: Locator, width: number, where: string): Promise<void> {
  // Read in one step and repeated until there are meters: a list that re-renders leaves none for a moment.
  let boxes: { x: number; width: number }[] = [];
  await expect
    .poll(async () => {
      boxes = await meters.evaluateAll((els) => els.map((el) => ({ x: el.getBoundingClientRect().x, width: el.getBoundingClientRect().width })));
      return boxes.length;
    }, { message: `${where}: meters` })
    .toBeGreaterThan(0);
  for (const [index, box] of boxes.entries()) {
    expect(box.x, `${where}: meter ${index + 1} left edge`).toBeGreaterThanOrEqual(-0.5);
    expect(box.x + box.width, `${where}: meter ${index + 1} right edge`).toBeLessThanOrEqual(width + 0.5);
    expect(box.width, `${where}: meter ${index + 1} width`).toBeGreaterThan(40);
  }
}

async function surfaces(page: Page, bren: TradeRef, size: (typeof SIZES)[number]): Promise<void> {
  const where = `${size.width} px`;
  await setViewport(page, size.width, size.height);

  // The Open list: exactly one meter shown per row, whichever width, named; under the figures line on a phone.
  await page.goto('/');
  await openOpenList(page);
  const table = page.getByRole('table', { name: 'Open Trades' });
  const rows = await listMeters(page);
  expect(rows, `${where}: four rows`).toHaveLength(4);
  for (const row of rows) expect(row.names, `${where}: one meter shown per row`).toHaveLength(1);
  await expect(table.getByRole('img')).toHaveCount(4);
  await expectInside(table.getByRole('img'), size.width, `${where} list`);
  if (size.width < 960) {
    // Each row's shown meter starts at or below the bottom of its shown figures line.
    await expect
      .poll(() =>
        table.locator('tbody tr').evaluateAll((trs) =>
          trs.map((tr) => {
            const shown = (selector: string) => [...tr.querySelectorAll(selector)].find((el) => (el as HTMLElement).offsetParent !== null)!.getBoundingClientRect();
            return shown('.meter').top >= shown('.trade-line').bottom - 1;
          })), { message: `${where}: each meter is under its figures line` })
      .toEqual([true, true, true, true]);
  }
  await expectNoSidewaysScroll(page, `${where}: the Open list`);
  await expectAccessible(page, `the Open list at ${where}`);

  // A Review card: each card's header meter is inside the viewport, and the page does not scroll sideways.
  await page.goto('/');
  await openReview(page);
  const cards = await reviewMeters(page);
  expect(cards, `${where}: four cards`).toHaveLength(4);
  for (const card of cards) expect(card.name, `${where}: each card's meter is named`).toMatch(/^P&L [+−]\$/);
  await expectInside(page.locator('li.review-card .review-card-head').getByRole('img'), size.width, `${where} Review`);
  await expectNoSidewaysScroll(page, `${where}: the Review`);
  await expectAccessible(page, `the Review at ${where}`);

  // The rail: the Conditions card's meter on BREN's Detail.
  await page.goto(`/trades/${bren.tradeId}`);
  await expect(detail.heading(page, 'BREN')).toBeVisible(READY);
  const rail = page.locator('.conditions-card').getByRole('img');
  await expect(rail).toHaveCount(1);
  await expectInside(rail, size.width, `${where} rail`);
  await expectNoSidewaysScroll(page, `${where}: the Detail`);
  await expectAccessible(page, `BREN's Detail at ${where}`);
}

test.describe('B9.11 The meter, responsive and accessible', () => {
  test('should keep one named meter per Open row, on a Review card and in the rail at 1280, 375 and 320 px, with no sideways scroll and no WCAG 2.1 AA violation', async ({ profile }) => {
    test.setTimeout(480_000);
    const { context, page } = await onboardedAt(profile, closeOf('2026-11-13'));
    const refs: Record<string, TradeRef> = {};
    for (const fixture of [BREN, CORV, DALE_D, AXIO_U] satisfies Fixture[]) refs[fixture.symbol] = await buildOn(page, fixture, 9);
    for (const size of [...SIZES, SIZES[0]]) await surfaces(page, refs.BREN!, size);
    await context.close();
  });

  test('should say what each meter shows in shape and words as well as colour, at 375 px', async ({ profile }) => {
    test.setTimeout(480_000);
    const { context, page } = await onboardedAt(profile, closeOf('2026-11-13'));
    const refs: Record<string, TradeRef> = {};
    for (const fixture of [BREN, CORV, DALE_D, AXIO_U] satisfies Fixture[]) refs[fixture.symbol] = await buildOn(page, fixture, 9);
    await setViewport(page, 375, 667);
    await page.goto('/');
    await openOpenList(page);
    const meterOf = (symbol: string): Locator => page.getByRole('table', { name: 'Open Trades' }).getByRole('row', { name: new RegExp(symbol) }).getByRole('img');
    // Past a line: a square pointer, a hatched part and the words "past the Stop" or "past the Target"; between the lines: a round pointer and no hatching.
    for (const [symbol, shape, words] of [['DALE', 'square', 'past the Stop by'], ['BREN', 'square', 'past the Target by'], ['CORV', 'square', 'past the Target by']] as const) {
      await expect(meterOf(symbol).getByTestId('meter-pointer'), symbol).toHaveAttribute('data-shape', shape);
      await expect(meterOf(symbol).getByTestId('meter-past'), symbol).toHaveCount(1);
      await expect(meterOf(symbol), symbol).toHaveAccessibleName(new RegExp(words));
    }
    await expect(meterOf('AXIO').getByTestId('meter-pointer')).toHaveAttribute('data-shape', 'round');
    await expect(meterOf('AXIO').getByTestId('meter-past')).toHaveCount(0);
    await expect(meterOf('AXIO')).toHaveAccessibleName(/58% of the way to the Target/);
    // What was realized is solid and what is open is outlined, so a gain and a loss differ by fill as well as colour; and no meter shows a word.
    await expect(meterOf('BREN').getByTestId('meter-banked')).toHaveAttribute('data-fill', 'solid');
    await expect(meterOf('BREN').getByTestId('meter-open')).toHaveAttribute('data-fill', 'outline');
    await expect(meterOf('DALE').getByTestId('meter-banked')).toHaveAttribute('data-tone', 'loss');
    await expect(meterOf('BREN').getByTestId('meter-banked')).toHaveAttribute('data-tone', 'profit');
    for (const symbol of ['BREN', 'CORV', 'DALE', 'AXIO']) await expect(meterOf(symbol), symbol).toHaveText('');
    await context.close();
  });

  // T9.38-B1: the shapes above are attributes; this case reads what the stylesheet paints from them.
  test('should show the square pointer, the hatch and the outlined open fill in the rendered styles, not only in attributes', async ({ profile }) => {
    test.setTimeout(480_000);
    const { context, page } = await onboardedAt(profile, closeOf('2026-11-13'));
    for (const fixture of [BREN, CORV, DALE_D, AXIO_U] satisfies Fixture[]) await buildOn(page, fixture, 9);
    await setViewport(page, 375, 667);
    await page.goto('/');
    await openOpenList(page);
    const meterOf = (symbol: string): Locator => page.getByRole('table', { name: 'Open Trades' }).getByRole('row', { name: new RegExp(symbol) }).getByRole('img');
    // A list that re-renders hands a detached element (every property empty) for a moment: repeat the read until the element is attached.
    const style = async (locator: Locator, properties: string[]): Promise<Record<string, string>> => {
      let read: Record<string, string> = {};
      await expect
        .poll(async () => {
          read = await locator.evaluate((el, names) => {
            const computed = getComputedStyle(el);
            return Object.fromEntries(names.map((name) => [name, computed.getPropertyValue(name)]));
          }, properties);
          return el_attached(read);
        })
        .toBe(true);
      return read;
    };
    const el_attached = (read: Record<string, string>): boolean => Object.values(read).some((value) => value !== '');
    // The pointer: square (a 3 px corner) past a line, round (half its width) between the lines.
    for (const symbol of ['DALE', 'BREN', 'CORV']) {
      expect((await style(meterOf(symbol).getByTestId('meter-pointer'), ['border-top-left-radius']))['border-top-left-radius'], `${symbol}: square pointer`).toBe('3px');
    }
    expect((await style(meterOf('AXIO').getByTestId('meter-pointer'), ['border-top-left-radius']))['border-top-left-radius'], 'AXIO: round pointer').toBe('50%');
    // The part past a line is hatched (a repeating gradient), past the Stop and past the Target.
    for (const symbol of ['DALE', 'BREN']) {
      expect((await style(meterOf(symbol).getByTestId('meter-past'), ['background-image']))['background-image'], `${symbol}: hatched past part`).toContain('repeating-linear-gradient');
    }
    // What is open is outlined (an inset ring over a light fill) and what was realized is solid (a plain fill, no ring), so the two differ without colour.
    const open = await style(meterOf('BREN').getByTestId('meter-open'), ['box-shadow', 'background-image']);
    const banked = await style(meterOf('BREN').getByTestId('meter-banked'), ['box-shadow', 'background-color']);
    expect(open['box-shadow'], 'open fill is outlined').toContain('inset');
    expect(banked['box-shadow'], 'banked fill has no outline').toBe('none');
    expect(banked['background-color'], 'banked fill is solid').not.toBe('rgba(0, 0, 0, 0)');
    expect((await style(meterOf('BREN').getByTestId('meter-open'), ['background-color']))['background-color'], 'open fill is lighter than the banked fill').not.toBe(banked['background-color']);
    await context.close();
  });
});
