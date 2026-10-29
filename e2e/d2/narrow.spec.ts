import type { Page } from '@playwright/test';
import {
  backToTrade,
  confirmReference,
  expect,
  BASE_URL,
  fillPlan,
  firstPage,
  onboard,
  onboardedPage,
  openPlanned,
  PC1,
  PC2,
  PC3,
  READY,
  recordEntry,
  startJournal,
  test,
  writeIntegrityFixture,
} from './support.ts';

// Phone widths (ui-contract: narrow view is single-column; readable reflow; AC-UI-001).
const WIDTHS = [375, 320] as const;

// The page never scrolls sideways, and every table that renders sits inside its own horizontal
// scroll container no wider than the viewport.
async function expectReflowed(page: Page, view: string): Promise<void> {
  // The layout switches after a resize, so measure once the narrow layout is in place.
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveAttribute('data-placement', 'bottom');
  const layout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    tables: [...document.querySelectorAll('table')].map((table) => {
      let container = table.parentElement;
      while (container && !['auto', 'scroll'].includes(getComputedStyle(container).overflowX)) container = container.parentElement;
      return {
        caption: table.caption?.textContent ?? '',
        scrolls: !!container,
        containerWidth: container ? container.getBoundingClientRect().right : Infinity,
      };
    }),
  }));
  expect(layout.scrollWidth, `${view} page width`).toBeLessThanOrEqual(layout.innerWidth);
  for (const table of layout.tables) {
    expect(table.scrolls, `${view}: ${table.caption} inside a scroll container`).toBe(true);
    expect(table.containerWidth, `${view}: ${table.caption} container within the viewport`).toBeLessThanOrEqual(layout.innerWidth);
  }
}

test.describe('critic-1 defect 1 narrow reflow', () => {
  test('should keep the Open list page within 375 and 320 px with the table scrolling inside its own region', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmReference(page);
    await recordEntry(page, PC1);
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    await expect(page.getByRole('table', { name: 'Open Trades' })).toBeVisible(READY);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      await expectReflowed(page, `Open list at ${width}`);
      const region = page.getByRole('region', { name: 'Open Trades' });
      const scroll = await region.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
      expect(scroll.scrollWidth, `Open Trades region scrolls at ${width}`).toBeGreaterThan(scroll.clientWidth);
    }
    await context.close();
  });

  test('should keep the Open Trade Detail within 375 and 320 px with every table inside a scroll container', async ({ server, profile }) => {
    void server;
    const setup = await profile.launch();
    const page = await onboardedPage(setup);
    await confirmReference(page);
    await recordEntry(page, PC1);
    await backToTrade(page);
    await recordEntry(page, PC2);
    await backToTrade(page);
    await recordEntry(page, PC3, { decline: 'Added into strength.' });
    await backToTrade(page);
    await expect(page.getByRole('heading', { name: 'Entry Quality' })).toBeVisible();
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      await expectReflowed(page, `resolved Open Detail at ${width}`);
    }
    await setup.close();

    // The same Trade stored as Planned, so its Detail shows the Records disagree panel and its table.
    await writeIntegrityFixture(profile.dir, { kind: 'StoredLifecycle', underlying: 'XYZ', lifecycle: 'Planned' });
    const context = await profile.launch();
    const app = await firstPage(context);
    await app.goto('/?lifecycle=Planned');
    await app.getByRole('row', { name: /XYZ/ }).getByRole('link', { name: 'XYZ', exact: true }).click(READY);
    await expect(app.getByRole('table', { name: 'Stored versus expected' })).toBeVisible();
    for (const width of WIDTHS) {
      await app.setViewportSize({ width, height: 800 });
      await expectReflowed(app, `disagreeing Open Detail at ${width}`);
    }
    await context.close();
  });
});

test.describe('critic-2 defects narrow reflow', () => {
  test('should keep the Planned list page within 375 and 320 px with the table inside its own scroll region', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmReference(page);
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    await openPlanned(page);
    await expect(page.getByRole('table', { name: 'Planned Trades' })).toBeVisible(READY);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      await expectReflowed(page, `Planned list at ${width}`);
      const region = page.getByRole('region', { name: 'Planned Trades' });
      await expect(region.getByRole('table', { name: 'Planned Trades' })).toBeVisible();
      const right = await region.evaluate((el) => el.getBoundingClientRect().right);
      expect(right, `Planned Trades region within the viewport at ${width}`).toBeLessThanOrEqual(width);
    }
    await context.close();
  });

  test('should keep About within 375 and 320 px with its long identifiers wrapping', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'About' }).click();
    await expect(page.getByRole('heading', { name: 'Installed capabilities' })).toBeVisible(READY);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      await expectReflowed(page, `About at ${width}`);
    }
    await context.close();
  });

  // Guard (passed on first run): the remaining screens, measured while there.
  test('should keep first run, onboarding, Accounts, the New Plan form and the Planned Detail within 375 and 320 px', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await firstPage(context);
    // First run and onboarding come before the navigation exists, so their width is polled after each resize.
    const expectPageWithin = async (view: string) => {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 800 });
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth), { message: `${view} at ${width} page width` })
          .toBeLessThanOrEqual(width);
      }
    };
    const expectEachWidth = async (view: string) => {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 800 });
        await expectReflowed(page, `${view} at ${width}`);
      }
    };
    await page.goto(`${BASE_URL}/`);
    await expect(page.getByRole('heading', { name: 'Start your journal' })).toBeVisible(READY);
    await expectPageWithin('first run');
    await startJournal(page);
    await expect(page.getByRole('heading', { name: 'Add your brokerage account' })).toBeVisible(READY);
    await expectPageWithin('onboarding');
    await onboard(page);
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await nav.getByRole('link', { name: 'Accounts' }).click();
    await expect(page.getByRole('heading', { name: 'Accounts', level: 1 })).toBeVisible(READY);
    await expectEachWidth('Accounts');
    await nav.getByRole('link', { name: 'New Plan' }).click();
    await fillPlan(page);
    await expectEachWidth('New Plan form');
    await page.getByRole('button', { name: 'Confirm Plan' }).click();
    await expect(page.getByRole('heading', { name: 'XYZ', level: 1 })).toBeVisible();
    await expectEachWidth('Planned Detail');
    await context.close();
  });
});
