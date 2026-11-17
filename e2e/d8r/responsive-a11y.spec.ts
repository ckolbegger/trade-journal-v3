import type { Locator, Page } from '@playwright/test';
import { expectNoSidewaysScroll, setWidth } from '../d7p/support.ts';
import type { DrawerName } from '../support/detail/index.ts';
import {
  addOs2x, buildOc3, detail, expect, expectAccessible, launchAt, MONDAY_NOV_1700, openDetailAt, openDrawer, READY, recordExpiration, test, THURSDAY_1800, firstPage,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// B8R.7 (plan section 7.2, AC-UI-001 and AC-UI-002): Today on every state with a Position (Open O-C3, Settlement Due O-S2X, and the same put Closed by expiration), and Plan
// and Risk and Position on each, at 1280, 375 and 320 px: no sideways scroll, and axe (WCAG 2.1 A and AA tags, contrast included) clean on each. The greyed Closed
// Today keeps text at 4.5:1 or better (A242).
const WIDTHS = [1280, 375, 320] as const;
const DRAWERS: readonly DrawerName[] = ['Today', 'Plan and Risk', 'Position'];

async function checkDrawers(page: Page, state: string): Promise<void> {
  for (const width of WIDTHS) {
    await setWidth(page, width);
    for (const name of DRAWERS) {
      await openDrawer(page, name);
      await expect(page.locator(`#drawer-panel-${name.toLowerCase().replaceAll(' ', '-')}`)).toBeVisible();
      await expectNoSidewaysScroll(page, `${state}, ${name} at ${width}`);
      await expectAccessible(page, `${state}, ${name} at ${width}`);
    }
    await openDrawer(page, 'Today');
  }
}

// The contrast of each text cell of a container against the card it sits on, with the container's opacity folded into the text colour (a greyed region
// mixes its ink with the paper behind it).
const contrastOf = (cells: Locator) =>
  cells.evaluateAll((elements) => {
    const channels = (css: string) => css.match(/[\d.]+/g)!.slice(0, 4).map(Number);
    const luminance = ([r, g, b]: number[]) => {
      const linear = [r!, g!, b!].map((c) => ((c / 255) <= 0.03928 ? c / 255 / 12.92 : (((c / 255) + 0.055) / 1.055) ** 2.4));
      return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
    };
    const paperOf = (element: Element): number[] => {
      for (let node: Element | null = element; node; node = node.parentElement) {
        const [r, g, b, a = 1] = channels(getComputedStyle(node).backgroundColor);
        if (a > 0) return [r!, g!, b!];
      }
      return [255, 255, 255];
    };
    return elements.map((element) => {
      let opacity = 1;
      for (let node: Element | null = element; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
      const [r, g, b, a = 1] = channels(getComputedStyle(element).color);
      const paper = paperOf(element);
      const alpha = a * opacity;
      const ink = [r!, g!, b!].map((c, i) => c * alpha + paper[i]! * (1 - alpha));
      const [light, dark] = [luminance(ink), luminance(paper)].sort((x, y) => y - x);
      return { text: element.textContent, ratio: (light! + 0.05) / (dark! + 0.05) };
    });
  });

test.describe('B8R.7 Responsive and accessible', () => {
  test('should fit Today, Plan and Risk and Position on an Open, a Settlement Due and a Closed Trade at 1280, 375 and 320 px, with no sideways scroll and no WCAG 2.1 AA violations, the greyed Closed Today included', async ({ profile }) => {
    test.setTimeout(900_000);
    const oc3 = await buildOc3(profile, { thursdayHold: true });
    const os2x = await addOs2x(profile, MONDAY_NOV_1700);

    await test.step('Open: O-C3 at Thu 18:00', async () => {
      const { context, page } = await openDetailAt(profile, THURSDAY_1800, oc3);
      await checkDrawers(page, 'Open');
      await context.close();
    });

    const context = await launchAt(profile, MONDAY_NOV_1700);
    const page = await firstPage(context);
    await page.goto(`/trades/${os2x.tradeId}`);
    await expect(detail.settlementDueHeading(page)).toBeVisible(READY);
    await test.step('Settlement Due: O-S2X at Mon 11-23', async () => {
      await checkDrawers(page, 'Settlement Due');
    });

    await test.step('Closed: the same put once its expiration is recorded, with Today greyed', async () => {
      await setWidth(page, 1280);
      await detail.recordExpirationLink(page).click();
      await recordExpiration(page);
      await page.getByRole('link', { name: 'Back to the Trade' }).click();
      await expect(detail.heading(page, 'MNO')).toBeVisible(READY);
      await expect(detail.lifecycleBadge(page)).toHaveText('Cash-Secured Put, Closed');
      await checkDrawers(page, 'Closed');
      for (const width of WIDTHS) {
        await setWidth(page, width);
        await openDrawer(page, 'Today');
        const ratios = await contrastOf(page.locator('#drawer-panel-today').locator('table th, table td:not(:empty), table caption').or(page.locator('#drawer-panel-today').getByText('Closed', { exact: true })));
        expect(ratios.length, `greyed Today text at ${width}`).toBeGreaterThan(0);
        for (const { text, ratio } of ratios) expect(ratio, `"${text}" contrast at ${width}`).toBeGreaterThanOrEqual(4.5);
      }
    });
    await context.close();
  });
});
