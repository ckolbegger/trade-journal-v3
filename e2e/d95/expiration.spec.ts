import type { Locator, Page } from '@playwright/test';
import { detail, enterMark, expect, factsOf, FRIDAY_NOV, openExpiration, openReview, probe, recordExpirationInCard, recordExpiration, test, tradesOf, workspaceOf } from '../d7/support.ts';
import { setWidth } from '../d7p/support.ts';
import { atBothWidths, openSettlement, storeOf, WIDTHS } from './support.ts';

test.use({ actionTimeout: 15_000 });

const HEADING = 'Expired Fri Nov 20 · no Action needed';
const button = (block: Locator, name: string): Locator => block.getByRole('button', { name, exact: true });

// The stored Trades, with how many Expiration facts each holds and its lifecycle.
async function expirations(page: Page): Promise<{ id: string; lifecycle: string; count: number }[]> {
  const trades = tradesOf(workspaceOf(await probe(page))!);
  if (!trades) throw new Error('the workspace has no trades store');
  return trades.map((t) => ({ id: t.tradeId, lifecycle: t.lifecycle, count: factsOf(t, 'Expiration').length }));
}

test.describe('B95.11 The expiration block (AC-SET-003)', () => {
  test('should say a long contract in the money is worth something, with Exercised: record later as the main button, at both widths', async ({ profile, copySetup }) => {
    test.setTimeout(240_000);
    const { context, page, t1 } = await openSettlement(profile, copySetup);
    await openReview(page);
    await enterMark(page, t1, FRIDAY_NOV, '57.00');
    const block = await openExpiration(page, t1);
    await atBothWidths(page, async (width) => {
      const at = `at ${width}`;
      await expect(block.getByRole('heading', { name: HEADING, exact: true }), `the heading ${at}`).toBeVisible();
      await expect(block.getByText('XYZ $57.00, strike $55.00: $2.00 in the money', { exact: true }), `where it finished ${at}`).toBeVisible();
      await expect(block.getByText(/^Worth \$200\.00 at expiration: /), `what it is worth ${at}`).toBeVisible();
      await expect(button(block, 'Exercised: record later'), `the main button ${at}`).toHaveClass(/primary/);
      await expect(button(block, 'Sold before the close'), `the sale choice ${at}`).toBeVisible();
      await expect(button(block, 'It expired worthless'), `the link ${at}`).toBeVisible();
      await expect(block.getByText("The app can't record an exercise yet. This only lets today's Review finish. The next Review asks again.", { exact: true }), `what record later does ${at}`).toBeVisible();
      await expect(block.getByRole('radio'), `no Action form ${at}`).toHaveCount(0);
    });
    await context.close();
  });

  test('should say a short contract in the money is assigned, with Assigned: record later as the main button, at both widths', async ({ profile, copySetup }) => {
    test.setTimeout(240_000);
    const { context, page, t3 } = await openSettlement(profile, copySetup);
    await openReview(page);
    await enterMark(page, t3, FRIDAY_NOV, '43.00');
    const block = await openExpiration(page, t3);
    await atBothWidths(page, async (width) => {
      const at = `at ${width}`;
      await expect(block.getByText('MNO $43.00, strike $45.00: $2.00 in the money', { exact: true }), `where it finished ${at}`).toBeVisible();
      await expect(button(block, 'Assigned: record later'), `the main button ${at}`).toHaveClass(/primary/);
      await expect(button(block, 'Bought back before the close'), `the buyback choice ${at}`).toBeVisible();
      await expect(button(block, 'It expired worthless'), `the link ${at}`).toBeVisible();
      await expect(block.getByText("The app can't record an assignment yet. This only lets today's Review finish. The next Review asks again.", { exact: true }), `what record later does ${at}`).toBeVisible();
    });
    await context.close();
  });

  test('should offer all three choices and no main button when the Underlying has no Mark, at both widths', async ({ profile, copySetup }) => {
    test.setTimeout(240_000);
    const { context, page, t3 } = await openSettlement(profile, copySetup);
    await openReview(page);
    const block = await openExpiration(page, t3);
    await atBothWidths(page, async (width) => {
      const at = `at ${width}`;
      await expect(block.getByText("No price for MNO, so the app can't say where it finished. What happened?", { exact: true }), `the question ${at}`).toBeVisible();
      for (const name of ['Assigned: record later', 'Bought back before the close', 'It expired worthless']) {
        await expect(button(block, name), `${name} ${at}`).toBeVisible();
        await expect(button(block, name), `${name} is not the main button ${at}`).not.toHaveClass(/primary/);
      }
    });
    await context.close();
  });

  test('should keep focus on a named element through the expiration form, its receipt and the way back (A327, T95.67-B5)', async ({ profile, copySetup }) => {
    test.setTimeout(240_000);
    const { context, page, t1 } = await openSettlement(profile, copySetup);
    await openReview(page);
    await enterMark(page, t1, FRIDAY_NOV, '52.00');
    const block = await openExpiration(page, t1);
    await button(block, 'Record expiration').click();
    await expect(block.getByRole('heading', { name: 'Expiration', exact: true }), 'the form opens with its heading focused').toBeFocused();
    await button(block, 'Back to the Review').click();
    await expect(button(block, 'Record expiration'), 'leaving the form returns to the button that opened it').toBeFocused();
    await button(block, 'Record expiration').click();
    await button(block, 'Record expiration').click();
    await expect(block.getByRole('heading', { name: 'Expiration recorded' }), 'the receipt heading is focused').toBeFocused();
    await button(block, 'Back to the Review').click();
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName), 'focus is not on the page body after the receipt').not.toBe('BODY');
    await context.close();
  });

  for (const width of WIDTHS) {
    test(`should say a contract out of the money expired worthless, infer no expiration, and record it through the form in the card at ${width}`, async ({ profile, copySetup }) => {
      test.setTimeout(240_000);
      const { context, page, t1 } = await openSettlement(profile, copySetup);
      await setWidth(page, width);
      await openReview(page);
      await enterMark(page, t1, FRIDAY_NOV, '52.00');
      const block = await openExpiration(page, t1);
      await expect(block.getByText('XYZ $52.00, below the $55.00 strike: expired worthless. You lose the $190.65 paid.', { exact: true })).toBeVisible();
      await expect(button(block, 'Record expiration'), 'the main button').toHaveClass(/primary/);
      await expect(button(block, 'Sold it before the close')).toBeVisible();
      // Opening the Review recorded nothing; nor does Trade Detail after the date.
      expect(await expirations(page), 'nothing inferred on the Review').toEqual(expect.arrayContaining([expect.objectContaining({ id: t1.tradeId, count: 0, lifecycle: 'Open' })]));
      await page.goto(`/trades/${t1.tradeId}`);
      await expect(detail.settlementDueHeading(page)).toBeVisible();
      expect((await expirations(page)).every((t) => t.count === 0 && t.lifecycle === 'Open' || t.id !== t1.tradeId), 'nothing inferred on Trade Detail').toBe(true);
      await openReview(page);
      const again = await openExpiration(page, t1);
      await recordExpirationInCard(again, 'Record expiration');
      await expect(again.getByRole('heading', { name: 'Expiration recorded' })).toBeVisible();
      const stored = (await expirations(page)).find((t) => t.id === t1.tradeId)!;
      expect(stored, 'one Expiration fact, the Trade Closed').toEqual({ id: t1.tradeId, count: 1, lifecycle: 'Closed' });
      expect((await storeOf(page, 'journalDebts')).length, 'the Close Review is owed').toBe(1);
      await context.close();
    });

    test(`should state what It expired worthless would book in the money, ask why, and record it with the reason at ${width}`, async ({ profile, copySetup }) => {
      test.setTimeout(240_000);
      const { context, page, t1 } = await openSettlement(profile, copySetup);
      await setWidth(page, width);
      await openReview(page);
      await enterMark(page, t1, FRIDAY_NOV, '57.00');
      const block = await openExpiration(page, t1);
      await button(block, 'It expired worthless').click();
      await expect(block.getByText(/^This books [−+]\$[\d.,]+ · [−+][\d.]+R on a call worth \$200\.00\.$/), 'what it would book').toBeVisible();
      const reason = block.getByLabel(/^Why did it expire worthless\?/);
      await button(block, 'Record expiration anyway').click();
      await expect(reason, 'the form asks why').toBeVisible();
      expect((await expirations(page)).find((t) => t.id === t1.tradeId)!.count, 'a refused save writes nothing').toBe(0);
      await reason.fill('Not worth exercising.');
      await button(block, 'Record expiration anyway').click();
      await expect(block.getByRole('heading', { name: 'Expiration recorded' })).toBeVisible();
      expect((await expirations(page)).find((t) => t.id === t1.tradeId), 'one Expiration fact, the Trade Closed').toEqual({ id: t1.tradeId, count: 1, lifecycle: 'Closed' });
      expect(JSON.stringify(await storeOf(page, 'journalEntries')), 'the reason is stored').toContain('Not worth exercising.');
      await context.close();
    });

    test(`should record the expiration from Trade Detail with the same form at ${width}`, async ({ profile, copySetup }) => {
      test.setTimeout(240_000);
      const { context, page, t3 } = await openSettlement(profile, copySetup);
      await setWidth(page, width);
      await page.goto(`/trades/${t3.tradeId}`);
      await expect(detail.settlementDueHeading(page)).toBeVisible();
      await detail.recordExpirationLink(page).click();
      await recordExpiration(page);
      await expect(page.getByRole('heading', { name: 'Expiration recorded', level: 1 })).toBeVisible();
      const stored = (await expirations(page)).find((t) => t.id === t3.tradeId)!;
      expect(stored, 'one Expiration fact, the Trade Closed').toEqual({ id: t3.tradeId, count: 1, lifecycle: 'Closed' });
      await context.close();
    });
  }
});
