import { actionEntriesOf, dayLine, enterMark, expect, firstPage, launchAt, MONDAY_1700, observationsOf, openReview, probe, saveAction, status, test, workspaceOf } from '../d4/support.ts';
import { ABC_DEF, WIDTHS } from './support.ts';

test.use({ actionTimeout: 15_000 });

test.describe('B95.16 The stopped application reopens offline on the new page (AC-DEL-001)', () => {
  for (const width of WIDTHS) {
    test(`should reopen offline after a full stop, save a Mark and an Action on the Review, and keep both across another offline restart at ${width}`, async ({ copySetup, server, profile }) => {
      test.setTimeout(240_000);
      await copySetup(ABC_DEF);
      // No network: offline emulation, and no server for the origin at all.
      await server.close();

      const offline = await launchAt(profile, MONDAY_1700, { offline: true, width });
      const page = await firstPage(offline);
      await page.goto('/');
      await openReview(page);
      await expect(page.getByRole('region', { name: /Read only/ }), 'the Workspace is writable offline').toHaveCount(0);
      await enterMark(page, 'ABC', 'Mon Oct 12', '29.00');
      await saveAction(page, 'Hold', undefined, 'ABC');
      await offline.close();

      // Another full stop, still offline: the Mark and the Action are where they were left, on the new page.
      const again = await launchAt(profile, MONDAY_1700, { offline: true, width });
      const reopened = await firstPage(again);
      await reopened.goto('/');
      await openReview(reopened);
      await expect(reopened.getByRole('region', { name: /Read only/ })).toHaveCount(0);
      await expect(dayLine(reopened, 'ABC'), 'the Action is on the day card').toContainText('Hold');
      await expect(status(reopened).getByText('2 Trades · 1 Mark and 1 Action to go', { exact: true }), 'one Mark and one Action are counted as done').toBeVisible();
      const workspace = workspaceOf(await probe(reopened))!;
      expect(observationsOf(workspace), 'one Mark stored').toHaveLength(1);
      expect(JSON.stringify(observationsOf(workspace)[0])).toContain('29');
      expect(actionEntriesOf(workspace), 'one Action stored').toHaveLength(1);
      await again.close();
    });
  }
});
