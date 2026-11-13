import {
  BASE_URL, createShortPutTrade, detail, entriesOf, expect, factsOf, firstPage, FRIDAY_NOV_1700, onboardedPage, pinClock, probe, receiptResult, recordExpiration, spawnedBrowser, test, tradesOf, valueOf, workspaceOf,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

test.describe('B7.8 Kill after commit', () => {
  test('should keep the Closed lifecycle, the Expiration, and both reflection outcomes after the browser is killed once an Expiration result renders', async ({ profile }) => {
    test.setTimeout(300_000);
    const killed = await spawnedBrowser(profile.dir, 9341);
    try {
      await pinClock(killed.context, FRIDAY_NOV_1700);
      const page = await onboardedPage(killed.context);
      await createShortPutTrade(page);
      await detail.recordExpirationLink(page).click();
      await recordExpiration(page, 'now');
      // The result has rendered: the browser is killed right after.
      await expect(valueOf(receiptResult(page), 'Lifecycle')).toHaveText('Closed');
    } finally {
      await killed.kill();
    }

    const relaunched = await spawnedBrowser(profile.dir, 9342);
    try {
      await pinClock(relaunched.context, FRIDAY_NOV_1700);
      const page = await firstPage(relaunched.context);
      await page.goto(`${BASE_URL}/`);
      await page.getByRole('tab', { name: 'Closed' }).click();
      const row = page.getByRole('table', { name: 'Closed Trades' }).locator('tbody tr', { hasText: 'MNO' });
      await expect(row).toBeVisible();
      await row.getByRole('link', { name: 'MNO', exact: true }).click();
      await expect(detail.heading(page, 'MNO')).toBeVisible();
      await expect(detail.resultValue(page, 'Terminal Disposition')).toHaveText('Closed via expiration of 2 contracts');
      // Both reflections are answered: nothing is owed.
      await expect(detail.anywhere(() => detail.reflectionOwed(page))).toHaveCount(0);
      await expect(detail.anywhere(() => detail.closeReviewOwed(page))).toHaveCount(0);

      const workspace = workspaceOf(await probe(page))!;
      const [trade] = tradesOf(workspace);
      expect(trade!.lifecycle).toBe('Closed');
      expect(factsOf(trade!, 'Expiration')).toHaveLength(1);
      expect(factsOf(trade!, 'Execution')).toHaveLength(1);
      // Both reflection outcomes: the expiration's own reflection (after the entry's) and the answered Close Review.
      const entries = entriesOf(workspace);
      expect(entries.filter((e) => /close-review/.test(e.entryTypeKey))).toHaveLength(1);
      expect(entries.filter((e) => /position-change-reflection/.test(e.entryTypeKey))).toHaveLength(2);
    } finally {
      await relaunched.kill();
    }
  });
});
