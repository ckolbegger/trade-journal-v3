import type { Locator } from '@playwright/test';
import { dayLine, marksPanelOf, confirmOptionPlan, openGapFixture, currentTradeId, enterMark, expect, MONDAY_1700, OC, OCT_12, OCT_8, OCT_9, onboardedAt, openReview, recordOptionEntry, setClock, test } from './support.ts';

test.use({ actionTimeout: 15_000 });

const CALL = 'XYZ Nov 20 $55 Call';
const THURSDAY_OCT_8_1700 = '2026-10-08T21:00:00Z';
const EARLIER = "Earlier sessions don't block the Review.";

test.describe('B9R2.2 The Marks grid', () => {
  test('should show the previous session and the Review Date, the skipped sessions as optional columns on request, 20 sessions a page with the fixed columns, W72, one row for the Instrument two Trades share, and a Missing-Mark link that focuses the Review Date cell', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page, tA } = await openGapFixture(profile, copySetup);
    const sessionsOf = (grid: Locator) => grid.locator('thead th[data-session]').evaluateAll((heads) => heads.map((head) => head.getAttribute('data-session')));

    await test.step('rows and the two columns shown at first', async () => {
      const marks = await marksPanelOf(page, tA);
      const grid = marks.getByRole('region', { name: 'Marks by session' });
      // XYZ is held by both Trades and is one row; its columns run oldest to newest, between "Instrument" and "Change".
      await expect(grid.locator('tbody th')).toHaveText(['XYZ']);
      await expect(grid.locator('thead th').first()).toHaveText('Instrument');
      await expect(grid.locator('thead th').last()).toHaveText('Change');
      expect(await sessionsOf(grid)).toEqual(['2026-10-09', '2026-10-12']);
      await expect(grid.getByRole('textbox', { name: `XYZ Mark, ${OCT_12}`, exact: true })).toHaveValue('');
      await expect(grid.getByRole('textbox', { name: `XYZ Mark, ${OCT_9}`, exact: true })).toHaveValue('');
      // The skipped sessions are not shown until asked for.
      await expect(grid.getByRole('textbox', { name: `XYZ Mark, ${OCT_8}`, exact: true })).toHaveCount(0);
      await expect(marks.getByText(EARLIER)).toHaveCount(0);
    });

    await test.step('the skipped sessions, on request, optional', async () => {
      const marks = await marksPanelOf(page, tA);
      await marks.getByRole('button', { name: 'Add the skipped sessions' }).click();
      const grid = marks.getByRole('region', { name: 'Marks by session' });
      // Oldest to newest, so read newest first here: the Review Date, the previous session, then the skipped ones (Tue Oct 6 holds a Mark, so it is no column).
      expect((await sessionsOf(grid)).reverse().slice(0, 5)).toEqual(['2026-10-12', '2026-10-09', '2026-10-08', '2026-10-07', '2026-10-05']);
      await expect(grid.locator('thead th[data-session="2026-10-08"]')).toContainText('optional');
      for (const date of [OCT_8, 'Mon Oct 5']) await expect(grid.getByRole('textbox', { name: `XYZ Mark, ${date}`, exact: true })).toHaveValue('');
      await expect(grid.getByRole('button', { name: 'XYZ Mark, Wed Oct 7', exact: true })).toHaveText('Acknowledged Unavailable');
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
      await expect(heads.first()).toHaveAttribute('data-session', '2026-08-31');
      await expect(heads.nth(-2)).toHaveAttribute('data-session', '2026-10-09');
      await expect(heads.last()).toHaveAttribute('data-session', '2026-10-12');
      await expect(marks.getByRole('button', { name: 'Next page' })).toHaveCount(0);
      await marks.getByRole('button', { name: 'Previous page' }).click();
      await expect(marks.getByText('Sessions 1 to 20 of 27')).toBeVisible();
    });

    await test.step('a Missing-Mark day line focuses the Review Date cell', async () => {
      await dayLine(page, 'XYZ').first().getByRole('link', { name: 'XYZ', exact: true }).click();
      await expect(page.getByRole('textbox', { name: `XYZ Mark, ${OCT_12}`, exact: true })).toBeFocused();
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
      await marks.getByRole('button', { name: 'Add the skipped sessions' }).click();
      await expect(grid.locator('tbody th')).toHaveText(['XYZ', CALL]);
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
