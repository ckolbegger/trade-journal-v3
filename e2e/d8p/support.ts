// Shared support for the D08P browser suite (plan section 7.2): D7S's helpers (which re-export D7's and the earlier folders'), and O-C3
// of plan section 5 built through the UI, in the order the events happened (the same order as tests/integration/d8p/support.ts):
//   Mon 09:00 the Plan with its Reflection; Mon 10:05 Buy 2 @ 2.00 (10:00, fee 1.30) with its reflection; Mon 17:00 Monday's Marks;
//   Wed 08:00 the Daily Action Hold for Tue 10-13; Wed 11:05 Sell 1 @ 3.00 (11:00, fee 0.65) with its reflection deferred;
//   Wed 17:00 Wednesday's Marks; Thu 17:00 Thursday's Marks; Thu 18:00 the Hold for Thu 10-15.
// Tuesday has no Marks. Every figure and word the specs assert is plan section 5's, 1.6's or a W or A row's.
import type { Page } from '@playwright/test';
import {
  acknowledgeMark, currentTradeId, defineSetup, detail, enterMark, executionRow, expect, fillOptionPlan, firstPage, launchAt, MONDAY, MONDAY_0900, MONDAY_1700, onboardedAt, openReview, optionMarkRow, LAUNCH, reachCard, reachPanel, recordOptionEntry,
  expectMarksSaved, markCell, saveAction, saveMarksButton, saveMarkPrice, savedOptionMarkRow, THURSDAY, WEDNESDAY, WEDNESDAY_1700, type OptionPlanValues, type Profile, type Setup, type TradeRef,
} from '../d7s/support.ts';

export * from '../d7s/support.ts';

export const MONDAY_1005 = '2026-10-12T14:05:00Z';
export const WEDNESDAY_0800 = '2026-10-14T12:00:00Z';
export const WEDNESDAY_1105 = '2026-10-14T15:05:00Z';
export const THURSDAY_1700 = '2026-10-15T21:00:00Z';
export const THURSDAY_1800 = '2026-10-15T22:00:00Z';

export const OC3_CALL = 'XYZ Dec 18 $55 Call';

// O-C3: 2 Calls at 2.00; Stop "option at or below 1.00", Target "XYZ at or above 60.00" (the Underlying Stop and the option Target stay empty).
export const OC3: OptionPlanValues = {
  strategy: 'Long Call', underlying: 'XYZ', expiration: '2026-12-18', strike: '55', contracts: '2', entry: '2.00', stop: '', target: '60.00', planTime: '2026-10-12T09:00',
};

// Confirms O-C3's Plan at the pinned clock, ending on its Trade Detail; returns the Trade's id.
export async function confirmOc3(page: Page): Promise<string> {
  await fillOptionPlan(page, OC3);
  await page.getByLabel('Stop (option price at or below)', { exact: true }).fill('1.00');
  await page.getByRole('button', { name: 'Confirm Plan' }).click();
  await expect(detail.heading(page, 'XYZ')).toBeVisible();
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

// Tuesday has no price, and an Action waits for its Trade's Marks (A304): both Tuesday Marks are acknowledged Unavailable first, so the gap stays a gap.
async function acknowledgeTuesday(page: Page, trade: TradeRef): Promise<void> {
  const TUESDAY = 'Tue Oct 13';
  const reason = 'No quote available.';
  await acknowledgeMark(page, trade, TUESDAY, reason);
  // The contract's row takes its reason in the grid (W113).
  await optionMarkRow(page, trade, OC3_CALL, TUESDAY);
  const row = (await reachPanel(page, trade, 'Marks')).getByRole('row').filter({ has: page.locator('td.marks-step-today').getByRole('textbox', { name: `${OC3_CALL} Mark, ${TUESDAY}`, exact: true }) });
  await row.getByRole('button', { name: /^Can't get a price/ }).click();
  await row.getByRole('textbox', { name: /^Why no price/ }).fill(reason);
  await row.getByRole('button', { name: 'No price', exact: true }).click();
  await (await reachPanel(page, trade, 'Marks')).getByRole('button', { name: /^Save Marks/ }).click();
  await savedOptionMarkRow(page, trade, OC3_CALL, TUESDAY);
}

// A fresh launch at the instant, one step of the Trade's history, and a close.
export async function at(profile: Profile, instant: string, step: (page: Page) => Promise<void>): Promise<void> {
  const context = await launchAt(profile, instant);
  const page = await firstPage(context);
  await step(page);
  await context.close();
}

// The Sell 1 @ 3.00 at Wed 11:00 (fee 0.65), with its Position Change Reflection deferred ("Reflect later"), so it stays owed.
async function sellOneAndDefer(page: Page): Promise<void> {
  await detail.recordExitLink(page).click();
  await expect(page.getByRole('heading', { name: 'Record exit', level: 1 })).toBeVisible();
  const row = executionRow(page, 1);
  await row.getByLabel('Contracts').fill('1');
  await row.getByLabel('Price (per share)').fill('3.00');
  await row.getByLabel('Fee').fill('0.65');
  await row.getByLabel('Economic Time').fill('2026-10-14T11:00');
  await page.getByRole('region', { name: 'Reflection on this exit' }).getByLabel('Reflect later').check();
  await page.getByRole('button', { name: 'Save exit' }).click();
  await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible();
}

// O-C3 with section 5's executions, Marks and Journal, created through the UI. With `thursdayHold` the Hold for Thu 10-15 is saved at Thu 18:00
// (without it the history ends at Thu 17:00, since a Hold saved at 18:00 is after it). Every browser is closed on return; the caller launches
// at the final clock itself.
// With `correctedWednesdayXyz` (T8R.27, B8R.6) Wednesday's XYZ Mark is fixed to that price straight after it is saved: a Mark saved in this Review is
// fixed in its cell with no reason asked, and the correction carries the reason Daily Review gives it (T95.14, answer 8).
export const CORRECTION_REASON = 'Fixed in the same Review';
export async function buildOc3(profile: Profile, options: { readonly thursdayHold?: boolean; readonly correctedWednesdayXyz?: string; readonly noTuesdayReview?: boolean } = {}): Promise<TradeRef> {
  const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_0900);
  const trade: TradeRef = { symbol: 'XYZ', tradeId: await confirmOc3(setupPage), label: 'O-C3' };
  await setup.close();

  await at(profile, MONDAY_1005, async (page) => {
    await page.goto(`/trades/${trade.tradeId}`);
    await expect(detail.heading(page, 'XYZ')).toBeVisible(LAUNCH);
    await recordOptionEntry(page, [{ quantity: '2', price: '2.00', fee: '1.30', time: '2026-10-12T10:00' }]);
  });
  await at(profile, MONDAY_1700, (page) => saveOc3Marks(page, trade, MONDAY, '56.00', '2.10'));
  // With `noTuesdayReview` (Q4) Tuesday has no Review: no Action saved and Tuesday's Marks neither saved nor acknowledged, so it stays a true gap.
  if (options.noTuesdayReview !== true)
    await at(profile, WEDNESDAY_0800, async (page) => {
      await page.goto('/');
      await openReview(page);
      await reachCard(page, trade);
      await acknowledgeTuesday(page, trade);
      await saveAction(page, 'Hold', undefined, trade);
    });
  await at(profile, WEDNESDAY_1105, async (page) => {
    await page.goto(`/trades/${trade.tradeId}`);
    await expect(detail.heading(page, 'XYZ')).toBeVisible(LAUNCH);
    await sellOneAndDefer(page);
  });
  await at(profile, WEDNESDAY_1700, async (page) => {
    await saveOc3Marks(page, trade, WEDNESDAY, '57.40', '2.90');
    if (options.correctedWednesdayXyz === undefined) return;
    await (await markCell(page, trade, WEDNESDAY)).fill(options.correctedWednesdayXyz);
    await saveMarksButton(page).click();
    await expectMarksSaved(page);
  });
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

// The saved setup of O-C3 with the Thursday Hold (setup-snapshot plan, group 2): built once per worker, and each test that asks starts on a copy. The build's last launch is only
// there to hand the helper an open context to close; the Trade is the one buildOc3 made.
export const OC3_THURSDAY_HOLD = defineSetup('oc3-thursday-hold', async (profile) => {
  const trade = await buildOc3(profile, { thursdayHold: true });
  return { context: await launchAt(profile, THURSDAY_1800), made: trade };
});

// Copy O-C3 with the Thursday Hold: in place of buildOc3(profile, { thursdayHold: true }), for tests that launch their own browser after the build. Nothing is launched.
export function copyOc3ThursdayHold(copySetup: <T>(setup: Setup<T>) => Promise<T>): Promise<TradeRef> {
  return copySetup(OC3_THURSDAY_HOLD);
}

// A Trade Detail opened at the instant, the way a returning user would.
export async function openDetailAt(profile: Profile, instant: string, trade: TradeRef, width?: number): Promise<{ context: Awaited<ReturnType<typeof launchAt>>; page: Page }> {
  const context = await launchAt(profile, instant, width === undefined ? {} : { width });
  const page = await firstPage(context);
  await page.goto(`/trades/${trade.tradeId}`);
  await expect(detail.heading(page, trade.symbol)).toBeVisible(LAUNCH);
  return { context, page };
}
