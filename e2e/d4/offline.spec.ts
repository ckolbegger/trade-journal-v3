import type { Page } from '@playwright/test';
import { actionEntriesOf, completion, continueToTrades, createTrades, enterMark, expect, firstPage, launchAt, MONDAY_1700, observationsOf, onboardedAt, openReview, probe, saveAction, test, TUESDAY_1700, tradesFamily, workspaceOf } from './support.ts';

const SYMBOLS = ['XYZ', 'ABC', 'DEF', 'JKL'] as const;
const MONDAY_MARKS = { XYZ: '52.00', ABC: '27.50', DEF: '40.50', JKL: '21.00' } as const;
const TUESDAY_MARKS = { XYZ: '52.50', ABC: '27.80', DEF: '40.80', JKL: '21.20' } as const;
const NOT_WRITABLE = { name: /Read only/ };

async function completeReview(page: Page, date: string, marks: Record<string, string>): Promise<void> {
  await openReview(page);
  for (const symbol of SYMBOLS) await enterMark(page, symbol, date, marks[symbol]!);
  await continueToTrades(page);
  for (const symbol of SYMBOLS) {
    await tradesFamily(page).getByRole('button', { name: `Review ${symbol}` }).click();
    await saveAction(page, 'Hold');
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
    await expect(markFor(tuesday, 'XYZ')).toContainText('Missing');
    for (const symbol of SYMBOLS) await enterMark(tuesday, symbol, 'Tue Oct 13', TUESDAY_MARKS[symbol]);
    await continueToTrades(tuesday);
    for (const symbol of SYMBOLS) {
      await tradesFamily(tuesday).getByRole('button', { name: `Review ${symbol}` }).click();
      await saveAction(tuesday, 'Hold');
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
    await continueToTrades(reopened);
    for (const symbol of SYMBOLS) await expect(tradesFamily(reopened).getByRole('listitem').filter({ hasText: `Review ${symbol}` })).toContainText('Action saved');
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

const markFor = (page: Page, symbol: string) => page.getByRole('region', { name: `${symbol} Mark, Tue Oct 13`, exact: true });
