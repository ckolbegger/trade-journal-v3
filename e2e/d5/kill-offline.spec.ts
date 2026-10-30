import {
  answerDebt, AT_10, backToTrade, BASE_URL, confirmReference, continueToTrades, debtsOf, deferEntry, enterMark, entriesWithSettledDebt, expect, fillDebtAnswers, firstPage, launchAt, markAndOpenCard, MONDAY, MONDAY_1005,
  onboardedAt, onboardedPage, openReview, pinClock, probe, reflectionsOf, spawnedBrowser, test, TUESDAY, TUESDAY_1700, tradesFamily, workspaceOf,
} from './support.ts';

const NOT_WRITABLE = { name: /Read only/ };

test.describe('B5.7 Kill after commit', () => {
  test('should keep the Entry and the Settled version after the browser is killed once a Debt answer’s result renders, and no longer list the reflection in the Review', async ({ profile }) => {
    const killed = await spawnedBrowser(profile.dir, 9341);
    try {
      await pinClock(killed.context, TUESDAY_1700);
      const page = await onboardedPage(killed.context);
      await confirmReference(page);
      await deferEntry(page, [AT_10]);
      await openReview(page);
      await enterMark(page, 'XYZ', MONDAY, '52.00');
      await markAndOpenCard(page, 'XYZ', TUESDAY, '52.50');
      await expect(reflectionsOf(page, 'XYZ').getByText('Due', { exact: true })).toBeVisible();
      await reflectionsOf(page, 'XYZ').getByRole('button', { name: /^Reflect on / }).click();
      await fillDebtAnswers(page);
      // answerDebt returns once the saved result has rendered; the browser is killed right after.
      await answerDebt(page);
    } finally {
      await killed.kill();
    }

    const relaunched = await spawnedBrowser(profile.dir, 9342);
    try {
      await pinClock(relaunched.context, TUESDAY_1700);
      const page = await firstPage(relaunched.context);
      await page.goto(`${BASE_URL}/`);
      await openReview(page);
      await continueToTrades(page);
      await tradesFamily(page).getByRole('button', { name: 'Review XYZ' }).click();
      await expect(page.getByRole('region', { name: 'XYZ review', exact: true })).toBeVisible();
      await expect(reflectionsOf(page, 'XYZ')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Reflect on / })).toHaveCount(0);

      const workspace = workspaceOf(await probe(page))!;
      const debts = debtsOf(workspace);
      expect(debts).toHaveLength(1);
      expect(JSON.stringify(debts[0]!.versions.at(-1))).toContain('Settled');
      const settled = entriesWithSettledDebt(workspace);
      expect(settled).toHaveLength(1);
      expect(settled[0]!.settledDebtId).toBe(debts[0]!.debtId);
    } finally {
      await relaunched.kill();
    }
  });
});

test.describe('B5.8 Offline cold restart (AC-DEL-001)', () => {
  test('should record a deferred entry and answer it on Trade Detail offline, and keep both across another offline restart', async ({ server, profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1005);
    await confirmReference(page);
    const detailPath = new URL(page.url()).pathname;
    await context.close();
    // Network disabled: offline emulation plus no server for the origin at all.
    await server.close();

    const offline = await launchAt(profile, MONDAY_1005, { offline: true });
    const first = await firstPage(offline);
    await first.goto(detailPath);
    await expect(first.getByRole('region', NOT_WRITABLE)).toHaveCount(0);
    await deferEntry(first, [AT_10]);
    await backToTrade(first);
    await expect(first.getByText('Reflection owed')).toBeVisible();
    await first.getByRole('button', { name: 'Reflect now' }).click();
    await fillDebtAnswers(first);
    await answerDebt(first);
    await expect(first.getByText('Deferred, answered', { exact: true })).toBeVisible();
    await offline.close();

    // Another offline restart: the Position Change, the Debt, and its answer survive.
    const again = await launchAt(profile, MONDAY_1005, { offline: true });
    const reopened = await firstPage(again);
    await reopened.goto(detailPath);
    await expect(reopened.getByRole('region', NOT_WRITABLE)).toHaveCount(0);
    await expect(reopened.getByText('Deferred, answered', { exact: true })).toBeVisible();
    await expect(reopened.getByText('Reflection owed')).toHaveCount(0);
    const workspace = workspaceOf(await probe(reopened))!;
    expect(debtsOf(workspace)).toHaveLength(1);
    expect(entriesWithSettledDebt(workspace)).toHaveLength(1);
    await expect(reopened.getByRole('region', { name: 'Position', exact: true })).toContainText('100 shares of XYZ');
    await again.close();
  });
});
