import type { Page } from '@playwright/test';
import {
  backToTrade,
  checkForUpdate,
  completeReflection,
  confirmD1Plan,
  confirmReference,
  executionRow,
  expect,
  expectAccessible,
  fillRows,
  firstPage,
  holdTradesStore,
  onboardedD1Page,
  onboardedPage,
  openEntryForm,
  PC1,
  PC2,
  PC3,
  PLAN,
  profileAt,
  READY,
  recordEntry,
  reflectionSection,
  releaseTradesStore,
  reloadFromNotice,
  tabTo,
  test,
  writeIntegrityFixture,
  type Row,
} from './support.ts';

// The text of the focused element when it is an h1, else the element's tag.
const activeHeading = (page: Page) =>
  page.evaluate(() => (document.activeElement?.tagName === 'H1' ? document.activeElement.textContent : document.activeElement?.tagName));

const nav = (page: Page) => page.getByRole('navigation', { name: 'Primary' });
const openTab = (page: Page) => page.getByRole('tablist', { name: 'Trades by lifecycle' }).getByRole('tab', { name: 'Open' });
const plannedTab = (page: Page) => page.getByRole('tablist', { name: 'Trades by lifecycle' }).getByRole('tab', { name: 'Planned' });

const THREE_ROWS: readonly Row[] = [
  { quantity: '30', price: '50.00', fee: '0.50', time: '2026-10-12T10:00' },
  { quantity: '30', price: '50.20', fee: '0.50', time: '2026-10-12T10:01' },
  { quantity: '40', price: '50.30', fee: '1.00', time: '2026-10-12T10:02' },
];

async function expectRows(page: Page, rows: readonly Row[]): Promise<void> {
  for (const [index, row] of rows.entries()) {
    const group = executionRow(page, index + 1);
    await expect(group.getByLabel('Quantity')).toHaveValue(row.quantity);
    await expect(group.getByLabel('Price')).toHaveValue(row.price);
    await expect(group.getByLabel('Fee')).toHaveValue(row.fee);
    await expect(group.getByLabel('Economic Time')).toHaveValue(row.time);
  }
}

test.describe('B2.12 responsive and accessible', () => {
  test('should keep three Execution rows and the reflection answers through 390 px and back, switching layout at 960 px', async ({
    server,
    profile,
  }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmReference(page);
    await openEntryForm(page);
    await fillRows(page, THREE_ROWS);
    await completeReflection(page);
    await reflectionSection(page).getByLabel('Note').fill('Scaled in over three fills.');
    await expect(nav(page)).toHaveAttribute('data-placement', 'sidebar');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(nav(page)).toHaveAttribute('data-placement', 'bottom');
    await page.setViewportSize({ width: 959, height: 844 });
    await expect(nav(page)).toHaveAttribute('data-placement', 'bottom');
    await page.setViewportSize({ width: 960, height: 844 });
    await expect(nav(page)).toHaveAttribute('data-placement', 'sidebar');
    await page.setViewportSize({ width: 1280, height: 900 });

    expect(new URL(page.url()).pathname).toMatch(/^\/trades\/[^/]+\/record-entry$/);
    await expectRows(page, THREE_ROWS);
    const reflection = reflectionSection(page);
    await expect(reflection.getByRole('radiogroup', { name: 'Decision mode' }).getByLabel('As Planned')).toBeChecked();
    await expect(reflection.getByRole('radiogroup', { name: 'Primary emotion' }).getByLabel('Calm')).toBeChecked();
    await expect(reflection.getByRole('radiogroup', { name: 'Decision confidence' }).getByLabel('4')).toBeChecked();
    await expect(reflection.getByLabel('Note')).toHaveValue('Scaled in over three fills.');
    await context.close();
  });

  test('should report no WCAG 2.1 AA violations on the entry form, the Open list in every state, the Open Detail, and the migration views', async ({
    server,
    profile,
  }, info) => {
    test.setTimeout(180_000);
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await openTab(page).click();
    await expect(page.getByText('No open trades. Recording an entry on a Planned Trade opens it.')).toBeVisible();
    await expectAccessible(page, 'Open list Empty');

    await confirmReference(page);
    await openEntryForm(page);
    await expectAccessible(page, 'entry form');
    await page.getByRole('button', { name: 'Save entry' }).click();
    await expect(page.getByRole('heading', { name: 'This entry can’t be saved yet' })).toBeVisible();
    await expectAccessible(page, 'entry form with rejection');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectAccessible(page, 'entry form with rejection, narrow');
    await page.setViewportSize({ width: 1280, height: 900 });
    await fillRows(page, PC1);
    await completeReflection(page);
    await page.getByRole('button', { name: 'Save entry' }).click();
    await expect(page.getByRole('heading', { name: 'Entry recorded' })).toBeVisible();
    await expectAccessible(page, 'entry receipt');
    await backToTrade(page);
    await expectAccessible(page, 'Open Detail, entering');
    await recordEntry(page, PC2);
    await backToTrade(page);
    await recordEntry(page, PC3, { decline: 'Added into strength.' });
    await backToTrade(page);
    await expect(page.getByRole('region', { name: 'Deviations' })).toContainText('20 shares above plan');
    await expectAccessible(page, 'Open Detail, resolved with a Deviation and a decline');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectAccessible(page, 'Open Detail, narrow');
    await page.setViewportSize({ width: 1280, height: 900 });

    await nav(page).getByRole('link', { name: 'Trades' }).click();
    await expect(page.getByRole('table', { name: 'Open Trades' })).toBeVisible();
    await expectAccessible(page, 'Open list Ready');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectAccessible(page, 'Open list Ready, narrow');
    await page.setViewportSize({ width: 1280, height: 900 });

    await plannedTab(page).click();
    await expect(page.getByText('No planned trades yet')).toBeVisible();
    await holdTradesStore(page);
    await openTab(page).click();
    await expect(page.getByRole('status')).toHaveText('Loading open trades…');
    await expectAccessible(page, 'Open list Loading');
    await expect(page.getByRole('status')).toHaveText('Loading open trades…');
    await releaseTradesStore(page);
    await expect(page.getByRole('table', { name: 'Open Trades' })).toBeVisible();
    await context.close();

    // Error: a Position Change naming an Execution that does not exist, written before launch.
    await writeIntegrityFixture(profile.dir, { kind: 'MissingMember', underlying: PLAN.symbol });
    const failing = await profile.launch();
    const errorPage = await firstPage(failing);
    await errorPage.goto('/');
    await expect(errorPage.getByText('We couldn’t load your open trades. Nothing was changed.')).toBeVisible(READY);
    await expectAccessible(errorPage, 'Open list Error');
    await failing.close();

    // The migration views, on a profile holding D1 data, updated to the faults build.
    server.use('dist-releases/d1');
    const migrating = await profileAt(info.outputPath('migration')).launch();
    const d1 = await onboardedD1Page(migrating);
    await confirmD1Plan(d1, PLAN);
    await d1.goto('/?faults=control');
    await expect(d1.getByRole('row', { name: /XYZ/ })).toBeVisible(READY);
    server.use('dist-faults');
    expect(await checkForUpdate(d1)).toEqual({ waiting: 'installed' });
    await reloadFromNotice(d1);
    await expect(d1.getByRole('heading', { name: 'This release must convert your journal before you can use it' })).toBeVisible(READY);
    await expectAccessible(d1, 'awaiting migration, not Writable');

    await d1.goto('/?faults=migration:validate');
    await expect(d1.getByRole('heading', { name: 'Your journal could not be converted to this release' })).toBeVisible(READY);
    await expectAccessible(d1, 'Migration Blocked');

    await d1.goto('/?faults=migration:hold');
    await expect(d1.getByRole('status')).toHaveText('Updating your journal to this release…', READY);
    await expectAccessible(d1, 'migrating');
    await d1.evaluate(() => window.__tjFaults?.release());
    await expect(d1.getByText('No open trades. Recording an entry on a Planned Trade opens it.')).toBeVisible(READY);
    await migrating.close();
  });

  test('should report no WCAG 2.1 AA violations on the entry form Not Found and Error states', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmReference(page);
    const tradePath = new URL(page.url()).pathname;
    await recordEntry(page, PC1);

    await page.goto('/trades/no-such-trade/record-entry');
    await expect(page.getByRole('heading', { name: 'Trade not found', level: 1 })).toBeVisible(READY);
    await expect(page.getByRole('link', { name: 'Back to Trades' })).toBeVisible();
    await expectAccessible(page, 'entry form Not Found');
    await context.close();

    // Error: a Position Change naming an Execution that does not exist, written before launch,
    // so the Trade's Detail cannot be assembled (the trigger B2.12 uses for the Open list).
    await writeIntegrityFixture(profile.dir, { kind: 'MissingMember', underlying: PLAN.symbol });
    const failing = await profile.launch();
    const errorPage = await firstPage(failing);
    await errorPage.goto(`${tradePath}/record-entry`);
    await expect(errorPage.getByText('We couldn’t load this entry form. Nothing was changed.')).toBeVisible(READY);
    await expect(errorPage.getByRole('button', { name: 'Retry' })).toBeVisible();
    await expectAccessible(errorPage, 'entry form Error');
    await failing.close();
  });

  test('should complete an entry with the keyboard only, with visible focus throughout', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmReference(page);

    await tabTo(page, page.getByRole('link', { name: 'Record entry' }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Record entry', level: 1 })).toBeVisible();
    // Focus follows the navigation: the new view's heading holds it, not the body.
    await expect.poll(() => activeHeading(page)).toBe('Record entry');
    const row = executionRow(page, 1);
    for (const [label, value] of [
      ['Quantity', '60'],
      ['Price', '50.10'],
      ['Fee', '1.00'],
    ] as const) {
      await tabTo(page, row.getByLabel(label));
      await page.keyboard.type(value);
    }
    const reflection = reflectionSection(page);
    const mode = reflection.getByRole('radiogroup', { name: 'Decision mode' });
    await tabTo(page, mode.getByLabel('As Planned'));
    await page.keyboard.press('Space');
    await expect(mode.getByLabel('As Planned')).toBeChecked();
    const emotion = reflection.getByRole('radiogroup', { name: 'Primary emotion' });
    await tabTo(page, emotion.getByLabel('Calm'));
    await page.keyboard.press('Space');
    await expect(emotion.getByLabel('Calm')).toBeChecked();
    const confidence = reflection.getByRole('radiogroup', { name: 'Decision confidence' });
    await tabTo(page, confidence.getByLabel('1'));
    await page.keyboard.press('Space');
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await expect(confidence.getByLabel('4')).toBeChecked();
    await tabTo(page, page.getByRole('button', { name: 'Save entry' }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Entry recorded' })).toBeVisible();
    await expect.poll(() => activeHeading(page)).toBe('Entry recorded');

    await tabTo(page, page.getByRole('link', { name: 'Back to the Trade' }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: 'Position', exact: true })).toContainText('60 shares of XYZ');
    await expect(page.locator('header .badge')).toHaveText('Open');
    await context.close();
  });
});
