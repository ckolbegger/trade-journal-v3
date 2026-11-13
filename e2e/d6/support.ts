// Shared support for the D6 browser suite (plan section 6.2): D5R's helpers (the Playwright clock, the production d6 release as
// the default served build, the card helpers) plus the exit form's steps, the Closed tab, and the stored records an exit leaves.
import type { Locator, Page } from '@playwright/test';
import { detail, executionRow, expect, FOUR_TRADES, createTrades, READY, type ProbedDatabase, type Row } from '../d5r/support.ts';

export * from '../d5r/support.ts';

// Instants in America/New_York (EDT, UTC-4) used by these cases.
export const TUESDAY_1405 = '2026-10-13T18:05:00Z';
export const TUESDAY_1405_LOCAL = '2026-10-13T14:00';
export const TUESDAY_1000_LOCAL = '2026-10-13T10:00';
export const WEDNESDAY_1405 = '2026-10-14T18:05:00Z';

// T-A (symbol XYZ) with PC1 (60 @ 50.10, fee 1.00) and PC2 (40 @ 50.30, fee 1.00) on Monday, both reflections answered.
export async function createTA(page: Page): Promise<string> {
  const [id] = await createTrades(page, FOUR_TRADES.slice(0, 1));
  return id!;
}

// A Row for an exit.
export const sell = (quantity: string, price: string, fee: string, time: string): Row => ({ quantity, price, fee, time });

// ---- The exit form (?action=Sell) ---------------------------------------------------------------------------------------

export async function openExitForm(page: Page): Promise<void> {
  await detail.recordExitLink(page).click();
  await expect(page.getByRole('heading', { name: 'Record exit', level: 1 })).toBeVisible(READY);
  await expect(executionRow(page, 1)).toBeVisible();
}

export const exitReflection = (page: Page): Locator => page.getByRole('region', { name: 'Reflection on this exit' });
export const closingSection = (page: Page): Locator => page.getByRole('region', { name: 'Closing the Trade' });
export const closeReasonGroup = (page: Page): Locator => closingSection(page).getByRole('radiogroup', { name: 'Close Reason' });
export const closeReviewGroup = (page: Page): Locator => closingSection(page).getByRole('radiogroup', { name: 'Close Review' });

// The three required answers of a reflection inside a section: As Planned, Calm, confidence 4.
export async function answerIn(section: Locator): Promise<void> {
  await section.getByRole('radiogroup', { name: 'Decision mode' }).getByLabel('As Planned').check();
  await section.getByRole('radiogroup', { name: 'Primary emotion' }).getByLabel('Calm').check();
  await section.getByRole('radiogroup', { name: 'Decision confidence' }).getByLabel('4').check();
}

// The Close Review's required answer inside a section or form: Yes, as planned.
export async function answerCloseReviewIn(section: Locator): Promise<void> {
  await section.getByRole('radiogroup', { name: 'Would you take this Trade again under similar conditions?' }).getByLabel('Yes, as planned').check();
}

// Answers the exit's own reflection and the Closing the Trade section of an exit that sells every share: Target Reached, and
// the Close Review either answered ('now') or deferred ('later').
export async function closeTheTrade(page: Page, closeReview: 'now' | 'later'): Promise<void> {
  await answerIn(exitReflection(page));
  await expect(closingSection(page)).toBeVisible();
  await closeReasonGroup(page).getByLabel('Target Reached', { exact: true }).check();
  if (closeReview === 'later') await closeReviewGroup(page).getByLabel('Reflect later').check();
  else await answerCloseReviewIn(closingSection(page));
}

export const receiptResult = (page: Page): Locator => page.getByRole('region', { name: 'Result' });

// ---- Trade Detail and the Closed tab ------------------------------------------------------------------------------------

// The text of the definition-list value that follows a term, within a scope. Never page-wide: a Trade Detail's values are read
// through `detail` (plan section 6.3), so this takes a card or panel, such as a receipt's Result.
export const valueOf = (scope: Locator, term: string): Locator => scope.locator(`dt:text-is("${term}") + dd`);

export async function openClosedTab(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Closed' }).click();
  await expect(page.getByRole('table', { name: 'Closed Trades' })).toBeVisible(READY);
}

// ---- Stored records, read through the probe ----------------------------------------------------------------------------

export const factKindsOf = (trade: { readonly facts: readonly { readonly kind: string }[] }): string[] => trade.facts.map((f) => f.kind);

// Where the Workspace holds a Lot-Match record: a store named for one, or a stored key named for one. None may (P23).
export function lotMatchRecordsIn(workspace: ProbedDatabase): string[] {
  return Object.entries(workspace.stores).flatMap(([store, records]) =>
    /lot.?match/i.test(store) || /"[A-Za-z]*lot-?match[A-Za-z]*"\s*:/i.test(JSON.stringify(records)) ? [store] : [],
  );
}
