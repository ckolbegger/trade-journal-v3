import {
  BASE_URL, closeTheTrade, createTA, expect, factsOf, fillRows, firstPage, onboardedPage, openExitForm, openTradeFromOpenList, pinClock, probe, receiptResult, sell, spawnedBrowser, test,
  tradesOf, TUESDAY_1405, TUESDAY_1405_LOCAL, valueOf, workspaceOf,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

test.describe('B6.7 Kill after commit', () => {
  test('should keep the Closed lifecycle, the Sell Executions, the Close Reason, and both reflection outcomes after the browser is killed once a terminal exit’s result renders, and derive the same Lot Matches', async ({ profile }) => {
    test.setTimeout(240_000);
    let lotMatchesBefore: string;
    const killed = await spawnedBrowser(profile.dir, 9341);
    try {
      await pinClock(killed.context, TUESDAY_1405);
      const page = await onboardedPage(killed.context);
      await createTA(page);
      await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
      await openTradeFromOpenList(page, 'XYZ');
      await openExitForm(page);
      await fillRows(page, [sell('100', '53.00', '1.40', TUESDAY_1405_LOCAL)]);
      await closeTheTrade(page, 'now');
      await page.getByRole('button', { name: 'Save exit' }).click();
      // The result has rendered: the browser is killed right after.
      await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible();
      await expect(valueOf(receiptResult(page), 'Lifecycle')).toHaveText('Closed');
      // The Lot Matches are read from the receipt itself, with no further navigation before the kill.
      lotMatchesBefore = await page.getByRole('region', { name: 'Lot Matches' }).locator('tbody').innerText();
      expect(lotMatchesBefore).not.toBe('');
    } finally {
      await killed.kill();
    }

    const relaunched = await spawnedBrowser(profile.dir, 9342);
    try {
      await pinClock(relaunched.context, TUESDAY_1405);
      const page = await firstPage(relaunched.context);
      await page.goto(`${BASE_URL}/`);
      await page.getByRole('tab', { name: 'Closed' }).click();
      const row = page.getByRole('table', { name: 'Closed Trades' }).locator('tbody tr', { hasText: 'XYZ' });
      await expect(row).toContainText('Target Reached');
      await row.getByRole('link', { name: 'XYZ', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'XYZ', level: 1 })).toBeVisible();
      await expect(valueOf(page, 'Close Reason')).toHaveText('Target Reached');
      await expect(valueOf(page, 'Terminal Disposition')).toHaveText('Closed via sale of 100 shares');
      expect(await page.getByRole('table', { name: 'Lot Matches' }).locator('tbody').innerText()).toBe(lotMatchesBefore);
      // Both reflections are answered: nothing is owed.
      await expect(page.getByText('Reflection owed')).toHaveCount(0);
      await expect(page.getByText('Close Review owed')).toHaveCount(0);

      const workspace = workspaceOf(await probe(page))!;
      const [trade] = tradesOf(workspace);
      expect(trade!.lifecycle).toBe('Closed');
      const executions = factsOf(trade!, 'Execution').map((f) => f.versions.at(-1)!.value);
      expect(executions.filter((e) => e['action'] === 'Sell').map((e) => e['quantity'])).toEqual(['100']);
      const closeReasons = (trade as unknown as { closeReasonFacts: { kind: string }[] }).closeReasonFacts;
      expect(closeReasons.map((f) => f.kind)).toEqual(['CloseReason']);
      // Both reflection outcomes of the exit: its own reflection (the third Position Change Reflection after PC1's and PC2's) and the Close Review.
      const entries = (workspace.stores['journalEntries'] ?? []) as { entryTypeKey: string }[];
      expect(entries.filter((e) => /close-review/.test(e.entryTypeKey))).toHaveLength(1);
      expect(entries.filter((e) => /position-change-reflection/.test(e.entryTypeKey))).toHaveLength(3);
    } finally {
      await relaunched.kill();
    }
  });
});
