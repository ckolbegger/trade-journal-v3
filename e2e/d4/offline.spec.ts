import type { Page } from '@playwright/test';
import { actionEntriesOf, cardHeader, completion, createTrades, enterMark, expect, firstPage, launchAt, markRow, MONDAY_1700, observationsOf, onboardedAt, openReview, probe, reachCard, saveAction, test, TUESDAY_1700, workspaceOf } from './support.ts';

const SYMBOLS = ['XYZ', 'ABC', 'DEF', 'JKL'] as const;
const MONDAY_MARKS = { XYZ: '52.00', ABC: '27.50', DEF: '40.50', JKL: '21.00' } as const;
const TUESDAY_MARKS = { XYZ: '52.50', ABC: '27.80', DEF: '40.80', JKL: '21.20' } as const;
const NOT_WRITABLE = { name: /Read only/ };

async function completeReview(page: Page, date: string, marks: Record<string, string>): Promise<void> {
  await openReview(page);
  for (const symbol of SYMBOLS) await enterMark(page, symbol, date, marks[symbol]!);
  for (const symbol of SYMBOLS) {
    await reachCard(page, symbol);
    await saveAction(page, 'Hold', undefined, symbol);
  }
  await expect(completion(page)).toHaveText('Complete');
}

test.describe('B4.9 Offline cold restart (AC-DEL-001)', () => {
  test('should complete the next session’s Review offline after a full stop and keep its Marks and Actions across another offline restart', async ({ server, profile }) => {
    // B4.1 on Monday, online.
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page);
    await completeReview(page, 'Mon Oct 12', MONDAY_MARKS);
    await context.close();
    // Network disabled: offline emulation plus no server for the origin at all.
    await server.close();

    // Tuesday 17:00, offline cold start: Writable, and the Review completes.
    const offline = await launchAt(profile, TUESDAY_1700, { offline: true });
    const tuesday = await firstPage(offline);
    await tuesday.goto('/');
    await openReview(tuesday);
    await expect(tuesday.getByRole('region', NOT_WRITABLE)).toHaveCount(0);
    await expect(completion(tuesday)).toHaveText('Incomplete');
    await expect(await markRow(tuesday, 'XYZ', 'Tue Oct 13')).toContainText('Missing');
    for (const symbol of SYMBOLS) await enterMark(tuesday, symbol, 'Tue Oct 13', TUESDAY_MARKS[symbol]);
    for (const symbol of SYMBOLS) {
      await reachCard(tuesday, symbol);
      await saveAction(tuesday, 'Hold', undefined, symbol);
    }
    await expect(completion(tuesday)).toHaveText('Complete');
    await offline.close();

    // Another offline restart: the Marks and Actions survive.
    const again = await launchAt(profile, TUESDAY_1700, { offline: true });
    const reopened = await firstPage(again);
    await reopened.goto('/');
    await openReview(reopened);
    await expect(reopened.getByRole('region', NOT_WRITABLE)).toHaveCount(0);
    await expect(completion(reopened)).toHaveText('Complete');
    for (const symbol of SYMBOLS) await expect(cardHeader(reopened, symbol)).toContainText('Action saved');
    const workspace = workspaceOf(await probe(reopened))!;
    expect(actionEntriesOf(workspace)).toHaveLength(8);
    const dates = actionEntriesOf(workspace).map((e) => e.obligationKey?.[1]).sort();
    expect(dates).toEqual([...Array<string>(4).fill('2026-10-12'), ...Array<string>(4).fill('2026-10-13')]);
    expect(observationsOf(workspace).flatMap((o) => o.marks.map((m) => `${o.instrumentKey} ${o.tradingDate} ${m.price}`)).sort()).toEqual(
      SYMBOLS.flatMap((s) => [`${s} 2026-10-12 ${Number(MONDAY_MARKS[s])}`, `${s} 2026-10-13 ${Number(TUESDAY_MARKS[s])}`]).sort(),
    );
    await again.close();
  });
});

