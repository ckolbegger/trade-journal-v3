import type { Page } from '@playwright/test';
import {
  addK1, ALL_DRAWERS, buildOs2x, confirmOc3, confirmReference, detail, expect, firstPage, launchAt, MONDAY_0900, MONDAY_NOV_1700, onboardedAt, onboardedPage, openDrawer, PC1, READY, recordEntry,
  recordExpiration, test, writeIntegrityFixture,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// B8R.2 (plan section 7.2): Today on every state. O-S2X at Mon 11-23 (Settlement Due), then expired and recorded (Closed); K1 Closed by sale; a Planned Trade; D2's incoherent
// fixture. W1 (amended) per state: the drawers each shows and the one selected; W25 ("Expired", named "Expired Fri Nov 20"), W26 (the second column's heading) and W30
// (the "Closed" stamp, read by the accessibility tree). A Closed Trade's Exit column is dated by the session that holds the final exit (decision P1, T8R.7-B1).
type TabName = 'Today' | 'Replay' | 'Position' | 'Plan and Risk' | 'Price History' | 'Journal' | 'Payoff';
const PANEL = (name: TabName): string => `#drawer-panel-${name.toLowerCase().replaceAll(' ', '-')}`;

async function expectDrawers(page: Page, shown: readonly (string | RegExp)[], gone: readonly TabName[], selected: TabName): Promise<void> {
  const tabs = page.getByRole('tablist', { name: 'Detail' });
  await expect(tabs.getByRole('tab')).toHaveText([...shown]);
  await expect(tabs.getByRole('tab', { selected: true })).toHaveText(selected);
  await expect(page.locator(PANEL(selected))).toBeVisible();
  for (const name of gone) {
    await expect(tabs.getByRole('tab', { name, exact: true })).toHaveCount(0);
    await expect(page.locator(PANEL(name))).toHaveCount(0);
  }
}

// The "Closed" stamp is real text in the accessibility tree: the Today panel's tree contains it, and it has no aria-hidden ancestor.
async function expectClosedStamp(page: Page): Promise<void> {
  const today = page.locator(PANEL('Today'));
  await expect(today.getByText('Closed', { exact: true })).toBeVisible();
  expect(await today.ariaSnapshot(), 'the accessibility tree of Today').toMatch(/^\s*- paragraph: Closed$/m);
  expect(await today.getByText('Closed', { exact: true }).evaluate((stamp) => stamp.closest('[aria-hidden="true"]') === null)).toBe(true);
}

test.describe('B8R.2 Today on every state', () => {
  test('should show Today on O-S2X Settlement Due with "Expired Fri Nov 20", then Closed by expiration with "Expired Fri Nov 20" as its column and the "Closed" stamp', async ({ profile }) => {
    test.setTimeout(420_000);
    const trade = await buildOs2x(profile);
    const context = await launchAt(profile, MONDAY_NOV_1700);
    const page = await firstPage(context);
    await page.goto(`/trades/${trade.tradeId}`);
    await expect(detail.settlementDueHeading(page)).toBeVisible(READY);
    // W1 (amended): a Settlement Due Detail shows all six drawers and opens on Today.
    await expectDrawers(page, [...ALL_DRAWERS], [], 'Today');
    // W29 and W25: Mon Nov 23 is after the put's Fri Nov 20 expiration, so its Today cell is "Expired", never a price, and a screen reader hears the date.
    await expect(detail.marksHeadings(page)).toHaveText(['Today, Mon Nov 23', 'Yesterday, Fri Nov 20', 'Change']);
    await expect(detail.marksTable(page).locator('tbody th')).toHaveText(['MNO Mark', 'Put Mark']);
    await expect(detail.marksCell(page, 'Put Mark', 'Today')).toHaveText('Expired');
    await expect(detail.marksCell(page, 'Put Mark', 'Today')).toHaveAccessibleName('Expired Fri Nov 20');
    await expect(detail.marksCell(page, 'Put Mark', 'Change')).toHaveText('—');
    await expect(page.locator(PANEL('Today')).getByText('Expired', { exact: true })).toHaveCount(1);
    // No price tracks on a Settlement Due Trade, and no Closed stamp.
    await expect(page.locator(`${PANEL('Today')} h2:text-is("Where the prices sit")`)).toHaveCount(0);
    await expect(page.locator(PANEL('Today')).getByText('Closed', { exact: true })).toHaveCount(0);

    // Recording the expiration closes the Trade: W1 (amended) still shows Today first, now with the stamp (W30) and W26's second heading.
    await detail.recordExpirationLink(page).click();
    await recordExpiration(page);
    await page.getByRole('link', { name: 'Back to the Trade' }).click();
    await expect(detail.heading(page, 'MNO')).toBeVisible(READY);
    await expectDrawers(page, ['Today', 'Replay', 'Position', 'Plan and Risk', /^Price History( \d+)?$/, /^Journal/, 'Payoff'], [], 'Today');
    await expect(detail.lifecycleBadge(page)).toHaveText('Cash-Secured Put, Closed');
    await expect(detail.marksHeadings(page)).toHaveText(['Today, Mon Nov 23', 'Expired Fri Nov 20', 'Change']);
    await expect(detail.marksCell(page, 'Put Mark', 'Today')).toHaveText('');
    await expect(detail.marksCell(page, 'MNO Mark', 'Today')).toHaveText('');
    await expect(detail.marksCell(page, 'Put Mark', 'Yesterday')).toHaveText('Expired');
    await expect(detail.marksCell(page, 'Put Mark', 'Yesterday')).toHaveAccessibleName('Expired Fri Nov 20');
    await expect(detail.marksCell(page, 'Put Mark', 'Change')).toHaveText('—');
    await expectClosedStamp(page);
    await context.close();
  });

  test('should show K1 Closed by sale with "Exit Fri Nov 13", its final exit price, an empty Today column and the "Closed" stamp', async ({ profile }) => {
    test.setTimeout(420_000);
    const { context: first } = await onboardedAt(profile, MONDAY_0900);
    await first.close();
    const k1 = await addK1(profile);
    const context = await launchAt(profile, MONDAY_NOV_1700);
    const page = await firstPage(context);
    await page.goto(`/trades/${k1.tradeId}`);
    await expect(detail.heading(page, 'NVDA')).toBeVisible(READY);
    await expect(detail.lifecycleBadge(page)).toHaveText('Long Call, Closed');
    await expectDrawers(page, ['Today', 'Replay', 'Position', 'Plan and Risk', /^Price History( \d+)?$/, /^Journal/, 'Payoff'], [], 'Today');
    // W26: the second column is headed by the session of the final exit (decision P1), and its option cell is the final exit's price.
    await expect(detail.marksHeadings(page)).toHaveText(['Today, Mon Nov 23', 'Exit Fri Nov 13', 'Change']);
    await expect(detail.marksTable(page).locator('tbody th')).toHaveText(['NVDA Mark', 'Call Mark']);
    await expect(detail.marksCell(page, 'Call Mark', 'Yesterday')).toHaveText('$12.40');
    await expect(detail.marksCell(page, 'Call Mark', 'Today')).toHaveText('');
    await expect(detail.marksCell(page, 'NVDA Mark', 'Today')).toHaveText('');
    await expect(detail.marksCell(page, 'Call Mark', 'Change')).toHaveText('—');
    await expect(detail.marksCell(page, 'NVDA Mark', 'Change')).toHaveText('—');
    // Sold before the Fri Nov 13 close, so no Mark was held for the Underlying at that session: a dash, never another session's price.
    await expect(detail.marksCell(page, 'NVDA Mark', 'Yesterday')).toHaveText('—');
    await expectClosedStamp(page);
    await context.close();
  });

  test('should show a Planned Trade with Plan and Risk, Journal and Payoff only, opening on Plan and Risk, with no Today', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await onboardedAt(profile, MONDAY_0900);
    await confirmOc3(page);
    await expect(detail.lifecycleBadge(page)).toHaveText('Long Call, Planned');
    await expectDrawers(page, ['Plan and Risk', /^Journal/, 'Payoff'], ['Today', 'Position', 'Price History'], 'Plan and Risk');
    await openDrawer(page, 'Plan and Risk');
    await expect(detail.marksTable(page)).toHaveCount(0);
    await context.close();
  });

  test('should show an incoherent Detail with Position, Plan and Risk and Journal only, opening on Position, and no Today', async ({ profile }) => {
    test.setTimeout(240_000);
    // D2's incoherent fixture: an Open Trade whose Execution names a Planned Leg that is not in the Plan, edited into the stored records before launch.
    const setup = await profile.launch();
    const setupPage = await onboardedPage(setup);
    await confirmReference(setupPage);
    await recordEntry(setupPage, PC1);
    await setup.close();
    await writeIntegrityFixture(profile.dir, { kind: 'UnknownPlannedLeg', underlying: 'XYZ' });

    const context = await profile.launch();
    const page = await firstPage(context);
    await page.goto('/');
    await page.getByRole('row', { name: /XYZ/ }).getByRole('link', { name: 'XYZ', exact: true }).click();
    await expect(detail.heading(page, 'XYZ')).toBeVisible(READY);
    await expect(detail.factsIncoherent(page)).toBeVisible();
    await expectDrawers(page, ['Position', 'Plan and Risk', 'Journal'], ['Today', 'Price History', 'Payoff'], 'Position');
    await expect(detail.marksTable(page)).toHaveCount(0);
    await context.close();
  });
});
