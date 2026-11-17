import { buildOc3, buildOc3BeforeMarks, detail, expect, FRIDAY_1200, MONDAY_1200, openDetailAt, openDrawer, SATURDAY_1000, test, THURSDAY_1800 } from './support.ts';

test.use({ actionTimeout: 15_000 });

// B8R.1 (plan section 7.2): O-C3 through the UI, its Detail opened at Thu 18:00, Fri 12:00, Sat 10:00, and (a second Trade) at Mon 10-12 12:00 before the first
// Marks. W29's headings and cells per A232 and A233. O-C3's Marks (plan section 5): Wed 57.40 and 2.90, Thu 57.90 and 3.20; Tuesday and Friday have none.
test.describe('B8R.1 Today on an Open Trade', () => {
  test('should show the Marks table dated by the session at Thu 18:00, Fri 12:00 and Sat 10:00, with a note under it only when one applies', async ({ profile }) => {
    test.setTimeout(540_000);
    const trade = await buildOc3(profile, { thursdayHold: true });

    await test.step('Thu 18:00: Today is Thursday, Yesterday Wednesday, each Instrument with its Marks and its change', async () => {
      const { context, page } = await openDetailAt(profile, THURSDAY_1800, trade);
      await expect(detail.marksHeadings(page)).toHaveText(['Today, Thu Oct 15', 'Yesterday, Wed Oct 14', 'Change']);
      await expect(detail.marksTable(page).locator('tbody th')).toHaveText(['XYZ Mark', 'Call Mark']);
      await expect(detail.marksTable(page).locator('tbody tr').nth(0).locator('td')).toHaveText(['57.90', '57.40', '+0.50']);
      await expect(detail.marksTable(page).locator('tbody tr').nth(1).locator('td')).toHaveText(['$3.20', '$2.90', '+$0.30']);
      // The Stale context and an acknowledgment only when they apply: neither does, so nothing stands under the table.
      await expect(detail.marksNotes(page)).toHaveCount(0);
      // Gone (P116, T8R.9): the figure cards that Today's table replaced, and the old Mark rows.
      await expect(detail.todayCard(page, 'At entry')).toHaveCount(0);
      await expect(detail.todayCard(page, 'At the Thu Oct 15 Marks')).toHaveCount(0);
      for (const term of ['Expected Mark Date', 'Source', 'Saved']) await expect(detail.root(page).locator('#drawer-panel-today dt', { hasText: term })).toHaveCount(0);
      await context.close();
    });

    await test.step('Fri 12:00: Friday has not closed, so every Today cell and Change read a dash and Thursday is Yesterday', async () => {
      const { context, page } = await openDetailAt(profile, FRIDAY_1200, trade);
      await expect(detail.marksHeadings(page)).toHaveText(['Today, Fri Oct 16', 'Yesterday, Thu Oct 15', 'Change']);
      await expect(detail.marksTable(page).locator('tbody tr').nth(0).locator('td')).toHaveText(['—', '57.90', '—']);
      await expect(detail.marksTable(page).locator('tbody tr').nth(1).locator('td')).toHaveText(['—', '$3.20', '—']);
      await expect(detail.marksNotes(page)).toHaveCount(0);
      await context.close();
    });

    await test.step('Sat 10:00: the next session heads Today, Friday is Yesterday, and Friday had no Marks so its column is dashes, never Thursday', async () => {
      const { context, page } = await openDetailAt(profile, SATURDAY_1000, trade);
      await expect(detail.marksHeadings(page)).toHaveText(['Next session, Mon Oct 19', 'Yesterday, Fri Oct 16', 'Change']);
      await expect(detail.marksTable(page).locator('tbody tr').nth(0).locator('td')).toHaveText(['—', '—', '—']);
      await expect(detail.marksTable(page).locator('tbody tr').nth(1).locator('td')).toHaveText(['—', '—', '—']);
      await expect(detail.marksTable(page)).not.toContainText('57.90');
      await expect(detail.marksTable(page)).not.toContainText('3.20');
      await openDrawer(page, 'Today');
      await context.close();
    });
  });

  test('should show dashes in both columns beside the No Marks yet note on Mon 10-12 12:00, before the first Marks', async ({ profile }) => {
    test.setTimeout(420_000);
    const trade = await buildOc3BeforeMarks(profile);
    const { context, page } = await openDetailAt(profile, MONDAY_1200, trade);
    await expect(detail.marksHeadings(page)).toHaveText(['Today, Mon Oct 12', 'Yesterday, Fri Oct 9', 'Change']);
    await expect(page.locator('#drawer-panel-today').getByText(/^No Marks yet\./)).toBeVisible();
    await expect(detail.marksTable(page).locator('tbody tr').nth(0).locator('td')).toHaveText(['—', '—', '—']);
    await expect(detail.marksTable(page).locator('tbody tr').nth(1).locator('td')).toHaveText(['—', '—', '—']);
    await context.close();
  });
});
