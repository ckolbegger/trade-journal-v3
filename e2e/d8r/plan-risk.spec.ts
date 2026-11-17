import { buildOc3Plus, detail, expect, FRIDAY_1200, openBreachedStockTrade, openDetailAt, openDrawer, test } from './support.ts';

test.use({ actionTimeout: 15_000 });

// B8R.4 (plan section 7.2): O-C3+ (O-C3 and one more contract bought Fri 10-16 11:00 at $3.30, fee $0.65, which is an Entry Size Deviation) at Fri 12:00. Plan and
// Risk holds seven groups in this order: Plan, Since the last Marks (W23, which T8R.12-F1 placed before Conditions), Conditions (W31, W32), Plan Baseline,
// Entry Quality, Planned-Leg Fulfillment and Deviations last. Then See Plan and Risk in the Journal (W24) selects that drawer and focuses Deviations.
const PANEL = '#drawer-panel-plan-and-risk';
const GROUPS = ['Plan', 'Since the last Marks', 'Conditions', 'Plan Baseline', 'Entry Quality', 'Planned-Leg Fulfillment', 'Deviations'];

test.describe('B8R.4 Plan and Risk and the Journal line', () => {
  test('should list the groups in order with W23 and W31, then land on Deviations when See Plan and Risk is pressed in the Journal', async ({ profile }) => {
    test.setTimeout(600_000);
    const trade = await buildOc3Plus(profile);
    const { context, page } = await openDetailAt(profile, FRIDAY_1200, trade);

    await test.step('the groups, in order, Deviations last', async () => {
      await openDrawer(page, 'Plan and Risk');
      await expect(page.locator(`${PANEL} h2`)).toHaveText(GROUPS);
    });

    await test.step('W23: New lots, Average price of new lots, Risk from that price and Reward from that price', async () => {
      const group = detail.root(page).getByRole('region', { name: 'Since the last Marks', exact: true });
      await expect(group.locator('dt')).toHaveText(['New lots', 'Average price of new lots', 'Risk from that price', 'Reward from that price']);
      await expect(group.locator('dt:text-is("New lots") + dd')).toHaveText('1 contract');
      await expect(group.locator('dt:text-is("Average price of new lots") + dd')).toHaveText('$3.30');
      // From the $3.30 entry: the option Stop at 1.00 risks (3.30 - 1.00) x 100 = $230.00, 1.15R of 1R $200.00; the Target at XYZ 60.00 moves the call to its 5.00 at
      // expiration, (5.00 - 3.30) x 100 = $170.00, 0.85R.
      await expect(group.locator('dt:text-is("Risk from that price") + dd')).toHaveText('$230.00 · 1.15R');
      await expect(group.locator('dt:text-is("Reward from that price") + dd')).toHaveText('$170.00 · 0.85R');
    });

    await test.step('W31: the Conditions group, with its four columns, one row per condition, and the notes beneath', async () => {
      const table = detail.root(page).getByRole('region', { name: 'Conditions table', exact: true }).getByRole('table');
      await expect(table.locator('thead th')).toHaveText(['Condition', 'Distance', 'Risk or reward', 'Value at expiration']);
      await expect(table.locator('tbody tr')).toHaveCount(2);
      await expect(detail.riskToStop(page)).toHaveText(/^Risk to stop \$[\d,]+\.\d\d · \d+\.\d\dR$/);
      await expect(detail.rewardToTarget(page)).toHaveText(/^Reward to target \$[\d,]+\.\d\d · \d+\.\d\dR$/);
      await expect(detail.planRiskNotes(page).locator('li', { hasText: 'Worst case:' })).toHaveCount(1);
      await expect(detail.planRiskNotes(page).locator('li', { hasText: 'Max reward:' })).toHaveCount(1);
    });

    await test.step('the Journal line (W24) names the one active Deviation, and its button lands on Deviations', async () => {
      await openDrawer(page, 'Journal');
      const journal = page.locator('#drawer-panel-journal');
      // W24: the line "1 active Deviation." with the button "See Plan and Risk" beside it.
      await expect(journal.locator('p.journal-deviations')).toHaveText('1 active Deviation. See Plan and Risk');
      const button = journal.getByRole('button', { name: 'See Plan and Risk' });
      await expect(button).toBeVisible();
      await button.click();
      await expect(page.getByRole('tablist', { name: 'Detail' }).getByRole('tab', { selected: true })).toHaveText('Plan and Risk');
      await expect(page.locator(PANEL)).toBeVisible();
      await expect(page.locator(`${PANEL} h2:text-is("Deviations")`)).toBeFocused();
    });
    await context.close();
  });

  test('should word a breached Stop in the Conditions group as "Breached · $0.50 past" and "Risk to stop $50.00 · 0.20R past" (W32)', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page } = await openBreachedStockTrade(profile);
    await openDrawer(page, 'Plan and Risk');
    const table = detail.root(page).getByRole('region', { name: 'Conditions table', exact: true });
    await expect(table.getByRole('cell', { name: 'Breached · $0.50 past', exact: true })).toBeVisible();
    await expect(detail.riskToStop(page)).toHaveText('Risk to stop $50.00 · 0.20R past');
    await context.close();
  });
});
