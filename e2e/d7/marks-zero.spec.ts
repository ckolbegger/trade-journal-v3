import type { Locator } from '@playwright/test';
import {
  markEditorOf, marksStepOf, confirmOptionPlan, createTradeAt, currentTradeId, expect, firstPage, launchAt, observationsOf, onboardedAt, openReview, optionMarkRow, OS, PLAN, probe, recordOptionEntry, reloadReview, saveMarkPrice, savedOptionMarkRow, test,
  TUESDAY, TUESDAY_1700, TUESDAY_1030, workspaceOf,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

const ZERO_NOTE = '0 means it closed with no value';
const stock = (symbol: string) => ({ ...PLAN, symbol, quantity: '100', entry: '20', stop: '19', target: '30' });
const PUT = 'MNO Nov 20 $45 Put';

test.describe('B7.6 Marks of 0', () => {
  test('should save a Mark of 0 for the MNO put with the note, refuse 0 for KLM stock and -1 for ABC on the screen (W107), and store one Mark revision', async ({ profile }) => {
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
    await expect(marksStepOf(page).getByText(ZERO_NOTE)).toBeVisible();
    await saveMarkPrice(page, mno, putRow, '0');
    const saved: Locator = await savedOptionMarkRow(page, mno, PUT, TUESDAY);
    // A saved Mark is held in place by an input holding its price.
    await expect(saved).toHaveValue('0.00');

    // 0 for KLM stock is refused where it is typed (T95.13, W107): a share price cannot be $0.00. The draft is cleared again.
    await markEditorOf(page, klm, TUESDAY);
    await expect(marksStepOf(page).getByText(ZERO_NOTE)).toBeVisible();
    const klmInput = marksStepOf(page).getByRole('textbox', { name: `KLM Mark, ${TUESDAY}`, exact: true });
    await klmInput.fill('0');
    await klmInput.blur();
    await expect(marksStepOf(page).getByText("A share price can't be $0.00.")).toBeVisible();
    await klmInput.fill('');

    // -1 for ABC is refused on the screen as not a price, Save Marks sends nothing, and nothing is saved for ABC.
    const abcRow = await markEditorOf(page, abc, TUESDAY);
    await saveMarkPrice(page, abc, abcRow, '-1');
    await expect(marksStepOf(page).getByText('Not a price. Digits only, like 45.10.')).toBeVisible();
    // Still a price to enter, holding the refused draft.
    await expect(marksStepOf(page).getByRole('textbox', { name: `ABC Mark, ${TUESDAY}`, exact: true })).toHaveValue('-1');
    await reloadReview(page);

    // The probe shows exactly one Mark revision: the put's 0, a first revision.
    const observations = observationsOf(workspaceOf(await probe(page))!);
    const withMarks = observations.filter((o) => o.marks.length > 0);
    expect(withMarks.map((o) => [o.instrumentKey, o.marks.map((m) => [m.price, m.revisionNumber])]).sort()).toEqual([
      ['MNO261120P00045000', [['0', 1]]],
    ]);
    await context.close();
  });
});
