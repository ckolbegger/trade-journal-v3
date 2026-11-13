// Shared support for the D4 browser suite (plan section 6.2): D2's steps and probe helpers, the
// production d6 release (the current source) as the default served build, the Playwright clock that sets the date, the
// four-Trade fixture (the five-Trade fixture without T-D) created through the UI, and the Review steps.
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { backToTrade, confirmReference, detail, expect, fillPlan, firstPage, onboardedPage, PLAN, READY, recordEntry, test as d1Test, type PlanValues, type Profile, type ProbedDatabase } from '../d2/support.ts';

export * from '../d2/support.ts';

// Routine D4 cases run the production build (dist-releases/d6); the faults build is only for the
// cases that need its hooks, which switch with `server.use('dist-faults')` before launching.
export const test = d1Test.extend<{ d4Release: void }>({
  d4Release: [
    async ({ server }, provide) => {
      server.use('dist-releases/d6');
      await provide();
    },
    { auto: true },
  ],
});

const nav = (page: Page) => page.getByRole('navigation', { name: 'Primary' });

// Instants in America/New_York (EDT, UTC-4) used by the cases.
export const MONDAY_1700 = '2026-10-12T21:00:00Z';
export const TUESDAY_NOON = '2026-10-13T16:00:00Z';
export const TUESDAY_1700 = '2026-10-13T21:00:00Z';
export const FRIDAY_1700 = '2026-10-09T21:00:00Z';

// Launches the profile with Date pinned by Playwright's clock (timers and performance.now stay
// real in setFixedTime); the app reads the system clock, so every page of the context sees it.
export async function pinClock(context: BrowserContext, instant: string): Promise<void> {
  await context.clock.setFixedTime(new Date(instant));
  // Chromium's native Temporal (which the application's clock uses when present) is not covered by
  // Playwright's clock, so its Now.instant is pointed at the pinned Date. Nothing else changes.
  await context.addInitScript(() => {
    const native = (globalThis as unknown as { Temporal?: { Now: { instant: () => unknown }; Instant: { fromEpochMilliseconds: (ms: number) => unknown } } }).Temporal;
    if (native) native.Now.instant = () => native.Instant.fromEpochMilliseconds(Date.now());
  });
}

export async function launchAt(profile: Profile, instant: string, options: { offline?: boolean; width?: number } = {}): Promise<BrowserContext> {
  const context = await profile.launch(options);
  await pinClock(context, instant);
  return context;
}

// A fresh profile at the instant, taken through first run and onboarding.
export async function onboardedAt(profile: Profile, instant: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await launchAt(profile, instant);
  return { context, page: await onboardedPage(context) };
}

// Moves the pinned date and reloads the first page, as a user returning later would.
export async function setClock(context: BrowserContext, page: Page, instant: string, path = '/'): Promise<void> {
  await context.clock.setFixedTime(new Date(instant));
  await page.goto(path);
}

export interface FixtureTrade {
  readonly plan: PlanValues;
  // Fills as Position Changes: each is [quantity, price], all at the given time with fee 1.00.
  readonly fills: readonly (readonly [string, string, string])[];
}

const plan = (symbol: string, quantity: string, entry: string, stop: string, target: string): PlanValues => ({ ...PLAN, symbol, quantity, entry, stop, target });
const AT_10 = '2026-10-12T10:00';
const AT_11 = '2026-10-12T11:00';

// The five-Trade fixture without T-D (all Long Stock, Monday 2026-10-12): T-A XYZ (two entries),
// T-B ABC, T-C DEF and T-E JKL.
export const FOUR_TRADES: readonly FixtureTrade[] = [
  { plan: plan('XYZ', '100', '50', '47.50', '56'), fills: [['60', '50.10', AT_10], ['40', '50.30', AT_11]] },
  { plan: plan('ABC', '100', '30', '28', '36'), fills: [['100', '30.00', AT_10]] },
  { plan: plan('DEF', '100', '40', '38', '46'), fills: [['100', '40.00', AT_10]] },
  { plan: plan('JKL', '100', '20', '19', '30'), fills: [['100', '20.00', AT_10]] },
];

// The id of the Trade whose page is open, read from its /trades/<id> URL (an id is stored data, so it holds across reloads).
export async function currentTradeId(page: Page): Promise<string> {
  await expect(page).toHaveURL(/\/trades\/[^/?#]+/, READY);
  return /\/trades\/([^/?#]+)/.exec(page.url())![1]!;
}

// Creates each Trade through the UI: Plan, then one Position Change per fill. Returns each Trade's id, in order.
export async function createTrades(page: Page, trades: readonly FixtureTrade[] = FOUR_TRADES): Promise<string[]> {
  const ids: string[] = [];
  for (const trade of trades) {
    await confirmReference(page, trade.plan);
    ids.push(await currentTradeId(page));
    for (const [index, [quantity, price, time]] of trade.fills.entries()) {
      if (index > 0) await backToTrade(page, trade.plan.symbol);
      await recordEntry(page, [{ quantity, price, fee: '1.00', time }]);
    }
  }
  return ids;
}

// Records, across every document the context loads (the update's Reload may load more than one),
// whether the migration message was ever rendered; the page reports it to the test through a
// binding, so a reload cannot reset the answer. The observer reads the DOM and changes nothing.
export async function watchUpdatingAcrossDocuments(context: BrowserContext): Promise<{ seen(): boolean }> {
  let seen = false;
  await context.exposeFunction('__tjUpdatingSeen', () => void (seen = true));
  await context.addInitScript(() => {
    new MutationObserver(() => {
      if (document.body?.textContent?.includes('Updating your journal to this release')) void (window as unknown as { __tjUpdatingSeen: () => void }).__tjUpdatingSeen();
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
  return { seen: () => seen };
}

// Confirms a Plan dated `planTime` and records one fill at `fillTime` (both Workspace-local), ending on its receipt.
// Returns the Trade's id.
export async function createTradeAt(page: Page, values: PlanValues, planTime: string, fills: readonly (readonly [string, string, string])[]): Promise<string> {
  await nav(page).getByRole('link', { name: 'New Plan' }).click();
  await fillPlan(page, values);
  await page.getByLabel('Plan time').fill(planTime);
  await page.getByRole('button', { name: 'Confirm Plan' }).click();
  await expect(detail.heading(page, values.symbol)).toBeVisible();
  const tradeId = await currentTradeId(page);
  for (const [index, [quantity, price, time]] of fills.entries()) {
    if (index > 0) await backToTrade(page, values.symbol);
    await recordEntry(page, [{ quantity, price, fee: '1.00', time }]);
  }
  return tradeId;
}

// ---- The Review's steps ----------------------------------------------------------------------

export async function openReview(page: Page): Promise<void> {
  await nav(page).getByRole('link', { name: 'Review' }).click();
  await expect(page.getByRole('heading', { name: 'Review', level: 1 })).toBeVisible(READY);
  await expect(page.getByRole('region', { name: 'Review status' })).toBeVisible(READY);
}

export const status = (page: Page): Locator => page.getByRole('region', { name: 'Review status' });
// The completion word alone: Incomplete, Complete, or Complete with Unavailable Marks.
export const completion = (page: Page): Locator => status(page).locator('strong');

// Reloads the Review (a full page load, so every figure is read back from stored facts).
export async function reloadReview(page: Page): Promise<void> {
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Review', level: 1 })).toBeVisible(READY);
  await expect(status(page)).toBeVisible(READY);
}
// The Review is a list of position cards (D5R, A150); the open card holds its own Marks.
export const cardList = (page: Page): Locator => page.getByRole('list', { name: 'Positions' });
// The update cases first run a previous release, whose Review has the Marks family, Continue to Trades and the Trades family
// instead of cards. The helpers follow whichever Review is on the page, once its status has rendered.
async function hasCards(page: Page): Promise<boolean> {
  await expect(page.getByRole('region', { name: 'Review status' })).toBeVisible(READY);
  return (await cardList(page).count()) > 0;
}
// The Marks inside the open card.
export const marksFamily = (page: Page): Locator => page.getByRole('region', { name: 'Marks', exact: true });

// The list of Trades: the cards' list, or a previous release's Trades section. A raw locator that never clicks, for the
// steps that assert navigation (rule 4) or read an old release (rule 5), as marksFamily is.
export const tradesFamily = (page: Page): Locator => page.locator('ol[aria-label="Positions"], section[aria-label="Trades"]');

// The three panels of the open card, in order (D5R, A152), and the one that is open.
const PANELS = ['Marks', 'Reflections', 'Action'] as const;
type Panel = (typeof PANELS)[number];
const anyPanelHeader = (page: Page, name: Panel): Locator => page.getByRole('region', { name: / review$/ }).getByRole('button', { name: new RegExp(`^${name}\\b`) });
export async function openPanel(page: Page): Promise<Panel | undefined> {
  for (const name of PANELS) if ((await anyPanelHeader(page, name).getAttribute('aria-expanded')) === 'true') return name;
  return undefined;
}
// Opens a panel of the open card by its header, unless it is already open.
export async function showPanel(page: Page, name: Panel): Promise<void> {
  const header = anyPanelHeader(page, name);
  await expect(header).toBeVisible(READY);
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'true');
}
// ---- Card helpers (decision 65, D5R section 6.4; decision 68, section 6.5) ---------------------------------------

export type CardPanel = Panel;
// A card is named by a symbol (the card for that Underlying) or by a Trade reference. Two Trades can hold one Underlying and
// their cards then read alike, so only the Trade id (the list item's data-trade-id) tells them apart; the label, when given,
// is what a failure message calls the Trade.
export interface TradeRef {
  readonly symbol: string;
  readonly tradeId: string;
  readonly label?: string;
}
export type CardRef = string | TradeRef;
const symbolOf = (card: CardRef): string => (typeof card === 'string' ? card : card.symbol);
// Labels of the Trade references the helpers have been given, by Trade id, so a failure can name the open card by label.
const labelOfId = new Map<string, string>();

// The one resolver every card helper goes through: the card's list item, its header button and its body region. A Trade
// reference looks inside the list item with its Trade id, so nothing is ever read from another Trade's card. A symbol may hold a
// dot (BRK.B): it is escaped, and must be followed by whitespace or the end, so BRK never matches BRK.B. The body is named for
// the symbol, so the nested Mark-row, Marks and Saved Action regions never match.
function resolve(page: Page, card: CardRef): { item: Locator; header: Locator; body: Locator } {
  const symbol = symbolOf(card);
  const headerName = new RegExp(`^Review ${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`);
  // The body is labelled with the Trade's name, "XYZ (Long 100 shares @ $50.18) review", or "XYZ review" without a summary (decision 68);
  // D4's old release has the bare form only. The pattern is anchored at both ends, so the nested regions never match.
  const bodyName = new RegExp(`^${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: \\([^)]*\\))? review$`);
  if (typeof card === 'string') {
    const header = page.getByRole('button', { name: headerName });
    return { item: cardList(page).locator('li.review-card').filter({ has: header }), header, body: page.getByRole('region', { name: bodyName }) };
  }
  if (card.label !== undefined) labelOfId.set(card.tradeId, card.label);
  const item = page.locator(`li.review-card[data-trade-id="${card.tradeId}"]`);
  return { item, header: item.getByRole('button', { name: headerName }), body: item.getByRole('region', { name: bodyName }) };
}

// The card's list item, collapsed or open.
export const cardItem = (page: Page, card: CardRef): Locator => resolve(page, card).item;
export const tradeCard = (page: Page, card: CardRef): Locator => resolve(page, card).body;
// Raw locators: they never click, so a step that asserts which card or panel is open can read them before any reach.
export const cardHeader = (page: Page, card: CardRef): Locator => resolve(page, card).header;
export const panelHeader = (page: Page, card: CardRef, panel: Panel): Locator => tradeCard(page, card).getByRole('button', { name: new RegExp(`^${panel}\\b`) });
export async function openPanelOf(page: Page, card: CardRef): Promise<Panel | undefined> {
  for (const name of PANELS) if ((await panelHeader(page, card, name).getAttribute('aria-expanded')) === 'true') return name;
  return undefined;
}

// A previous release's Review (rule 5): the Trade card is reached from the Trades family, and the Marks family is not a card's.
// There are no list items to tell Trades apart there, so a Trade reference falls back to its symbol.
async function reachOldCard(page: Page, symbol: string): Promise<Locator> {
  if ((await tradeCard(page, symbol).count()) === 0) {
    if ((await tradesFamily(page).count()) === 0) await page.getByRole('button', { name: 'Continue to Trades' }).click();
    await expect(tradesFamily(page)).toBeVisible(READY);
    await tradesFamily(page).getByRole('button', { name: `Review ${symbol}` }).click();
  }
  await expect(tradeCard(page, symbol)).toBeVisible(READY);
  return tradeCard(page, symbol);
}

// Opens the Trade's card unless it is open (a header press toggles), waits for its content, and returns its region.
export async function reachCard(page: Page, card: CardRef): Promise<Locator> {
  if (!(await hasCards(page))) return reachOldCard(page, symbolOf(card));
  const header = cardHeader(page, card);
  await expect(header).toBeVisible(READY);
  if ((await header.getAttribute('aria-expanded')) !== 'true') {
    await header.click();
    // Opening is refused while the open card holds unsaved work (A156): it says so, and stays open.
    const hold = page.getByRole('status').filter({ hasText: /^Save or discard what you entered for / });
    const outcome = async (): Promise<'opened' | 'refused' | 'waiting'> => {
      if ((await header.getAttribute('aria-expanded')) === 'true') return 'opened';
      return (await hold.count()) > 0 ? 'refused' : 'waiting';
    };
    await expect.poll(outcome, READY).not.toBe('waiting');
    if ((await outcome()) === 'refused') throw await refusal(page, card, hold);
  }
  await expect(header).toHaveAttribute('aria-expanded', 'true');
  await expect(tradeCard(page, card)).toBeVisible(READY);
  return tradeCard(page, card);
}
// The failure for a refused reach: it names both cards, since two Trades on one Underlying both read "XYZ". The holder is the
// list item whose header is expanded, found by its Trade id: named by the label of a Trade reference the helpers have been
// given, else by its symbol (read from the hold message) and the id.
async function refusal(page: Page, card: CardRef, hold: Locator): Promise<Error> {
  const open = page.locator('li.review-card').filter({ has: page.getByRole('button', { name: /^Review /, expanded: true }) });
  const holderId = (await open.count()) > 0 ? await open.first().getAttribute('data-trade-id') : null;
  const symbol = /entered for (.+?) to leave it/.exec((await hold.first().textContent()) ?? '')?.[1] ?? 'the open card';
  const holder = holderId === null ? symbol : (labelOfId.get(holderId) ?? `${symbol} (trade ${holderId})`);
  const target = typeof card === 'string' ? card : (card.label ?? `${card.symbol} (trade ${card.tradeId})`);
  return new Error(`Cannot reach ${target}'s card: ${holder}'s card holds unsaved work, so it stays open. Save or discard it first; the helper does neither.`);
}
// Reaches the card, then opens the panel unless it is open; returns the panel's content.
export async function reachPanel(page: Page, card: CardRef, panel: Panel): Promise<Locator> {
  if (!(await hasCards(page))) return panel === 'Marks' ? marksFamily(page) : reachOldCard(page, symbolOf(card));
  await reachCard(page, card);
  const header = panelHeader(page, card, panel);
  await expect(header).toBeVisible(READY);
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'true');
  return page.locator(`[id="${await header.getAttribute('aria-controls')}"]`);
}
export async function markRow(page: Page, card: CardRef, date: string): Promise<Locator> {
  return (await reachPanel(page, card, 'Marks')).getByRole('region', { name: `${symbolOf(card)} Mark, ${date}`, exact: true });
}
export async function actionFormOf(page: Page, card: CardRef): Promise<Locator> {
  return (await reachPanel(page, card, 'Action')).getByRole('form', { name: 'Action' });
}
export async function reflectionsOf(page: Page, card: CardRef): Promise<Locator> {
  return (await reachPanel(page, card, 'Reflections')).getByRole('region', { name: 'Reflections', exact: true });
}
export async function debtFormOf(page: Page, card: CardRef): Promise<Locator> {
  return (await reachPanel(page, card, 'Reflections')).getByRole('form', { name: 'Reflection' });
}

// Shows the saved row in the Marks panel, then puts back the panel Save Marks moved the card on to (A157).
async function checkSavedRow(page: Page, card: CardRef, date: string, text: string): Promise<void> {
  // The drafts are cleared with the same result that moves the card on; the panel may already be hidden.
  await expect(tradeCard(page, card).locator('section[aria-label="Marks"] button', { hasText: /^Save Marks/ })).toHaveText('Save Marks (0)', READY);
  const moved = await openPanelOf(page, card);
  await expect(await markRow(page, card, date)).toContainText(text);
  if (moved !== undefined && moved !== 'Marks') await reachPanel(page, card, moved);
}

// On cards the price is a draft in the open card's Marks panel, saved with Save Marks (D5R, A153); a previous release's
// Review enters it in the row and saves it there.
export async function enterMark(page: Page, card: CardRef, date: string, price: string): Promise<void> {
  const cards = await hasCards(page);
  const entry = await markRow(page, card, date);
  if (cards) {
    await entry.getByLabel('Price').fill(price);
    await (await reachPanel(page, card, 'Marks')).getByRole('button', { name: /^Save Marks/ }).click();
  } else {
    await entry.getByRole('button', { name: 'Enter', exact: true }).click();
    await entry.getByLabel('Price').fill(price);
    await entry.getByRole('button', { name: 'Save Mark' }).click();
  }
  if (cards) await checkSavedRow(page, card, date, 'Manual');
  else await expect(entry.getByText('Manual')).toBeVisible();
}

export async function acknowledgeMark(page: Page, card: CardRef, date: string, reason: string): Promise<void> {
  const cards = await hasCards(page);
  const entry = await markRow(page, card, date);
  await entry.getByRole('button', { name: "Can't get a price" }).click();
  await entry.getByLabel('Reason (required)').fill(reason);
  if (cards) await (await reachPanel(page, card, 'Marks')).getByRole('button', { name: /^Save Marks/ }).click();
  else await entry.getByRole('button', { name: 'Save acknowledgment' }).click();
  if (cards) await checkSavedRow(page, card, date, 'Acknowledged Unavailable');
  else await expect(entry.getByText('Acknowledged Unavailable')).toBeVisible();
}

// Fills the Trade's Action form and presses Save; Hold needs no Intent. Returns once the save result has
// rendered: a Saved result replaces the form (the next Trade's form, or none), so the element that was
// pressed is gone. Until then the Review's binding is the old one, and opening another Trade would use it.
export async function saveAction(page: Page, action: 'Hold' | 'Exit' | 'Roll' | 'Adjust', intent: string | undefined, card: CardRef): Promise<void> {
  const form = await actionFormOf(page, card);
  const pressed = await form.elementHandle();
  await form.getByRole('radio', { name: action, exact: true }).check();
  if (intent !== undefined) await form.getByLabel(/^Why are you taking this action\?/).fill(intent);
  await form.getByRole('button', { name: 'Save' }).click();
  await pressed?.waitForElementState('hidden', READY);
}

// ---- Stored records, read through the probe ---------------------------------------------------

export interface StoredObservation {
  readonly instrumentKey: string;
  readonly tradingDate: string;
  readonly marks: readonly { readonly price: string; readonly revisionNumber: number; readonly intention: string; readonly reason?: string }[];
  readonly acknowledgments: readonly { readonly kind: string; readonly reason?: string }[];
}
export interface StoredEntry {
  readonly entryTypeKey: string;
  readonly obligationKey?: readonly unknown[];
  readonly versions?: readonly unknown[];
}

export const ACTION_ENTRY_TYPE = 'entry-type.daily-trade-review';
export const observationsOf = (workspace: ProbedDatabase): StoredObservation[] => workspace.stores['observations'] as StoredObservation[];
export const actionEntriesOf = (workspace: ProbedDatabase): StoredEntry[] => (workspace.stores['journalEntries'] as StoredEntry[]).filter((e) => e.entryTypeKey === ACTION_ENTRY_TYPE);

export { firstPage };
