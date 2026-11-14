// Self-test of the Trade Detail read helpers (T8P.4-B1 to B5), against static pages built with `setContent`, so no app server is needed.
// Each page stands in for the Detail the cockpit (D08P, T8P.5) will render: an article with a tab list labelled "Detail" and one panel per drawer.
import { expect, test, type Page } from '@playwright/test';
import { detail, eachDrawer, openDrawer } from './index.ts';
import { leftEdges } from './layout.ts';

// The tab list and its panels. Only the selected drawer's panel is in the page, as with a drawer that mounts on selection.
const PANELS: Record<string, string> = {
  Position: '<section aria-label="Position"><table><caption>Open Lots</caption></table><dl><dt>Position</dt><dd>Long</dd></dl></section>',
  'Plan and Risk': '<section aria-label="Plan"><table><caption>Conditions</caption></table><dl><dt>Stop</dt><dd>$1</dd></dl></section>',
};
const detailArticle = (): string => `<article class="trade-detail">
    <h1>XYZ</h1>
    <div role="tablist" aria-label="Detail">${Object.keys(PANELS).map((n) => `<button role="tab" aria-selected="false">${n}</button>`).join('')}</div>
    <div id="panel"></div>
  </article>`;
// A delegated handler, so a Detail inserted after the page loaded (as React does) has working tabs.
const TABS_SCRIPT = `<script>
  const panels = ${JSON.stringify(PANELS)};
  document.addEventListener('click', (event) => {
    const tab = event.target.closest('[role=tab]');
    if (!tab) return;
    for (const t of document.querySelectorAll('[role=tab]')) t.setAttribute('aria-selected', String(t === tab));
    document.getElementById('panel').innerHTML = panels[tab.textContent];
  });
</script>`;
const detailHtml = (): string => `<main>${detailArticle()}</main>${TABS_SCRIPT}`;

test.describe('T8P.4-B1 openDrawer waits for the loaded Detail', () => {
  test('should wait for the Detail to finish loading before deciding whether it has a tab list', async ({ page }) => {
    // The page shows its loading state, then the Detail 400 ms later.
    await page.route('http://stage.test/trades/t1', (route) => route.fulfill({ contentType: 'text/html', body: `<main><p role="status">Loading the Trade…</p></main>${TABS_SCRIPT}` }));
    await page.goto('http://stage.test/trades/t1');
    await page.evaluate((html) => void setTimeout(() => { document.querySelector('main')!.innerHTML = html; }, 400), detailArticle());
    await openDrawer(page, 'Position');
    await expect(detail.root(page).getByRole('tab', { name: 'Position' })).toHaveAttribute('aria-selected', 'true');
  });

  test('should return at once on a page that is no Trade Detail', async ({ page }) => {
    await page.route('http://stage.test/plans/new', (route) => route.fulfill({ contentType: 'text/html', body: '<main><h1>New plan</h1></main>' }));
    await page.goto('http://stage.test/plans/new');
    await openDrawer(page, 'Payoff');
  });
});

test.describe('T8P.4-B2 the Detail tab list is not a page edge', () => {
  test('should measure the Detail cards and heading without counting the Detail tab list', async ({ page }) => {
    await page.setContent(`<style>main{padding-left:16px} .tabs{margin-left:40px}</style>
      <main><article class="trade-detail"><h1>XYZ</h1><div role="tablist" aria-label="Detail" class="tabs"><button role="tab">Position</button></div>
      <section class="card">Card</section></article></main>`);
    expect(Object.keys(await leftEdges(page, detail.CARDS)).sort()).toEqual(['card', 'h1']);
  });

  test('should still count the tab list of a page without a Detail', async ({ page }) => {
    await page.setContent(`<main><h1>Trades</h1><div role="tablist"><button role="tab">Open</button></div><section class="card">Card</section></main>`);
    expect(Object.keys(await leftEdges(page)).sort()).toEqual(['card', 'h1', 'tablist']);
  });
});

test.describe('T8P.4-B3 Realized to date of the Valuation card', () => {
  test('should read Realized to date from the Valuation card when a dated line is also shown', async ({ page }) => {
    await page.setContent(`<main><article class="trade-detail">
      <section aria-label="Position"><dl><div><dt>Realized to date</dt><dd>$63.70</dd></div></dl></section>
      <section aria-label="At 13 Nov close"><dl><div><dt>Realized to date</dt><dd>$10.00</dd></div></dl></section>
    </article></main>`);
    // The Valuation card is retired (T8P.22): Realized to date is the Position card's, read apart from a dated section's.
    await expect(detail.positionRealizedToDate(page)).toHaveText('$63.70');
  });
});

const tableCaptions = (page: Page): Promise<string[]> => page.locator(detail.TABLES).evaluateAll((t) => t.map((x) => (x as HTMLTableElement).caption?.textContent ?? ''));
const listLabels = (page: Page): Promise<string[]> => detail.root(page).locator('dl:not(.answers) dt').allTextContents();

test.describe('T8P.4-B4 tables of every drawer', () => {
  test('should measure every Detail table in every drawer that holds one at narrow width', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.setContent(detailHtml());
    const seen = (await eachDrawer(page, () => tableCaptions(page))).flat();
    expect(seen.sort()).toEqual(['Conditions', 'Open Lots']);
  });

  test('should read once over a Detail with no tab list', async ({ page }) => {
    await page.setContent(`<main><article class="trade-detail"><h1>XYZ</h1><table><caption>A</caption></table><table><caption>B</caption></table></article></main>`);
    expect(await eachDrawer(page, () => tableCaptions(page))).toEqual([['A', 'B']]);
  });
});

test.describe('T8P.4-B5 description lists of every drawer', () => {
  test('should measure the description lists of every drawer that holds them', async ({ page }) => {
    await page.setContent(detailHtml());
    const seen = (await eachDrawer(page, () => listLabels(page))).flat();
    expect(seen.sort()).toEqual(['Position', 'Stop']);
  });
});
