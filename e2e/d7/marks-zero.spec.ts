import type { Locator } from '@playwright/test';
import {
  confirmOptionPlan, createTradeAt, currentTradeId, enterMark, expect, firstPage, launchAt, markRow, observationsOf, onboardedAt, openReview, optionMarkRow, OS, PLAN, probe, recordOptionEntry, reloadReview, saveMarkPrice, savedOptionMarkRow, test,
  TUESDAY, TUESDAY_1700, TUESDAY_1030, workspaceOf,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

const ZERO_NOTE = '0 means it closed with no value';
const stock = (symbol: string) => ({ ...PLAN, symbol, quantity: '100', entry: '20', stop: '19', target: '30' });
const PUT = 'MNO 20 Nov 2026 45 Put';

test.describe('B7.6 Marks of 0', () => {
  test('should save a Mark of 0 for the MNO put and for KLM stock with the note, refuse -1 for ABC with A price cannot be negative., and store two Mark revisions', async ({ profile }) => {
    test.setTimeout(300_000);
    // MNO's short put, KLM and ABC stock, all entered Monday.
    const { context: setup, page: setupPage } = await onboardedAt(profile, TUESDAY_1030);
    await confirmOptionPlan(setupPage, { ...OS, planTime: '2026-10-12T09:00' });
    const mno = { symbol: 'MNO', tradeId: await currentTradeId(setupPage) };
    await recordOptionEntry(setupPage, [{ quantity: '2', price: '1.25', fee: '1.30', time: '2026-10-12T10:00' }]);
    const klm = { symbol: 'KLM', tradeId: await createTradeAt(setupPage, stock('KLM'), '2026-10-12T09:30', [['100', '20.00', '2026-10-12T10:00']]) };
    const abc = { symbol: 'ABC', tradeId: await createTradeAt(setupPage, stock('ABC'), '2026-10-12T09:30', [['100', '20.00', '2026-10-12T10:00']]) };
    await setup.close();

    // Tuesday 17:00, in the Review: 0 for the MNO put.
    const context = await launchAt(profile, TUESDAY_1700);
    const page = await firstPage(context);
    await page.goto('/');
    await openReview(page);
    const putRow = await optionMarkRow(page, mno, PUT, TUESDAY);
    await expect(putRow.getByText(ZERO_NOTE)).toBeVisible();
    await saveMarkPrice(page, mno, putRow, '0');
    const saved: Locator = await savedOptionMarkRow(page, mno, PUT, TUESDAY);
    await expect(saved).toContainText('Manual');
    await expect(saved).toContainText('$0.00');

    // 0 for KLM stock.
    await expect((await markRow(page, klm, TUESDAY)).getByText(ZERO_NOTE)).toBeVisible();
    await enterMark(page, klm, TUESDAY, '0');

    // -1 for ABC is refused with its error, and nothing is saved for ABC.
    const abcRow = await markRow(page, abc, TUESDAY);
    await saveMarkPrice(page, abc, abcRow, '-1');
    await expect(abcRow.getByText('A price cannot be negative.')).toBeVisible();
    await expect(abcRow.getByText('Missing')).toBeVisible();
    await reloadReview(page);

    // The probe shows exactly two Mark revisions: the put's and KLM's, each 0, first revisions.
    const observations = observationsOf(workspaceOf(await probe(page))!);
    const withMarks = observations.filter((o) => o.marks.length > 0);
    expect(withMarks.map((o) => [o.instrumentKey, o.marks.map((m) => [m.price, m.revisionNumber])]).sort()).toEqual([
      ['KLM', [['0', 1]]],
      ['MNO261120P00045000', [['0', 1]]],
    ]);
    await context.close();
  });
});
