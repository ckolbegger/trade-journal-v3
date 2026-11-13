import {
  backToTrade,
  confirmReference,
  detail,
  expect,
  factsOf,
  firstPage,
  onboardedPage,
  openDrawer,
  openTradeFromOpenList,
  PC1,
  PC2,
  PC3,
  probe,
  recordEntry,
  reflectionEntriesOf,
  test,
  tradesOf,
  workspaceOf,
} from './support.ts';

test.describe('B2.1 open a position', () => {
  test('should show Open, Position 60, two Lots, one Position Change with two Executions, and 60 of 100 after relaunch, with one Position Change, two Executions, and one Entry stored', async ({
    server,
    profile,
  }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmReference(page);
    await recordEntry(page, PC1);
    await context.close();

    const relaunched = await profile.launch();
    const again = await firstPage(relaunched);
    await again.goto('/');
    await openTradeFromOpenList(again);
    await expect(detail.lifecycleBadge(again)).toHaveText('Open');
    await openDrawer(again, 'Position');
    await expect(detail.position(again)).toContainText('60 shares of XYZ');
    await expect(detail.openLots(again).locator('tbody tr')).toHaveCount(2);
    const executions = detail.executions(again, 2);
    await expect(executions.getByRole('button')).toHaveCount(2);
    await executions.getByRole('button', { name: /^Buy 30 XYZ @ .* 10:00 details$/ }).click();
    await expect(executions).toContainText('2026-10-12 10:00 · 2 Executions');
    await openDrawer(again, 'Plan and Risk');
    await expect(detail.entryQuality(again)).toContainText('Entry not yet resolved: 60 of 100 entered');

    const workspace = workspaceOf(await probe(again))!;
    const [trade] = tradesOf(workspace);
    expect(tradesOf(workspace)).toHaveLength(1);
    expect(factsOf(trade!, 'PositionChange')).toHaveLength(1);
    expect(factsOf(trade!, 'Execution')).toHaveLength(2);
    expect(reflectionEntriesOf(workspace)).toHaveLength(1);
    await relaunched.close();
  });
});

test.describe('B2.2 scale-in and decline', () => {
  test('should show Entry Quality, an Entry Size Deviation of 20 naming its causing Position Change, and the declined reflection in the narrative', async ({
    server,
    profile,
  }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmReference(page);
    await recordEntry(page, PC1);
    await backToTrade(page);
    await recordEntry(page, PC2);
    await backToTrade(page);
    await recordEntry(page, PC3, { decline: 'Added into strength; reflecting later.' });
    await backToTrade(page);

    await openDrawer(page, 'Plan and Risk');
    const quality = detail.entryQuality(page);
    await expect(quality).toContainText('Position Change at 2026-10-12 11:00');
    await expect(quality).toContainText('$50.18');
    await expect(quality).toContainText('$270.00 1.08R');
    await expect(quality).toContainText('$580.00');
    await expect(quality).toContainText('2.15 planned 2.4');
    await expect(quality).toContainText('$18.00');
    await expect(detail.deviations(page)).toContainText(
      'Entry Size (Excess): 20 shares above plan, caused by the Position Change at 2026-10-12 14:00.',
    );
    await expect(detail.fulfillment(page)).toContainText('Filled with Deviation');
    await openDrawer(page, 'Journal');
    const journal = detail.journal(page);
    await expect(journal.getByText('Reflection declined')).toHaveCount(1);
    await expect(journal).toContainText('Added into strength; reflecting later.');
    await context.close();
  });
});

test.describe('C2.6 earlier-dated entry (P5)', () => {
  test('should say on the receipt that the Entry Size Deviation changed from 20 to 60 shares above plan, caused by the Position Change at 11:00', async ({
    server,
    profile,
  }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmReference(page);
    await recordEntry(page, PC1);
    await backToTrade(page);
    await recordEntry(page, [{ quantity: '60', price: '50.30', fee: '1.00', time: '2026-10-12T11:00' }]);
    await backToTrade(page);
    await openDrawer(page, 'Plan and Risk');
    await expect(detail.deviations(page)).toContainText('Entry Size (Excess): 20 shares above plan');

    await recordEntry(page, [{ quantity: '40', price: '50.15', fee: '1.00', time: '2026-10-12T10:30' }]);
    const receipt = page.getByRole('region', { name: 'Entry recorded', exact: true });
    await expect(receipt).toContainText(
      'Entry Size Deviation changed: now 60 shares above plan (was 20), caused by the Position Change at 2026-10-12 11:00.',
    );
    await expect(receipt).toContainText('This entry moved the Entry Resolution Point to the Position Change at 2026-10-12 10:30.');
    await expect(receipt).toContainText('This entry changed Entry Quality.');
    await context.close();
  });
});
