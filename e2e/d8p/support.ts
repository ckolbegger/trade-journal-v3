// Shared support for the D08P browser suite (plan section 7.2): D7S's helpers (which re-export D7's and the earlier folders'), and O-C3
// of plan section 5 built through the UI, in the order the events happened (the same order as tests/integration/d8p/support.ts):
//   Mon 09:00 the Plan with its Reflection; Mon 10:05 Buy 2 @ 2.00 (10:00, fee 1.30) with its reflection; Mon 17:00 Monday's Marks;
//   Wed 08:00 the Daily Action Hold for Review Date Tue 10-13; Wed 11:05 Sell 1 @ 3.00 (11:00, fee 0.65) with its reflection deferred;
//   Wed 17:00 Wednesday's Marks; Thu 17:00 Thursday's Marks; Thu 18:00 the Hold for Thu 10-15.
// Tuesday has no Marks. Every figure and word the specs assert is plan section 5's, 1.6's or a W or A row's.
import type { Page } from '@playwright/test';
import {
  currentTradeId, detail, enterMark, executionRow, expect, fillOptionPlan, firstPage, launchAt, MONDAY, MONDAY_0900, MONDAY_1700, onboardedAt, openReview, optionMarkRow, READY, reachCard, recordOptionEntry,
  saveAction, saveMarkPrice, savedOptionMarkRow, THURSDAY, WEDNESDAY, WEDNESDAY_1700, type OptionPlanValues, type Profile, type TradeRef,
} from '../d7s/support.ts';

export * from '../d7s/support.ts';

export const MONDAY_1005 = '2026-10-12T14:05:00Z';
export const WEDNESDAY_0800 = '2026-10-14T12:00:00Z';
export const WEDNESDAY_1105 = '2026-10-14T15:05:00Z';
export const THURSDAY_1700 = '2026-10-15T21:00:00Z';
export const THURSDAY_1800 = '2026-10-15T22:00:00Z';

export const OC3_CALL = 'XYZ 18 Dec 2026 55 Call';

// O-C3: 2 Calls at 2.00; Stop "option at or below 1.00", Target "XYZ at or above 60.00" (the Underlying Stop and the option Target stay empty).
export const OC3: OptionPlanValues = {
  strategy: 'Long Call', underlying: 'XYZ', expiration: '2026-12-18', strike: '55', contracts: '2', entry: '2.00', stop: '', target: '60.00', planTime: '2026-10-12T09:00',
};

// Confirms O-C3's Plan at the pinned clock, ending on its Trade Detail; returns the Trade's id.
async function confirmOc3(page: Page): Promise<string> {
  await fillOptionPlan(page, OC3);
  await page.getByLabel('Stop (option price at or below)', { exact: true }).fill('1.00');
  await page.getByRole('button', { name: 'Confirm Plan' }).click();
  await expect(detail.heading(page, 'XYZ')).toBeVisible(READY);
  return currentTradeId(page);
}

// One session's Marks for XYZ and the call, saved in the Review once the clock is past that session's close.
async function saveOc3Marks(page: Page, trade: TradeRef, date: string, xyz: string, call: string): Promise<void> {
  await page.goto('/');
  await openReview(page);
  await saveMarkPrice(page, trade, await optionMarkRow(page, trade, OC3_CALL, date), call);
  await savedOptionMarkRow(page, trade, OC3_CALL, date);
  await enterMark(page, trade, date, xyz);
}

// A fresh launch at the instant, one step of the Trade's history, and a close.
async function at(profile: Profile, instant: string, step: (page: Page) => Promise<void>): Promise<void> {
  const context = await launchAt(profile, instant);
  const page = await firstPage(context);
  await step(page);
  await context.close();
}

// The Sell 1 @ 3.00 at Wed 11:00 (fee 0.65), with its Position Change Reflection deferred ("Reflect later"), so it stays owed.
async function sellOneAndDefer(page: Page): Promise<void> {
  await detail.recordExitLink(page).click();
  await expect(page.getByRole('heading', { name: 'Record exit', level: 1 })).toBeVisible(READY);
  const row = executionRow(page, 1);
  await row.getByLabel('Contracts').fill('1');
  await row.getByLabel('Price (per share)').fill('3.00');
  await row.getByLabel('Fee').fill('0.65');
  await row.getByLabel('Economic Time').fill('2026-10-14T11:00');
  await page.getByRole('region', { name: 'Reflection on this exit' }).getByLabel('Reflect later').check();
  await page.getByRole('button', { name: 'Save exit' }).click();
  await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible(READY);
}

// O-C3 with section 5's executions, Marks and Journal, created through the UI. With `thursdayHold` the Hold for Thu 10-15 is saved at Thu 18:00
// (without it the history ends at Thu 17:00, since a Hold saved at 18:00 is after it). Every browser is closed on return; the caller launches
// at the final clock itself.
export async function buildOc3(profile: Profile, options: { readonly thursdayHold?: boolean } = {}): Promise<TradeRef> {
  const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_0900);
  const trade: TradeRef = { symbol: 'XYZ', tradeId: await confirmOc3(setupPage), label: 'O-C3' };
  await setup.close();

  await at(profile, MONDAY_1005, async (page) => {
    await page.goto(`/trades/${trade.tradeId}`);
    await expect(detail.heading(page, 'XYZ')).toBeVisible(READY);
    await recordOptionEntry(page, [{ quantity: '2', price: '2.00', fee: '1.30', time: '2026-10-12T10:00' }]);
  });
  await at(profile, MONDAY_1700, (page) => saveOc3Marks(page, trade, MONDAY, '56.00', '2.10'));
  await at(profile, WEDNESDAY_0800, async (page) => {
    await page.goto('/');
    await openReview(page);
    await reachCard(page, trade);
    await saveAction(page, 'Hold', undefined, trade);
  });
  await at(profile, WEDNESDAY_1105, async (page) => {
    await page.goto(`/trades/${trade.tradeId}`);
    await expect(detail.heading(page, 'XYZ')).toBeVisible(READY);
    await sellOneAndDefer(page);
  });
  await at(profile, WEDNESDAY_1700, (page) => saveOc3Marks(page, trade, WEDNESDAY, '57.40', '2.90'));
  await at(profile, THURSDAY_1700, (page) => saveOc3Marks(page, trade, THURSDAY, '57.90', '3.20'));
  if (options.thursdayHold === true)
    await at(profile, THURSDAY_1800, async (page) => {
      await page.goto('/');
      await openReview(page);
      await reachCard(page, trade);
      await saveAction(page, 'Hold', undefined, trade);
    });
  return trade;
}

// A Trade Detail opened at the instant, the way a returning user would.
export async function openDetailAt(profile: Profile, instant: string, trade: TradeRef, width?: number): Promise<{ context: Awaited<ReturnType<typeof launchAt>>; page: Page }> {
  const context = await launchAt(profile, instant, width === undefined ? {} : { width });
  const page = await firstPage(context);
  await page.goto(`/trades/${trade.tradeId}`);
  await expect(detail.heading(page, trade.symbol)).toBeVisible(READY);
  return { context, page };
}
