import type { Locator, Page } from '@playwright/test';
import { expectNoSidewaysScroll, setWidth } from '../d7p/support.ts';
import type { DrawerName } from '../support/detail/index.ts';
import { buildOc3, detail, expect, expectAccessible, openDetailAt, openDrawer, READY, tabTo, test, THURSDAY_1800 } from './support.ts';

test.use({ actionTimeout: 15_000 });

// B8P.5 (plan section 7.2, AC-UI-001 and AC-UI-002): O-C3 as in B8P.1, every drawer at 1280, 375 and 320 px, axe (WCAG 2.1 A and AA tags, as the earlier
// responsive-a11y specs use) on the rail and each drawer, and the cockpit by keyboard.
const WIDTHS = [1280, 375, 320] as const;
const DRAWERS: readonly DrawerName[] = ['Today', 'Position', 'Plan and Risk', 'Price History', 'Journal', 'Payoff'];

// The three Summary-card checks of e2e/d2/ui-alignment.spec.ts that T8P.22 retired (evidence/D08P/T8P.22-retired.md), each replaced here by a check on the
// cockpit element that now holds those figures:
//   :1111 "summary card figures at 18 px or more, bold and tabular"      -> the P&L card's figure (`.pnl-figure`), at every width;
//   :1135 "Stop and Target colours reach 4.5:1 on white"                 -> the Conditions card's Stop and Target roles and figures, at every width;
//   :1361 (assertion) "summary values on one right edge"                 -> the Conditions card's figures on one right edge, and each column of the
//                                                                          Position and Plan and Risk label/value grids on one right edge, at every width.

// The relative luminance contrast of a colour on a background, both as computed `rgb(...)` strings (WCAG 2.1).
const contrastOf = (page: Page, items: Locator) =>
  items.evaluateAll((elements) => {
    const channels = (css: string) => css.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const luminance = ([r, g, b]: number[]) => {
      const linear = [r!, g!, b!].map((c) => ((c / 255) <= 0.03928 ? c / 255 / 12.92 : (((c / 255) + 0.055) / 1.055) ** 2.4));
      return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
    };
    return elements.map((element) => {
      const ink = luminance(channels(getComputedStyle(element).color));
      const paper = luminance(channels(getComputedStyle(element.closest('.card') ?? document.body).backgroundColor));
      const [light, dark] = ink > paper ? [ink, paper] : [paper, ink];
      return { text: element.textContent, ratio: (light + 0.05) / (dark + 0.05) };
    });
  });

// A condition's row 2 on one line: its text has one line box, and it is neither clipped nor past the page's edge.
const rowTwoState = (rows: Locator) =>
  rows.evaluateAll((elements) =>
    elements.map((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const tops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
      return { text: element.textContent, lines: tops.size, clipped: element.scrollWidth > element.clientWidth + 1, right: Math.round(element.getBoundingClientRect().right), page: document.documentElement.clientWidth };
    }),
  );

// The right edges of the `dd`s of every label/value grid in a drawer, grouped by the column they sit in.
const gridColumns = (panel: Locator) =>
  panel.locator('dl.figure-grid').evaluateAll((grids) =>
    grids.flatMap((grid) => {
      const columns = new Map<number, number[]>();
      for (const dd of grid.querySelectorAll('dd')) {
        const row = dd.parentElement!.getBoundingClientRect();
        if (row.width === 0) continue;
        columns.set(Math.round(row.left), [...(columns.get(Math.round(row.left)) ?? []), dd.getBoundingClientRect().right]);
      }
      return [...columns.values()].map((rights) => ({ count: rights.length, spread: Math.max(...rights) - Math.min(...rights) }));
    }),
  );

test.describe('B8P.5 Responsive and accessible', () => {
  test('should fit every drawer at 1280, 375 and 320 px with no sideways scroll, no wrapped condition row, no WCAG 2.1 AA violations, and the replacements for the retired Summary-card checks', async ({ profile }) => {
    test.setTimeout(540_000);
    const trade = await buildOc3(profile, { thursdayHold: true });
    const { context, page } = await openDetailAt(profile, THURSDAY_1800, trade);
    const panel = (name: DrawerName) => page.locator(`#drawer-panel-${name.toLowerCase().replaceAll(' ', '-')}`);

    for (const width of WIDTHS) {
      await setWidth(page, width);
      await expect(page.locator('.shell')).toHaveAttribute('data-layout', width === 1280 ? 'wide' : 'narrow');

      await test.step(`the rail at ${width} px`, async () => {
        await expectNoSidewaysScroll(page, `rail at ${width}`);
        // A condition's row 2 never wraps, and is not clipped.
        const rows = await rowTwoState(detail.conditionBlocks(page).locator('.condition-text'));
        expect(rows.map((row) => row.text), `row 2 at ${width}`).toEqual(['Option at or below $1.00', 'XYZ at or above 60.00']);
        for (const row of rows) {
          expect(row.lines, `${row.text} lines at ${width}`).toBe(1);
          expect(row.clipped, `${row.text} clipped at ${width}`).toBe(false);
          expect(row.right, `${row.text} right edge at ${width}`).toBeLessThanOrEqual(row.page);
        }
        // Replaces :1111: the P&L card's figure is 18 px or more, bold and tabular.
        const figure = await detail.pnlFigure(page).evaluate((element) => {
          const style = getComputedStyle(element);
          return { size: parseFloat(style.fontSize), weight: Number(style.fontWeight), numeric: style.fontVariantNumeric };
        });
        expect(figure.size, `P&L figure size at ${width}`).toBeGreaterThanOrEqual(18);
        expect(figure.weight, `P&L figure weight at ${width}`).toBeGreaterThanOrEqual(600);
        expect(figure.numeric, `P&L figure numerals at ${width}`).toContain('tabular-nums');
        // Replaces :1135: the Stop and Target roles and figures reach 4.5:1 on the card.
        const ratios = [
          ...(await contrastOf(page, detail.conditionBlocks(page).locator('.condition-role'))),
          ...(await contrastOf(page, detail.conditionBlocks(page).locator('.condition-figure'))),
        ];
        expect(ratios).toHaveLength(4);
        for (const { text, ratio } of ratios) expect(ratio, `${text} contrast at ${width}`).toBeGreaterThanOrEqual(4.5);
        // Replaces :1361 (the rail's values): the condition figures share one right edge.
        const rights = await detail.conditionBlocks(page).locator('.condition-figure').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
        expect(Math.max(...rights) - Math.min(...rights), `condition figures right edges at ${width}`).toBeLessThanOrEqual(1);
        await expectAccessible(page, `rail and Today at ${width}`);
      });

      for (const name of DRAWERS) {
        await test.step(`the ${name} drawer at ${width} px`, async () => {
          await openDrawer(page, name);
          await expect(panel(name)).toBeVisible();
          await expectNoSidewaysScroll(page, `${name} at ${width}`);
          await expectAccessible(page, `${name} at ${width}`);
          if (name === 'Position' || name === 'Plan and Risk') {
            // Replaces :1361 (the label/value grids): each column's values share one right edge, and no row is wider than 480 px.
            const columns = await gridColumns(panel(name));
            expect(columns.length, `${name} grid columns at ${width}`).toBeGreaterThan(0);
            for (const column of columns) expect(column.spread, `${name} right edges at ${width}`).toBeLessThanOrEqual(1);
            const widest = await panel(name).locator('dl.figure-grid > div').evaluateAll((rows) => Math.max(...rows.map((row) => row.getBoundingClientRect().width)));
            expect(widest, `${name} widest row at ${width}`).toBeLessThanOrEqual(480.5);
          }
        });
      }
      await openDrawer(page, 'Today');
    }
    await context.close();
  });

  test('should work by keyboard alone: Tab through the rail with a visible focus ring, the tabs by the arrow keys, the drawer panel, and Reflect now opening the Journal form', async ({ profile }) => {
    test.setTimeout(420_000);
    const trade = await buildOc3(profile, { thursdayHold: true });
    const { context, page } = await openDetailAt(profile, THURSDAY_1800, trade);
    const tab = (name: DrawerName) => page.getByRole('tablist', { name: 'Detail' }).getByRole('tab', { name, exact: true });

    // Tab reaches the selected tab (every stop on the way shows a focus ring, as D2's tabTo checks); the arrows select and focus the others.
    await tabTo(page, tab('Today'));
    await page.keyboard.press('ArrowRight');
    await expect(tab('Position')).toBeFocused();
    await expect(tab('Position')).toHaveAttribute('aria-selected', 'true');
    await expect(tab('Today')).toHaveAttribute('tabindex', '-1');
    await page.keyboard.press('End');
    await expect(tab('Payoff')).toBeFocused();
    // The next Tab stop is the selected drawer's panel, with a focus ring.
    await page.keyboard.press('Tab');
    await expect(page.locator('#drawer-panel-payoff')).toBeFocused();
    const ring = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement!);
      return style.outlineStyle !== 'none' && style.outlineWidth !== '0px';
    });
    expect(ring, 'focus ring on the drawer panel').toBe(true);

    // Reflect now, from the rail, by keyboard: the Journal drawer is selected and Wednesday's form is open.
    // The rail comes before the tabs in the Tab order, so start again from the top of the page.
    await page.reload();
    await expect(detail.heading(page, 'XYZ')).toBeVisible(READY);
    await tabTo(page, detail.reflectNowButton(page).first());
    await page.keyboard.press('Enter');
    await expect(tab('Journal')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#drawer-panel-journal').getByRole('form', { name: 'Reflection' })).toBeVisible(READY);
    await expectAccessible(page, 'Journal with its form open');
    await context.close();
  });
});
