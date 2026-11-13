import {
  answerIn, closeReviewGroup, completion, createSettlementFixture, createShortPutTrade, detail, expect, factsOf, firstPage, FRIDAY_NOV_1700, launchAt, onboardedAt, openDrawer, openReview, openSettlement, probe, READY, test,
  tradesOf, TUESDAY_1030, workspaceOf,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

const READ_ONLY = "Read only: this browser can't save right now";

test.describe('B7.10 Recovery Only (faults build)', () => {
  test('should keep the lists, option Detail, both payoff views and the Review readable with no Record expiration, Record entry, or Plan confirmation, and leave the probe unchanged', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, TUESDAY_1030);
    const { t1, t3 } = await createSettlementFixture(setupPage);
    const before = await probe(setupPage);
    await setup.close();

    const context = await launchAt(profile, FRIDAY_NOV_1700);
    const page = await firstPage(context);
    await page.goto('/?faults=control');
    await expect(page.getByRole('region', { name: READ_ONLY })).toBeVisible(READY);

    // The Open list names the option Trades; the Long Call's Detail shows both payoff views and its Settlement Due, with no write link.
    // (Navigation stays inside the app: a new page load without ?faults=control would be Writable again.)
    const openTrades = page.getByRole('table', { name: 'Open Trades' });
    await expect(openTrades).toBeVisible(READY);
    await expect(openTrades.locator('tbody tr', { hasText: 'MNO' })).toBeVisible();
    await openTrades.locator('tbody tr', { hasText: 'XYZ 20 Nov 2026 55 Call' }).getByRole('link', { name: 'XYZ', exact: true }).click();
    await expect(detail.heading(page, 'XYZ')).toBeVisible(READY);
    await openDrawer(page, 'Payoff');
    await expect(detail.payoff(page, 'Planned')).toContainText('Breakeven 57.00');
    await expect(detail.payoff(page, 'Current')).toBeVisible();
    await expect(detail.settlementDueHeading(page)).toBeVisible();
    for (const link of [detail.recordExpirationLink(page), detail.recordEntryLink(page), detail.recordExitLink(page)]) await expect(link).toHaveCount(0);

    // The write route is dropped: no New Plan to confirm from.
    await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'New Plan' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Confirm Plan' })).toHaveCount(0);

    // The Review and its settlement family are readable, with no Record expiration on a card.
    await openReview(page);
    await expect(completion(page)).toHaveText('Incomplete');
    const panel = await openSettlement(page, t1);
    await expect(panel).toContainText('XYZ 20 Nov 2026 55 Call');
    await expect(panel.getByRole('link', { name: 'Record expiration' })).toHaveCount(0);
    await expect((await openSettlement(page, t3)).getByRole('link', { name: 'Record expiration' })).toHaveCount(0);

    expect(await probe(page)).toEqual(before);
    await context.close();
  });
});

test.describe('B7.11 Mid-session failure (faults build, AC-DEL-006)', () => {
  test('should explain RuntimeNotWritable, keep the typed expiration and its answers, and record no Position Change', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, FRIDAY_NOV_1700);
    await createShortPutTrade(setupPage);
    await setup.close();

    const context = await launchAt(profile, FRIDAY_NOV_1700);
    const page = await firstPage(context);
    await page.goto('/');
    await page.getByRole('table', { name: 'Open Trades' }).getByRole('link', { name: 'MNO', exact: true }).click();
    await detail.recordExpirationLink(page).click();
    await expect(page.getByRole('heading', { name: 'Expiration', level: 1 })).toBeVisible(READY);
    const reflection = page.getByRole('region', { name: 'Reflection on this expiration' });
    await answerIn(reflection);
    await closeReviewGroup(page).getByLabel('Reflect later').check();
    const before = workspaceOf(await probe(page))!;

    await page.evaluate(() => window.__tjFaults?.set(['inventory']));
    await page.getByRole('button', { name: 'Save expiration' }).click();

    const banner = page.getByRole('region', { name: READ_ONLY });
    await expect(banner).toBeVisible(READY);
    await expect(banner.getByRole('listitem')).toHaveText(["The app's offline copy is missing or damaged, so it could not reopen without a network."]);
    // The form is still there with every answer, and nothing was recorded.
    await expect(page.getByRole('heading', { name: 'Expiration', level: 1 })).toBeVisible();
    await expect(reflection.getByRole('radiogroup', { name: 'Decision mode' }).getByLabel('As Planned')).toBeChecked();
    await expect(reflection.getByRole('radiogroup', { name: 'Primary emotion' }).getByLabel('Calm')).toBeChecked();
    await expect(closeReviewGroup(page).getByLabel('Reflect later')).toBeChecked();
    await expect(page.getByRole('heading', { name: 'Expiration recorded', level: 1 })).toHaveCount(0);
    const workspace = workspaceOf(await probe(page))!;
    const [trade] = tradesOf(workspace);
    expect(trade!.lifecycle).toBe('Open');
    expect(factsOf(trade!, 'Expiration')).toEqual([]);
    expect(factsOf(trade!, 'PositionChange')).toHaveLength(1);
    expect(workspace).toEqual(before);
    await context.close();
  });
});
