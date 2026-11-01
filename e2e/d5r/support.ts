// Shared support for the D5R browser suite (plan section 6.2): D5's helpers, which re-export D4's card helpers (decision 65,
// section 6.4), plus what the card cases need: the card fixture created through the UI, a way to tell the two XYZ cards
// apart, and the slider and Save Marks locators.
import type { Locator, Page } from '@playwright/test';
import {
  actionFormOf, backToTrade, cardHeader, cardList, confirmReference, createTradeAt, createTrades, deferEntry, enterMark, expect, FOUR_TRADES, PLAN, panelHeader, reachCard, reachPanel, READY, recordEntry, reflectionsOf, saveAction, tradeCard,
  type CardPanel, type FixtureTrade, type PlanValues,
} from '../d5/support.ts';

export * from '../d5/support.ts';

export const FRIDAY = 'Fri Oct 9';
export const THURSDAY = 'Thu Oct 8';

// ---- The card fixture (plan section 4), created through the UI -------------------------------------------------------

export type CardTrade = 'T-A' | 'T-B' | 'T-C' | 'T-E' | 'T-F';
export const SYMBOL: Readonly<Record<CardTrade, string>> = { 'T-A': 'XYZ', 'T-B': 'ABC', 'T-C': 'DEF', 'T-E': 'JKL', 'T-F': 'XYZ' };
const isShared = (trade: CardTrade): boolean => trade === 'T-A' || trade === 'T-F';

const T_A: PlanValues = FOUR_TRADES[0]!.plan;
const T_F: PlanValues = { ...PLAN, symbol: 'XYZ', quantity: '50', entry: '50', stop: '48', target: '55' };

// D4's five-Trade fixture without T-D, with T-F (50 shares at 50.00, Monday 10:30), T-A's first Position Change on an
// earlier day at 10:00 with no Mark for that day (Friday, or Thursday for the case that needs two earlier sessions), and
// both of T-A's Position Changes recorded with Reflect later: D-1 (due in Monday's Review) and D-2 (Monday 11:00).
export async function createCardFixture(page: Page, options: { readonly earlierDay?: '2026-10-09' | '2026-10-08' } = {}): Promise<void> {
  const day = options.earlierDay ?? '2026-10-09';
  await createTradeAt(page, T_A, `${day}T09:30`, []);
  await deferEntry(page, [{ quantity: '60', price: '50.10', fee: '1.00', time: `${day}T10:00` }]);
  await backToTrade(page, 'XYZ');
  await deferEntry(page, [{ quantity: '40', price: '50.30', fee: '1.00', time: '2026-10-12T11:00' }]);
  await createTrades(page, FOUR_TRADES.slice(1));
  await confirmReference(page, T_F);
  await recordEntry(page, [{ quantity: '50', price: '50.00', fee: '1.00', time: '2026-10-12T10:30' }]);
}

// Routine Trades for the long list: one Long Stock Trade each, entered Monday 10:00.
export async function createRoutineTrades(page: Page, count: number): Promise<void> {
  const trades: FixtureTrade[] = Array.from({ length: count }, (_, i) => ({
    plan: { ...PLAN, symbol: `ZZ${String.fromCharCode(65 + i)}`, quantity: '100', entry: '20', stop: '19', target: '30' },
    fills: [['100', '20.00', '2026-10-12T10:00']],
  }));
  await createTrades(page, trades);
}

// ---- Telling T-A's card from T-F's -------------------------------------------------------------------------------------

// T-A and T-F share the Underlying XYZ, so the symbol-qualified card helpers cannot tell their cards apart. Their list items
// are marked once, right after the Review loads, while only T-A owes a reflection (D-1); the mark stays on the item as the
// cards re-sort. The helpers below take a fixture Trade and fall back to the card helpers for the Trades with their own symbol.
export async function tagCards(page: Page): Promise<void> {
  await expect(cardList(page)).toBeVisible(READY);
  const tagged = await page.evaluate(() => {
    const xyz = [...document.querySelectorAll<HTMLElement>('ol[aria-label="Positions"] > li.review-card')].filter((li) => li.querySelector('.review-card-name')?.textContent === 'XYZ');
    const owing = xyz.filter((li) => li.querySelector('.review-card-remains')?.textContent?.includes('reflection due'));
    if (xyz.length !== 2 || owing.length !== 1) return false;
    owing[0]!.dataset['trade'] = 'T-A';
    xyz.find((li) => li !== owing[0])!.dataset['trade'] = 'T-F';
    return true;
  });
  if (!tagged) throw new Error('Cannot tell T-A from T-F: expected two XYZ cards, exactly one owing a reflection. Tag the cards right after the Review loads.');
}

// The list item of a fixture Trade's card, collapsed or open.
export const cardItem = (page: Page, trade: CardTrade): Locator =>
  isShared(trade) ? page.locator(`li.review-card[data-trade="${trade}"]`) : cardList(page).locator('li.review-card').filter({ has: cardHeader(page, SYMBOL[trade]) });

// Raw locators that never click (section 6.4, rule 4).
export const headerOf = (page: Page, trade: CardTrade): Locator => (isShared(trade) ? cardItem(page, trade).getByRole('button', { name: /^Review / }) : cardHeader(page, SYMBOL[trade]));
export const panelHeaderOf = (page: Page, trade: CardTrade, panel: CardPanel): Locator =>
  isShared(trade) ? cardItem(page, trade).getByRole('button', { name: new RegExp(`^${panel}\\b`) }) : panelHeader(page, SYMBOL[trade], panel);
// The Stop-to-Target slider of a card's header (a collapsed card shows it too), and its parts.
export const sliderOf = (page: Page, trade: CardTrade): Locator => cardItem(page, trade).locator('.review-card-head').getByRole('img');
export const saveMarksOf = (page: Page, trade: CardTrade): Locator => cardItem(page, trade).getByRole('button', { name: /^Save Marks/ });
// What the collapsed header says remains.
export const remainsOf = (page: Page, trade: CardTrade): Locator => cardItem(page, trade).locator('.review-card-remains');

// ---- The card helpers for a fixture Trade (decision 65: idempotent, loud on refusal, reads never save) ---------------------

export async function reachTrade(page: Page, trade: CardTrade): Promise<Locator> {
  if (!isShared(trade)) return reachCard(page, SYMBOL[trade]);
  const header = headerOf(page, trade);
  await expect(header).toBeVisible(READY);
  if ((await header.getAttribute('aria-expanded')) !== 'true') {
    await header.click();
    const hold = page.getByRole('status').filter({ hasText: /^Save or discard what you entered for / });
    const outcome = async (): Promise<'opened' | 'refused' | 'waiting'> => {
      if ((await header.getAttribute('aria-expanded')) === 'true') return 'opened';
      return (await hold.count()) > 0 ? 'refused' : 'waiting';
    };
    await expect.poll(outcome, READY).not.toBe('waiting');
    if ((await outcome()) === 'refused') {
      const holder = /entered for (.+?) to leave it/.exec((await hold.first().textContent()) ?? '')?.[1] ?? 'the open card';
      throw new Error(`Cannot reach ${trade}'s card: ${holder}'s card holds unsaved work, so it stays open. Save or discard it first; the helper does neither.`);
    }
  }
  await expect(header).toHaveAttribute('aria-expanded', 'true');
  await expect(tradeCard(page, SYMBOL[trade])).toBeVisible(READY);
  return tradeCard(page, SYMBOL[trade]);
}

export async function reachTradePanel(page: Page, trade: CardTrade, panel: CardPanel): Promise<Locator> {
  if (!isShared(trade)) return reachPanel(page, SYMBOL[trade], panel);
  await reachTrade(page, trade);
  const header = panelHeaderOf(page, trade, panel);
  await expect(header).toBeVisible(READY);
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'true');
  return page.locator(`[id="${await header.getAttribute('aria-controls')}"]`);
}

export async function markRowOf(page: Page, trade: CardTrade, date: string): Promise<Locator> {
  return (await reachTradePanel(page, trade, 'Marks')).getByRole('region', { name: `${SYMBOL[trade]} Mark, ${date}`, exact: true });
}

// Types the price in the trade's card and presses Save Marks; returns once the result has cleared the drafts.
export async function enterMarkOf(page: Page, trade: CardTrade, date: string, price: string): Promise<void> {
  if (!isShared(trade)) return enterMark(page, SYMBOL[trade], date, price);
  const row = await markRowOf(page, trade, date);
  await row.getByLabel('Price').fill(price);
  await (await reachTradePanel(page, trade, 'Marks')).getByRole('button', { name: /^Save Marks/ }).click();
  // The result may re-mount the card's body, so the button is found again from the card.
  await expect(tradeCard(page, SYMBOL[trade]).locator('section[aria-label="Marks"] button', { hasText: /^Save Marks/ })).toHaveText('Save Marks (0)', READY);
}

export async function actionFormOfTrade(page: Page, trade: CardTrade): Promise<Locator> {
  return isShared(trade) ? (await reachTradePanel(page, trade, 'Action')).getByRole('form', { name: 'Action' }) : actionFormOf(page, SYMBOL[trade]);
}

export async function saveActionOf(page: Page, trade: CardTrade, action: 'Hold' | 'Exit' | 'Roll' | 'Adjust', intent: string | undefined): Promise<void> {
  if (!isShared(trade)) return saveAction(page, action, intent, SYMBOL[trade]);
  const form = await actionFormOfTrade(page, trade);
  const pressed = await form.elementHandle();
  await form.getByRole('radio', { name: action, exact: true }).check();
  if (intent !== undefined) await form.getByLabel(/^Why are you taking this action\?/).fill(intent);
  await form.getByRole('button', { name: 'Save' }).click();
  await pressed?.waitForElementState('hidden', READY);
}

export async function reflectionsOfTrade(page: Page, trade: CardTrade): Promise<Locator> {
  return isShared(trade) ? (await reachTradePanel(page, trade, 'Reflections')).getByRole('region', { name: 'Reflections', exact: true }) : reflectionsOf(page, SYMBOL[trade]);
}

export async function debtFormOfTrade(page: Page, trade: CardTrade): Promise<Locator> {
  return (await reachTradePanel(page, trade, 'Reflections')).getByRole('form', { name: 'Reflection' });
}

// Presses Answer and waits for the saved result to replace the form (the card then moves on to its next panel).
export async function answerDebtOf(page: Page, trade: CardTrade): Promise<void> {
  const form = await debtFormOfTrade(page, trade);
  await form.getByRole('button', { name: 'Answer', exact: true }).click();
  await expect(form).toBeHidden(READY);
  await reachTradePanel(page, trade, 'Reflections');
  await expect(page.getByRole('region', { name: 'Saved reflection' })).toBeVisible();
}
