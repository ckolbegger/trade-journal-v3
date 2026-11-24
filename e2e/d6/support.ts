// Shared support for the D6 browser suite (plan section 6.2): D5R's helpers (the Playwright clock, the production build of the checked-out code as
// the default served build, the card helpers) plus the exit form's steps, the Closed tab, and the stored records an exit leaves.
import type { Locator, Page } from '@playwright/test';
import {
  defineSetup, detail, executionRow, expect, firstPage, FOUR_TRADES, createTrades, LAUNCH, launchAt, MONDAY_1700, onboardedAt, type Profile, type ProbedDatabase, type Row, type Setup,
} from '../d5r/support.ts';

import { answerDebt } from '../d5/support.ts';

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

// The saved setup of T-A (setup-snapshot plan, group 5): onboarded at Mon 10-12 17:00 with createTA's one Trade, built once per worker; each test that asks starts on a copy.
export const T_A_SETUP = defineSetup('d6-t-a', async (profile) => {
  const { context, page } = await onboardedAt(profile, MONDAY_1700);
  return { context, made: await createTA(page) };
});

// Copy T-A, nothing launched: in place of onboardedAt + createTA, for tests that close the setup and launch their own browser. Returns the Trade's id.
export function copyTA(copySetup: <T>(setup: Setup<T>) => Promise<T>): Promise<string> {
  return copySetup(T_A_SETUP);
}

// The copy launched at Mon 10-12 17:00 on the Today screen, for a test that carries on from the setup's page: in place of onboardedAt + createTA.
export async function openTA(profile: Profile, copySetup: <T>(setup: Setup<T>) => Promise<T>) {
  await copyTA(copySetup);
  const context = await launchAt(profile, MONDAY_1700);
  const page = await firstPage(context);
  await page.goto('/');
  return { context, page };
}

// A Row for an exit.
export const sell = (quantity: string, price: string, fee: string, time: string): Row => ({ quantity, price, fee, time });

// ---- The exit form (?action=Sell) ---------------------------------------------------------------------------------------

export async function openExitForm(page: Page): Promise<void> {
  await detail.recordExitLink(page).click();
  await expect(page.getByRole('heading', { name: 'Record exit', level: 1 })).toBeVisible(LAUNCH);
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

// The Close Review's required answers inside a section or form: Yes, as planned, and the key lesson (required since manifest 6).
export async function answerCloseReviewIn(section: Locator): Promise<void> {
  await section.getByRole('radiogroup', { name: 'Would you take this Trade again under similar conditions?' }).getByLabel('Yes, as planned').check();
  await section.getByLabel('What is the key lesson?').fill('Stick to the Plan.');
}

// The exit's own reflection as a sale gives it: the three answers (behind "Add more") and a fixed answer to the question a sale
// that leaves the Plan asks (D9.5 A312, T95.39). The question sits under "Against the Plan", so it is found on the page, and
// it is filled where the form shows it.
export async function answerSaleIn(section: Locator): Promise<void> {
  const more = section.getByRole('button', { name: 'Add more' });
  if ((await more.count()) > 0 && (await more.getAttribute('aria-expanded')) === 'false') await more.click();
  await answerIn(section);
  const reason = section.page().getByLabel(/^Why (did you leave the Plan|only part)\?$/);
  if ((await reason.count()) > 0) await reason.fill('Stopped out early.');
}

// A sale that leaves the Plan, saved at once with its reflection put off: "Say why later" beside the question (W154).
export async function sayWhyLater(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Say why later' }).click();
}

// A Close Review put off at the sale, answered afterwards on the Trade's Detail through its Debt: from the Needs you rail to the
// saved answer. The Trade's Detail must be open.
export async function answerCloseReviewOnDetail(page: Page): Promise<void> {
  await detail.reflectNowButton(page).click();
  await answerCloseReviewIn(detail.debtForm(page));
  await answerDebt(page, undefined, 'Detail');
}

// Answers the exit's own reflection and the Closing the Trade section of an exit that sells every share: Target Reached. The
// Close Review is put off at the sale whatever is chosen (A312, T95.39: the form offers no choice). A spec whose subject is the
// Close Review's answer gives it afterwards through the Debt.
export async function closeTheTrade(page: Page): Promise<void> {
  await answerSaleIn(exitReflection(page));
  await expect(closingSection(page)).toBeVisible();
  await closeReasonGroup(page).getByLabel('Target Reached', { exact: true }).check();
}

export const receiptResult = (page: Page): Locator => page.getByRole('region', { name: 'Result' });

// ---- Trade Detail and the Closed tab ------------------------------------------------------------------------------------

// The text of the definition-list value that follows a term, within a scope. Never page-wide: a Trade Detail's values are read
// through `detail` (plan section 6.3), so this takes a card or panel, such as a receipt's Result.
export const valueOf = (scope: Locator, term: string): Locator => scope.locator(`dt:text-is("${term}") + dd`);

export async function openClosedTab(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Closed' }).click();
  await expect(page.getByRole('table', { name: 'Closed Trades' })).toBeVisible(LAUNCH);
}

// ---- Stored records, read through the probe ----------------------------------------------------------------------------

export const factKindsOf = (trade: { readonly facts: readonly { readonly kind: string }[] }): string[] => trade.facts.map((f) => f.kind);

// Where the Workspace holds a Lot-Match record: a store named for one, or a stored key named for one. None may (P23).
export function lotMatchRecordsIn(workspace: ProbedDatabase): string[] {
  return Object.entries(workspace.stores).flatMap(([store, records]) =>
    /lot.?match/i.test(store) || /"[A-Za-z]*lot-?match[A-Za-z]*"\s*:/i.test(JSON.stringify(records)) ? [store] : [],
  );
}
