import type { Locator, Page } from '@playwright/test';
import { confirmOptionPlan, detail, expect, expectPayoffChart, MONDAY_0900, OC, onboardedAt, openDrawer, OS, READY, test } from './support.ts';

test.use({ actionTimeout: 15_000 });

const WIDTHS = [1280, 375, 320] as const;

interface Box { readonly text: string; readonly left: number; readonly right: number; readonly top: number; readonly bottom: number }

// Every text of the chart with its rendered box and rendered font size (user units times the SVG's screen scale).
async function chartTexts(chart: Locator): Promise<{ boxes: Box[]; fontSizes: number[] }> {
  return chart.evaluate((svg: SVGSVGElement) => {
    const scale = svg.getScreenCTM()!.a;
    const texts = [...svg.querySelectorAll('text')];
    return {
      boxes: texts.map((t) => {
        const r = t.getBoundingClientRect();
        return { text: t.textContent ?? '', left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      }),
      fontSizes: texts.map((t) => parseFloat(getComputedStyle(t).fontSize) * scale),
    };
  });
}

function overlaps(boxes: readonly Box[]): string[] {
  const found: string[] = [];
  for (let a = 0; a < boxes.length; a++) {
    for (let b = a + 1; b < boxes.length; b++) {
      const p = boxes[a]!;
      const q = boxes[b]!;
      if (p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom) found.push(`"${p.text}" over "${q.text}"`);
    }
  }
  return found;
}

const plannedChart = (page: Page): Locator => detail.payoffChart(page, 'Planned');

async function reachCharts(profile: Parameters<typeof onboardedAt>[0]): Promise<{ page: Page; urls: string[] }> {
  const { page } = await onboardedAt(profile, MONDAY_0900);
  const urls: string[] = [];
  for (const values of [OC, OS]) {
    await confirmOptionPlan(page, values);
    await expectPayoffChart(page, 'Planned');
    urls.push(page.url());
  }
  return { page, urls };
}

test.describe('T7.32-B2 Payoff chart layout', () => {
  test('should print no two chart text labels over each other on the Long Call and Cash-Secured Put Planned charts at 1280, 375 and 320 px', async ({ profile }) => {
    test.setTimeout(240_000);
    const { page, urls } = await reachCharts(profile);
    for (const url of urls) {
      await page.goto(url);
      await openDrawer(page, 'Payoff');
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await expect(plannedChart(page)).toBeVisible(READY);
        const { boxes } = await chartTexts(plannedChart(page));
        expect(overlaps(boxes), `${url} at ${width}px`).toEqual([]);
      }
    }
  });

  test('should render chart text at 10 px or more at 320 px', async ({ profile }) => {
    test.setTimeout(240_000);
    const { page, urls } = await reachCharts(profile);
    await page.setViewportSize({ width: 320, height: 900 });
    for (const url of urls) {
      await page.goto(url);
      await openDrawer(page, 'Payoff');
      await expect(plannedChart(page)).toBeVisible(READY);
      const { fontSizes } = await chartTexts(plannedChart(page));
      expect(Math.min(...fontSizes)).toBeGreaterThanOrEqual(10);
    }
  });

  test('should keep a negative payoff table amount on one line at 320 px', async ({ profile }) => {
    test.setTimeout(240_000);
    const { page, urls } = await reachCharts(profile);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(urls[0]!);
    await openDrawer(page, 'Payoff');
    const cells = detail.payoff(page, 'Planned').getByRole('table').getByRole('cell', { name: /^−\$/ });
    await expect(cells.first()).toBeVisible(READY);
    const lines = await cells.evaluateAll((tds) => tds.map((td) => {
      const range = document.createRange();
      range.selectNodeContents(td);
      return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
    }));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((n) => n === 1)).toBe(true);
  });
});
