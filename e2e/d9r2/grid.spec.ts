import { marksPanelOf, confirmOptionPlan, createGapFixture, currentTradeId, enterMark, expect, MONDAY_1700, OC, OCT_12, OCT_8, OCT_9, onboardedAt, openReview, recordOptionEntry, setClock, test } from './support.ts';

test.use({ actionTimeout: 15_000 });

const CALL = 'XYZ Nov 20 $55 Call';
const THURSDAY_OCT_8_1700 = '2026-10-08T21:00:00Z';
const EARLIER = "Earlier sessions don't block the Review.";

test.describe('B9R2.2 The Marks grid', () => {
  test('should show the Review Date and Previous columns with their tags, earlier gaps and an acknowledged session as columns, Not held, 20 sessions a page with the fixed columns, W72, and a Missing-Mark link that focuses the Review Date cell', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page, tA, tF } = await createGapFixture(profile);

    await test.step('rows, columns and tags', async () => {
      const marks = await marksPanelOf(page, tA);
      const grid = marks.getByRole('region', { name: 'Marks by session' });
      await expect(grid.locator('tbody th')).toHaveText(['XYZ Mark']);
      await expect(grid.locator('thead th').first()).toHaveText('Session');
      await expect(grid.locator('thead em')).toHaveText(['Review Date', 'Previous']);
      // Newest on the left: the Review Date, the previous session, then the earlier sessions that lack a Mark (Tue Oct 6 holds one, so it is no column).
      const sessions = await grid.locator('thead th[data-session]').evaluateAll((heads) => heads.map((head) => head.getAttribute('data-session')));
      expect(sessions.slice(0, 5)).toEqual(['2026-10-12', '2026-10-09', '2026-10-08', '2026-10-07', '2026-10-05']);
      // The Review Date and the missing earlier sessions take a price; the acknowledged one is words, pressed to open its editor.
      for (const date of [OCT_12, OCT_9, OCT_8, 'Mon Oct 5']) await expect(grid.getByRole('textbox', { name: `XYZ Mark, ${date}`, exact: true })).toHaveValue('');
      await expect(grid.getByRole('button', { name: 'XYZ Mark, Wed Oct 7', exact: true })).toHaveText('Acknowledged Unavailable');
      await expect(grid.getByRole('img', { name: 'Not held' })).toHaveCount(0);
      // W72, under the grid when earlier columns show.
      await expect(marks.getByText(EARLIER)).toBeVisible();
      await expect(marks).not.toContainText('Earlier sessions without Marks');
    });

    await test.step('20 sessions a page, the fixed columns on every page (A296)', async () => {
      const marks = await marksPanelOf(page, tA);
      const grid = marks.getByRole('region', { name: 'Marks by session' });
      const heads = grid.locator('thead th[data-session]');
      await expect(marks.getByText('Sessions 1 to 20 of 27')).toBeVisible();
      await expect(heads).toHaveCount(22);
      await expect(marks.getByRole('button', { name: 'Previous page' })).toHaveCount(0);
      await marks.getByRole('button', { name: 'Next page' }).click();
      await expect(marks.getByText('Sessions 21 to 27 of 27')).toBeVisible();
      await expect(heads).toHaveCount(9);
      await expect(grid.locator('thead em')).toHaveText(['Review Date', 'Previous']);
      await expect(heads.first()).toHaveAttribute('data-session', '2026-10-12');
      await expect(heads.last()).toHaveAttribute('data-session', '2026-08-31');
      await expect(marks.getByRole('button', { name: 'Next page' })).toHaveCount(0);
      await marks.getByRole('button', { name: 'Previous page' }).click();
      await expect(marks.getByText('Sessions 1 to 20 of 27')).toBeVisible();
    });

    await test.step('Not held: a Trade that bought on the Review Date holds nothing before it', async () => {
      const marks = await marksPanelOf(page, tF);
      const grid = marks.getByRole('region', { name: 'Marks by session' });
      await expect(grid.locator('thead th[data-session]')).toHaveCount(2);
      const notHeld = grid.getByRole('img', { name: 'Not held' });
      await expect(notHeld).toHaveCount(1);
      await expect(notHeld).toHaveText('—');
      await expect(grid.getByRole('textbox', { name: `XYZ Mark, ${OCT_12}`, exact: true })).toBeVisible();
      // No earlier column, so no words about earlier sessions.
      await expect(marks).not.toContainText(EARLIER);
    });

    await test.step('a Missing-Mark link focuses the Review Date cell', async () => {
      await page.getByRole('list', { name: 'Blockers' }).getByRole('link', { name: 'XYZ', exact: true }).click();
      await expect(page.getByRole('textbox', { name: `XYZ Mark, ${OCT_12}`, exact: true })).toBeFocused();
      await expect(page.getByRole('region', { name: `XYZ Mark, ${OCT_12}`, exact: true })).toBeVisible();
    });
    await context.close();
  });

  test('should put a session with one Missing Mark and one Available Mark in a mixed column, and move Enter down a session, to the next older session, then to Save Marks', async ({ profile }) => {
    test.setTimeout(300_000);
    // Thu Oct 8: XYZ is Marked, the Call is not. Mon Oct 12 17:00: the Review.
    const { context, page } = await onboardedAt(profile, THURSDAY_OCT_8_1700);
    await confirmOptionPlan(page, { ...OC, planTime: '2026-10-08T09:00' });
    const oc = { symbol: 'XYZ', tradeId: await currentTradeId(page), label: 'O-C' };
    await recordOptionEntry(page, [{ quantity: '2', price: '2.00', fee: '1.30', time: '2026-10-08T10:00' }]);
    await openReview(page);
    await enterMark(page, oc, OCT_8, '50.00');
    await setClock(context, page, MONDAY_1700);
    await openReview(page);

    const marks = await marksPanelOf(page, oc);
    const grid = marks.getByRole('region', { name: 'Marks by session' });
    await test.step('two rows; the Thu Oct 8 column shows XYZ is Marked and the Call is not', async () => {
      await expect(grid.locator('tbody th')).toHaveText(['XYZ Mark', 'Call Mark']);
      await expect(grid.getByRole('button', { name: `XYZ Mark, ${OCT_8}`, exact: true })).toHaveText('50.00');
      await expect(grid.getByRole('textbox', { name: `${CALL} Mark, ${OCT_8}`, exact: true })).toHaveValue('');
      await expect(grid.getByRole('textbox', { name: `XYZ Mark, ${OCT_8}`, exact: true })).toHaveCount(0);
    });

    await test.step('Enter: down the session in row order, then the next older session, then Save Marks (A295)', async () => {
      const input = (label: string, date: string) => grid.getByRole('textbox', { name: `${label} Mark, ${date}`, exact: true });
      // Each cell takes a price first, so Save Marks has something to save and can take the focus at the end.
      await input('XYZ', OCT_12).fill('51.00');
      for (const [label, date] of [[CALL, OCT_12], ['XYZ', OCT_9], [CALL, OCT_9], [CALL, OCT_8]] as const) {
        await page.keyboard.press('Enter');
        await expect(input(label, date), `Enter moves to ${label} ${date}`).toBeFocused();
        await page.keyboard.type('1.00');
      }
      await page.keyboard.press('Enter');
      await expect(marks.getByRole('button', { name: /^Save Marks/ })).toBeFocused();
    });
    await context.close();
  });
});
