// Shared support for the D4 browser suite (plan section 6.2): D2's steps and probe helpers, the
// production d4 release as the default served build, the Playwright clock that sets the date, the
// four-Trade fixture (the five-Trade fixture without T-D) created through the UI, and the Review steps.
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { backToTrade, confirmReference, expect, fillPlan, firstPage, onboardedPage, PLAN, READY, recordEntry, test as d1Test, type PlanValues, type Profile, type ProbedDatabase } from '../d2/support.ts';

export * from '../d2/support.ts';

// Routine D4 cases run the production build (dist-releases/d4); the faults build is only for the
// cases that need its hooks, which switch with `server.use('dist-faults')` before launching.
export const test = d1Test.extend<{ d4Release: void }>({
  d4Release: [
    async ({ server }, provide) => {
      server.use('dist-releases/d4');
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
export async function launchAt(profile: Profile, instant: string, options: { offline?: boolean; width?: number } = {}): Promise<BrowserContext> {
  const context = await profile.launch(options);
  await context.clock.setFixedTime(new Date(instant));
  // Chromium's native Temporal (which the application's clock uses when present) is not covered by
  // Playwright's clock, so its Now.instant is pointed at the pinned Date. Nothing else changes.
  await context.addInitScript(() => {
    const native = (globalThis as unknown as { Temporal?: { Now: { instant: () => unknown }; Instant: { fromEpochMilliseconds: (ms: number) => unknown } } }).Temporal;
    if (native) native.Now.instant = () => native.Instant.fromEpochMilliseconds(Date.now());
  });
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
export const marksFamily = (page: Page): Locator => page.getByRole('region', { name: 'Marks', exact: true });
export const tradesFamily = (page: Page): Locator => page.getByRole('region', { name: 'Trades', exact: true });

// An Instrument's Mark entry for one session ("XYZ Mark, Mon Oct 12").
export const markEntry = (page: Page, symbol: string, date: string): Locator => page.getByRole('region', { name: `${symbol} Mark, ${date}`, exact: true });

export async function enterMark(page: Page, symbol: string, date: string, price: string): Promise<void> {
  const entry = markEntry(page, symbol, date);
  await entry.getByRole('button', { name: 'Enter', exact: true }).click();
  await entry.getByLabel('Price').fill(price);
  await entry.getByRole('button', { name: 'Save Mark' }).click();
  await expect(entry.getByText('Manual')).toBeVisible();
}

export async function acknowledgeMark(page: Page, symbol: string, date: string, reason: string): Promise<void> {
  const entry = markEntry(page, symbol, date);
  await entry.getByRole('button', { name: "Can't get a price" }).click();
  await entry.getByLabel('Reason (required)').fill(reason);
  await entry.getByRole('button', { name: 'Save acknowledgment' }).click();
  await expect(entry.getByText('Acknowledged Unavailable')).toBeVisible();
}

export async function continueToTrades(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Continue to Trades' }).click();
  await expect(tradesFamily(page)).toBeVisible(READY);
}

export const actionForm = (page: Page): Locator => page.getByRole('form', { name: 'Action' });

// Fills the open Action form and presses Save; Hold needs no Intent.
export async function saveAction(page: Page, action: 'Hold' | 'Exit' | 'Roll' | 'Adjust', intent?: string): Promise<void> {
  const form = actionForm(page);
  await form.getByRole('radio', { name: action, exact: true }).check();
  if (intent !== undefined) await form.getByLabel(/^Intent/).fill(intent);
  await form.getByRole('button', { name: 'Save' }).click();
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
