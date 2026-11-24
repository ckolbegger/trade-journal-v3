// Shared support for the D08R browser suite (plan section 7.2): D8P's helpers (which re-export D7S's and the earlier folders'), the clocks
// the cases read at, and the extra fixtures: O-C3+ (O-C3 with one more contract on Fri 10-16), O-S2X (D7's expired put), K1 (the audit's NVDA
// call, Closed by sale on Fri 11-13) and the stock Trade whose Stop is breached. Every figure and word a spec asserts is plan section 5's, 1.6's or a
// W or A row's.
import type { Page } from '@playwright/test';
import {
  at, closeTheTrade, confirmOc3, copyOc3ThursdayHold, confirmOptionPlan, createTrades, currentTradeId, detail, enterMark, expect, FOUR_TRADES, fillOptionPlan, fillOptionRows, launchAt, MONDAY_0900,
  MONDAY_1005, MONDAY_1105, MONDAY_1700, onboardedAt, openReview, openTradeFromOpenList, OS, LAUNCH, recordOptionEntry, type OptionPlanValues, type Profile, type Setup, type TradeRef,
} from '../d8p/support.ts';

export * from '../d8p/support.ts';

export const MONDAY_1200 = '2026-10-12T16:00:00Z';
export const FRIDAY_1105 = '2026-10-16T15:05:00Z';
export const FRIDAY_1200 = '2026-10-16T16:00:00Z';
export const FRIDAY_1800 = '2026-10-16T22:00:00Z';
export const SATURDAY_1000 = '2026-10-17T14:00:00Z';
export const MONDAY_NOV_1005 = '2026-11-09T15:05:00Z';
export const FRIDAY_NOV_1105 = '2026-11-13T16:05:00Z';
export const PRICE_HISTORY = /^Price History( \d+)?$/;
export const ALL_DRAWERS = ['Today', 'Position', 'Plan and Risk', PRICE_HISTORY, 'Journal', 'Payoff'] as const;

// O-C3+ (plan section 5): O-C3 (the copy of the saved setup with the Thursday Hold), then one more contract bought Fri 10-16 11:00 at $3.30 (fee $0.65). Every browser is closed on return.
export async function buildOc3Plus(profile: Profile, copySetup: <T>(setup: Setup<T>) => Promise<T>): Promise<TradeRef> {
  const trade = await copyOc3ThursdayHold(copySetup);
  await at(profile, FRIDAY_1105, async (page) => {
    await page.goto(`/trades/${trade.tradeId}`);
    await expect(detail.heading(page, 'XYZ')).toBeVisible(LAUNCH);
    await recordOptionEntry(page, [{ quantity: '1', price: '3.30', fee: '0.65', time: '2026-10-16T11:00' }]);
  });
  return trade;
}

// O-C3's Plan and entry only (Mon 10:05), with no Marks yet: the state before the first Marks.
export async function buildOc3BeforeMarks(profile: Profile): Promise<TradeRef> {
  const { context: setup, page } = await onboardedAt(profile, MONDAY_0900);
  const trade: TradeRef = { symbol: 'XYZ', tradeId: await confirmOc3(page), label: 'O-C3' };
  await setup.close();
  await at(profile, MONDAY_1005, async (entering) => {
    await entering.goto(`/trades/${trade.tradeId}`);
    await expect(detail.heading(entering, 'XYZ')).toBeVisible(LAUNCH);
    await recordOptionEntry(entering, [{ quantity: '2', price: '2.00', fee: '1.30', time: '2026-10-12T10:00' }]);
  });
  return trade;
}

// O-S2X (D7's expired put): O-S, 2 short MNO puts at 1.25 (Mon 10:00, fee 1.30), expiring Fri Nov 20, so Settlement Due from Sat 11-21. Planned and
// entered at `instant`, on a profile that is already onboarded. Every browser is closed on return.
export async function addOs2x(profile: Profile, instant: string): Promise<TradeRef> {
  let tradeId = '';
  await at(profile, instant, async (page) => {
    await page.goto('/');
    await confirmOptionPlan(page, { ...OS, planTime: '2026-10-12T09:00' });
    tradeId = await currentTradeId(page);
    await recordOptionEntry(page, [{ quantity: '2', price: '1.25', fee: '1.30', time: '2026-10-12T10:00' }]);
  });
  return { symbol: 'MNO', tradeId, label: 'O-S2X' };
}

// O-S2X on a fresh profile.
export async function buildOs2x(profile: Profile): Promise<TradeRef> {
  const { context } = await onboardedAt(profile, MONDAY_0900);
  await context.close();
  return addOs2x(profile, MONDAY_1105);
}

// K1 (the audit's NVDA Dec 18 $150 Call): 2 bought Mon 11-09 at $10.00, all sold Fri 11-13 at $12.40, so Closed by sale. Thursday's Marks are saved
// in the Review. Planned and entered Mon 11-09, on a profile that is already onboarded. Every browser is closed on return.
export const K1_PLAN: OptionPlanValues = {
  strategy: 'Long Call', underlying: 'NVDA', expiration: '2026-12-18', strike: '150', contracts: '2', entry: '10.00', stop: '', target: '170.00', planTime: '2026-11-09T09:00',
};
export async function addK1(profile: Profile): Promise<TradeRef> {
  let tradeId = '';
  await at(profile, MONDAY_NOV_1005, async (page) => {
    await page.goto('/');
    await fillOptionPlan(page, K1_PLAN);
    await page.getByLabel('Stop (option price at or below)', { exact: true }).fill('6.00');
    await page.getByRole('button', { name: 'Confirm Plan' }).click();
    await expect(detail.heading(page, 'NVDA')).toBeVisible(LAUNCH);
    tradeId = await currentTradeId(page);
    await recordOptionEntry(page, [{ quantity: '2', price: '10.00', fee: '1.30', time: '2026-11-09T10:00' }]);
  });
  await at(profile, FRIDAY_NOV_1105, async (page) => {
    await page.goto(`/trades/${tradeId}`);
    await expect(detail.heading(page, 'NVDA')).toBeVisible(LAUNCH);
    await detail.recordExitLink(page).click();
    await expect(page.getByRole('heading', { name: 'Record exit', level: 1 })).toBeVisible();
    await fillOptionRows(page, [{ quantity: '2', price: '12.40', fee: '1.30', time: '2026-11-13T11:00' }]);
    await closeTheTrade(page);
    await page.getByRole('button', { name: 'Save exit' }).click();
    await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible();
  });
  return { symbol: 'NVDA', tradeId, label: 'K1' };
}

// The stock Trade whose Stop is breached (D4's XYZ: 60 shares at 50.10, Stop 47.50), with Monday's Mark 47.00. The Detail is open on return.
export async function openBreachedStockTrade(profile: Profile): Promise<{ context: Awaited<ReturnType<typeof launchAt>>; page: Page }> {
  const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_1700);
  await createTrades(setupPage, [FOUR_TRADES[0]!]);
  await openReview(setupPage);
  await enterMark(setupPage, 'XYZ', 'Mon Oct 12', '47.00');
  await setupPage.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
  await openTradeFromOpenList(setupPage, 'XYZ');
  await expect(detail.heading(setupPage, 'XYZ')).toBeVisible(LAUNCH);
  return { context: setup, page: setupPage };
}
