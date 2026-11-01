// Shared support for the D5R browser suite (plan section 6.2): D5's helpers, which re-export D4's card helpers (decision 65,
// section 6.4; decision 68), plus what the card cases need: the card fixture created through the UI, which returns each Trade
// as a Trade reference the shared helpers take, and the slider and Save Marks locators.
import type { Locator, Page } from '@playwright/test';
import {
  backToTrade, cardItem, confirmReference, createTradeAt, createTrades, currentTradeId, deferEntry, FOUR_TRADES, PLAN, recordEntry,
  type CardRef, type FixtureTrade, type PlanValues, type TradeRef,
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

// Routine Trades for the long list: one Long Stock Trade each, entered Monday 10:00.
export async function createRoutineTrades(page: Page, count: number): Promise<void> {
  const trades: FixtureTrade[] = Array.from({ length: count }, (_, i) => ({
    plan: { ...PLAN, symbol: `ZZ${String.fromCharCode(65 + i)}`, quantity: '100', entry: '20', stop: '19', target: '30' },
    fills: [['100', '20.00', '2026-10-12T10:00']],
  }));
  await createTrades(page, trades);
}

// ---- Locators for a fixture Trade's card, reached by its Trade (decision 68) -------------------------------------------------

// The Stop-to-Target slider of a card's header (a collapsed card shows it too), and its parts.
export const sliderOf = (page: Page, card: CardRef): Locator => cardItem(page, card).locator('.review-card-head').getByRole('img');
export const saveMarksOf = (page: Page, card: CardRef): Locator => cardItem(page, card).getByRole('button', { name: /^Save Marks/ });
// What the collapsed header says remains.
export const remainsOf = (page: Page, card: CardRef): Locator => cardItem(page, card).locator('.review-card-remains');

