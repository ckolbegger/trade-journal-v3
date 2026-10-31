// Shared support for the D4 browser suite (plan section 6.2): D2's steps and probe helpers, the
// production d5 release (the current source) as the default served build, the Playwright clock that sets the date, the
// four-Trade fixture (the five-Trade fixture without T-D) created through the UI, and the Review steps.
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { backToTrade, confirmReference, expect, fillPlan, firstPage, onboardedPage, PLAN, READY, recordEntry, test as d1Test, type PlanValues, type Profile, type ProbedDatabase } from '../d2/support.ts';

export * from '../d2/support.ts';

// Routine D4 cases run the production build (dist-releases/d5); the faults build is only for the
// cases that need its hooks, which switch with `server.use('dist-faults')` before launching.
export const test = d1Test.extend<{ d4Release: void }>({
  d4Release: [
    async ({ server }, provide) => {
      server.use('dist-releases/d5');
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

// Creates each Trade through the UI: Plan, then one Position Change per fill.
export async function createTrades(page: Page, trades: readonly FixtureTrade[] = FOUR_TRADES): Promise<void> {
  for (const trade of trades) {
    await confirmReference(page, trade.plan);
    for (const [index, [quantity, price, time]] of trade.fills.entries()) {
      if (index > 0) await backToTrade(page, trade.plan.symbol);
      await recordEntry(page, [{ quantity, price, fee: '1.00', time }]);
    }
  }
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
export async function createTradeAt(page: Page, values: PlanValues, planTime: string, fills: readonly (readonly [string, string, string])[]): Promise<void> {
  await nav(page).getByRole('link', { name: 'New Plan' }).click();
  await fillPlan(page, values);
  await page.getByLabel('Plan time').fill(planTime);
  await page.getByRole('button', { name: 'Confirm Plan' }).click();
  await expect(page.getByRole('heading', { name: values.symbol, level: 1 })).toBeVisible();
  for (const [index, [quantity, price, time]] of fills.entries()) {
    if (index > 0) await backToTrade(page, values.symbol);
    await recordEntry(page, [{ quantity, price, fee: '1.00', time }]);
  }
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
// ---- Card helpers (decision 65, D5R section 6.4) -----------------------------------------------

export type CardPanel = Panel;
export const tradeCard = (page: Page, symbol: string): Locator => page.getByRole('region', { name: `${symbol} review`, exact: true });
// Raw locators: they never click, so a step that asserts which card or panel is open can read them before any reach.
// A symbol may hold a dot (BRK.B): it is escaped, and must be followed by whitespace or the end, so BRK never matches BRK.B.
export const cardHeader = (page: Page, symbol: string): Locator =>
  page.getByRole('button', { name: new RegExp(`^Review ${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`) });
export const panelHeader = (page: Page, symbol: string, panel: Panel): Locator => tradeCard(page, symbol).getByRole('button', { name: new RegExp(`^${panel}\\b`) });
export async function openPanelOf(page: Page, symbol: string): Promise<Panel | undefined> {
  for (const name of PANELS) if ((await panelHeader(page, symbol, name).getAttribute('aria-expanded')) === 'true') return name;
  return undefined;
}

// A previous release's Review (rule 5): the Trade card is reached from the Trades family, and the Marks family is not a card's.
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
export async function reachCard(page: Page, symbol: string): Promise<Locator> {
  if (!(await hasCards(page))) return reachOldCard(page, symbol);
  const header = cardHeader(page, symbol);
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
    if ((await outcome()) === 'refused') {
      const holder = /entered for (.+?) to leave it/.exec((await hold.first().textContent()) ?? '')?.[1] ?? 'the open card';
      throw new Error(`Cannot reach ${symbol}'s card: ${holder}'s card holds unsaved work, so it stays open. Save or discard it first; the helper does neither.`);
    }
  }
  await expect(header).toHaveAttribute('aria-expanded', 'true');
  await expect(tradeCard(page, symbol)).toBeVisible(READY);
  return tradeCard(page, symbol);
}
// Reaches the card, then opens the panel unless it is open; returns the panel's content.
export async function reachPanel(page: Page, symbol: string, panel: Panel): Promise<Locator> {
  if (!(await hasCards(page))) return panel === 'Marks' ? marksFamily(page) : reachOldCard(page, symbol);
  await reachCard(page, symbol);
  const header = panelHeader(page, symbol, panel);
  await expect(header).toBeVisible(READY);
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'true');
  return page.locator(`[id="${await header.getAttribute('aria-controls')}"]`);
}
export async function markRow(page: Page, symbol: string, date: string): Promise<Locator> {
  return (await reachPanel(page, symbol, 'Marks')).getByRole('region', { name: `${symbol} Mark, ${date}`, exact: true });
}
export async function actionFormOf(page: Page, symbol: string): Promise<Locator> {
  return (await reachPanel(page, symbol, 'Action')).getByRole('form', { name: 'Action' });
}
export async function reflectionsOf(page: Page, symbol: string): Promise<Locator> {
  return (await reachPanel(page, symbol, 'Reflections')).getByRole('region', { name: 'Reflections', exact: true });
}
export async function debtFormOf(page: Page, symbol: string): Promise<Locator> {
  return (await reachPanel(page, symbol, 'Reflections')).getByRole('form', { name: 'Reflection' });
}

// Shows the saved row in the Marks panel, then puts back the panel Save Marks moved the card on to (A157).
async function checkSavedRow(page: Page, symbol: string, date: string, text: string): Promise<void> {
  // The drafts are cleared with the same result that moves the card on; the panel may already be hidden.
  await expect(tradeCard(page, symbol).locator('section[aria-label="Marks"] button', { hasText: /^Save Marks/ })).toHaveText('Save Marks (0)', READY);
  const moved = await openPanelOf(page, symbol);
  await expect(await markRow(page, symbol, date)).toContainText(text);
  if (moved !== undefined && moved !== 'Marks') await reachPanel(page, symbol, moved);
}

// On cards the price is a draft in the open card's Marks panel, saved with Save Marks (D5R, A153); a previous release's
// Review enters it in the row and saves it there.
export async function enterMark(page: Page, symbol: string, date: string, price: string): Promise<void> {
  const cards = await hasCards(page);
  const entry = await markRow(page, symbol, date);
  if (cards) {
    await entry.getByLabel('Price').fill(price);
    await (await reachPanel(page, symbol, 'Marks')).getByRole('button', { name: /^Save Marks/ }).click();
  } else {
    await entry.getByRole('button', { name: 'Enter', exact: true }).click();
    await entry.getByLabel('Price').fill(price);
    await entry.getByRole('button', { name: 'Save Mark' }).click();
  }
  if (cards) await checkSavedRow(page, symbol, date, 'Manual');
  else await expect(entry.getByText('Manual')).toBeVisible();
}

export async function acknowledgeMark(page: Page, symbol: string, date: string, reason: string): Promise<void> {
  const cards = await hasCards(page);
  const entry = await markRow(page, symbol, date);
  await entry.getByRole('button', { name: "Can't get a price" }).click();
  await entry.getByLabel('Reason (required)').fill(reason);
  if (cards) await (await reachPanel(page, symbol, 'Marks')).getByRole('button', { name: /^Save Marks/ }).click();
  else await entry.getByRole('button', { name: 'Save acknowledgment' }).click();
  if (cards) await checkSavedRow(page, symbol, date, 'Acknowledged Unavailable');
  else await expect(entry.getByText('Acknowledged Unavailable')).toBeVisible();
}

// Fills the Trade's Action form and presses Save; Hold needs no Intent. Returns once the save result has
// rendered: a Saved result replaces the form (the next Trade's form, or none), so the element that was
// pressed is gone. Until then the Review's binding is the old one, and opening another Trade would use it.
export async function saveAction(page: Page, action: 'Hold' | 'Exit' | 'Roll' | 'Adjust', intent: string | undefined, symbol: string): Promise<void> {
  const form = await actionFormOf(page, symbol);
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
