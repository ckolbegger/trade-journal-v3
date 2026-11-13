import type { Locator, Page } from '@playwright/test';
import {
  answerCloseReviewIn, answerDebt, closeTheTrade, completion, createTrades, debtForm, debtsOf, enterMark, entriesWithSettledDebt, expect, firstPage, FOUR_TRADES, fillRows, launchAt,
  MONDAY_1700, onboardedAt, openExitForm, openReview, openTradeFromOpenList, probe, reloadReview, saveAction, sell, setClock, test, TUESDAY, TUESDAY_1405, TUESDAY_1405_LOCAL, TUESDAY_1700, WEDNESDAY,
  WEDNESDAY_1700, workspaceOf,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

const OWED_GROUP = 'Trades with owed reflections';
const owedItem = (page: Page, symbol: string): Locator => page.getByRole('list', { name: OWED_GROUP }).locator('li.review-card').filter({ hasText: symbol });

// Closes the Trade whose Detail is open: the whole Position sold, Target Reached, the Close Review deferred.
async function closeWithCloseReviewLater(page: Page): Promise<void> {
  await openExitForm(page);
  await fillRows(page, [sell('100', '53.00', '1.00', TUESDAY_1405_LOCAL)]);
  await closeTheTrade(page, 'later');
  await page.getByRole('button', { name: 'Save exit' }).click();
  await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible();
  await expect(page.getByText('Close Review owed')).toBeVisible();
}

// Opens the owed card of a Trade unless it is open (the Review opens the first card with something owed itself).
async function openOwedCard(page: Page, symbol: string): Promise<Locator> {
  const header = owedItem(page, symbol).getByRole('button', { name: /^Review / });
  await expect(header).toBeVisible();
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'true');
  return owedItem(page, symbol);
}

// Answers the Close Review of an owed card.
async function answerCloseReviewOnCard(page: Page, symbol: string): Promise<void> {
  const item = await openOwedCard(page, symbol);
  await item.getByRole('button', { name: /^Reflect on / }).click();
  await answerCloseReviewIn(debtForm(page));
  await answerDebt(page, undefined, 'page');
}

test.describe('B6.2 Close Review deferred to the Review', () => {
  test('should list both closed Trades as due in the next Review on Tuesday, drop Trade 1 once answered there, show Trade 2 as Due and Incomplete until answered on Wednesday, and store two Close Review Entries naming their Debts and the Daily Review', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_1700);
    // Trade 1 (ABC) and Trade 2 (DEF) are entered Monday; T-A (XYZ) stays Open, so each Review also walks a Trade.
    await createTrades(setupPage, [FOUR_TRADES[0]!, FOUR_TRADES[1]!, FOUR_TRADES[2]!]);
    await setup.close();

    // Tuesday 14:05: close Trade 1 and Trade 2, each with Close Review Reflect later.
    const context = await launchAt(profile, TUESDAY_1405);
    const page = await firstPage(context);
    await page.goto('/');
    for (const symbol of ['ABC', 'DEF']) {
      await openTradeFromOpenList(page, symbol);
      await closeWithCloseReviewLater(page);
      await page.goto('/');
    }

    // Tuesday 17:00: both are under the owed group, due in the next Review, and the Review can complete.
    await setClock(context, page, TUESDAY_1700, '/');
    await openReview(page);
    await expect(page.getByRole('heading', { name: OWED_GROUP })).toBeVisible();
    await expect(owedItem(page, 'ABC')).toHaveCount(1);
    await expect(owedItem(page, 'DEF')).toHaveCount(1);
    for (const symbol of ['ABC', 'DEF']) {
      await expect((await openOwedCard(page, symbol)).getByText('Due in the next Review', { exact: true })).toBeVisible();
    }
    await enterMark(page, 'XYZ', TUESDAY, '52.50');
    await saveAction(page, 'Hold', undefined, 'XYZ');
    await expect(completion(page)).toHaveText('Complete');

    // Trade 1's Close Review is answered on its card and leaves the group; the Review stays Complete.
    await answerCloseReviewOnCard(page, 'ABC');
    await expect(completion(page)).toHaveText('Complete');
    await reloadReview(page);
    await expect(owedItem(page, 'ABC')).toHaveCount(0);
    await expect(owedItem(page, 'DEF')).toHaveCount(1);

    // Wednesday 17:00: Trade 2's card is Due, and the Review is Incomplete until it is answered.
    await setClock(context, page, WEDNESDAY_1700, '/');
    await openReview(page);
    await enterMark(page, 'XYZ', WEDNESDAY, '52.80');
    await saveAction(page, 'Hold', undefined, 'XYZ');
    await expect(completion(page)).toHaveText('Incomplete');
    await expect((await openOwedCard(page, 'DEF')).getByText('Due', { exact: true })).toBeVisible();
    await answerCloseReviewOnCard(page, 'DEF');
    await expect(completion(page)).toHaveText('Complete');
    await context.close();

    // Durable state, after a relaunch: two Close Review Entries, each with settledDebtId and Source Daily Review.
    const relaunched = await launchAt(profile, WEDNESDAY_1700);
    const again = await firstPage(relaunched);
    await again.goto('/');
    await openReview(again);
    await expect(completion(again)).toHaveText('Complete');
    const workspace = workspaceOf(await probe(again))!;
    const settled = entriesWithSettledDebt(workspace) as unknown as { id: string; entryTypeKey: string; sourceKey: string; settledDebtId: string; anchor: { tradeId: string } }[];
    const closeReviews = settled.filter((e) => /close-review/.test(e.entryTypeKey));
    expect(closeReviews).toHaveLength(2);
    expect(new Set(closeReviews.map((e) => e.settledDebtId)).size).toBe(2);
    // Each Close Review Entry settles the Close Review Debt of its own Trade, and that Debt is exactly Settled.
    const debts = debtsOf(workspace) as unknown as { debtId: string; obligationKey: string; versions: { status: string; entryId?: string }[] }[];
    expect(debts).toHaveLength(2);
    for (const entry of closeReviews) {
      const own = debts.filter((d) => d.obligationKey === `CloseReview:${entry.anchor.tradeId}`);
      expect(own.map((d) => d.debtId)).toEqual([entry.settledDebtId]);
      expect(own[0]!.versions.at(-1)!.status).toBe('Settled');
      expect(own[0]!.versions.at(-1)!.entryId).toBe(entry.id);
    }
    expect(closeReviews.map((e) => e.sourceKey)).toEqual(['source.daily-review', 'source.daily-review']);
    await relaunched.close();
  });
});
