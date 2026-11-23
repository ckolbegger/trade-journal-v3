// Shared support for the D5R browser suite (plan section 6.2): D5's helpers, which re-export D4's card helpers (decision 65,
// section 6.4; decision 68), plus what the card cases need: the card fixture created through the UI, which returns each Trade
// as a Trade reference the shared helpers take, and the meter and Save Marks locators.
import type { BrowserContext, Locator, Page } from '@playwright/test';
import {
  backToTrade, cardItem, confirmReference, createTradeAt, createTrades, currentTradeId, deferEntry, defineSetup, expect, firstPage, FOUR_TRADES, launchAt, MONDAY_1700, onboardedAt, PLAN, recordEntry,
  type CardRef, type FixtureTrade, type PlanValues, type Profile, type Setup, type TradeRef,
} from '../d5/support.ts';

export * from '../d5/support.ts';

export const FRIDAY = 'Fri Oct 9';
export const THURSDAY = 'Thu Oct 8';

// ---- The card fixture (plan section 4), created through the UI -------------------------------------------------------

export type CardTrade = 'T-A' | 'T-B' | 'T-C' | 'T-E' | 'T-F';
export const SYMBOL: Readonly<Record<CardTrade, string>> = { 'T-A': 'XYZ', 'T-B': 'ABC', 'T-C': 'DEF', 'T-E': 'JKL', 'T-F': 'XYZ' };

const T_A: PlanValues = FOUR_TRADES[0]!.plan;
const T_F: PlanValues = { ...PLAN, symbol: 'XYZ', quantity: '50', entry: '50', stop: '48', target: '55' };

// D4's five-Trade fixture without T-D, with T-F (50 shares at 50.00, Monday 10:30), T-A's first Position Change on an
// earlier day at 10:00 with no Mark for that day (Friday, or Thursday for the case that needs two earlier sessions), and
// both of T-A's Position Changes recorded with Reflect later: D-1 (due in Monday's Review) and D-2 (Monday 11:00).
// Returns each Trade as a Trade reference (its Underlying, the id the app gave it, and its fixture label), which the card
// helpers take to reach its card.
export async function createCardFixture(page: Page, options: { readonly earlierDay?: '2026-10-09' | '2026-10-08' } = {}): Promise<Record<CardTrade, TradeRef>> {
  const day = options.earlierDay ?? '2026-10-09';
  const tA = await createTradeAt(page, T_A, `${day}T09:30`, []);
  await deferEntry(page, [{ quantity: '60', price: '50.10', fee: '1.00', time: `${day}T10:00` }]);
  await backToTrade(page, 'XYZ');
  await deferEntry(page, [{ quantity: '40', price: '50.30', fee: '1.00', time: '2026-10-12T11:00' }]);
  const [tB, tC, tE] = await createTrades(page, FOUR_TRADES.slice(1));
  await confirmReference(page, T_F);
  const tF = await currentTradeId(page);
  await recordEntry(page, [{ quantity: '50', price: '50.00', fee: '1.00', time: '2026-10-12T10:30' }]);
  const ref = (trade: CardTrade, tradeId: string | undefined): TradeRef => ({ symbol: SYMBOL[trade], tradeId: tradeId!, label: trade });
  return { 'T-A': ref('T-A', tA), 'T-B': ref('T-B', tB), 'T-C': ref('T-C', tC), 'T-E': ref('T-E', tE), 'T-F': ref('T-F', tF) };
}

// The saved setup of the card fixture (setup-snapshot plan, group 3): onboarded at Mon 10-12 17:00 with createCardFixture's default Trades, built once per worker; each test that asks starts on a copy.
export const CARD_FIXTURE = defineSetup('d5r-card-fixture', async (profile) => {
  const { context, page } = await onboardedAt(profile, MONDAY_1700);
  return { context, made: await createCardFixture(page) };
});

// Copy the card fixture, nothing launched: in place of onboardedAt + createCardFixture, for tests that launch their own browser after the build.
export function copyCardFixture(copySetup: <T>(setup: Setup<T>) => Promise<T>): Promise<Record<CardTrade, TradeRef>> {
  return copySetup(CARD_FIXTURE);
}

// The copy launched at Mon 10-12 17:00 on the Today screen, with each Trade as a Trade reference: in place of onboardedAt + createCardFixture, before openReview.
export async function openCardFixture(profile: Profile, copySetup: <T>(setup: Setup<T>) => Promise<T>): Promise<{ context: BrowserContext; page: Page } & Record<CardTrade, TradeRef>> {
  const trades = await copyCardFixture(copySetup);
  const context = await launchAt(profile, MONDAY_1700);
  const page = await firstPage(context);
  await page.goto('/');
  return { context, page, ...trades };
}

// Routine Trades for the long list: one Long Stock Trade each, entered Monday 10:00.
export async function createRoutineTrades(page: Page, count: number): Promise<void> {
  const trades: FixtureTrade[] = Array.from({ length: count }, (_, i) => ({
    plan: { ...PLAN, symbol: `ZZ${String.fromCharCode(65 + i)}`, quantity: '100', entry: '20', stop: '19', target: '30' },
    fills: [['100', '20.00', '2026-10-12T10:00']],
  }));
  await createTrades(page, trades);
}

// ---- Locators for a fixture Trade's card, reached by its Trade (decision 68) -------------------------------------------------

// The meter of a card's header (a collapsed card shows it too).
export const meterOf = (page: Page, card: CardRef): Locator => cardItem(page, card).locator('.review-card-head').getByRole('img');
// What the collapsed header says remains.
export const remainsOf = (page: Page, card: CardRef): Locator => cardItem(page, card).locator('.review-card-remains');

// The Review's cards in their order: each Trade's id, and the name of the meter in its header. (D9's open-list and meter-a11y specs read it too, through D9's support.)
export const reviewMeters = (page: Page): Promise<{ id: string; name: string | null }[]> =>
  page.locator('li.review-card').evaluateAll((cards) =>
    cards.map((card) => ({ id: card.getAttribute('data-trade-id')!, name: card.querySelector('.review-card-head [role="img"]')?.getAttribute('aria-label') ?? null })));

// A meter's track is dashed when there is no Mark. Polled: a list that re-renders leaves a detached track, whose computed style is empty and says nothing.
export const expectTrackDashed = (meter: Locator, dashed: boolean): Promise<void> =>
  expect
    .poll(() => meter.getByTestId('meter-track').evaluate((el) => getComputedStyle(el).borderStyle), { message: dashed ? 'the track is dashed' : 'the track is not dashed' })
    .toEqual(dashed ? 'dashed' : expect.not.stringMatching(/^(dashed|)$/));
