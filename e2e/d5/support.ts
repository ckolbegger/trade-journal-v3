// Shared support for the D5 browser suite (plan section 6.2): D4's helpers (the Playwright clock that
// also patches Temporal, the production d6 release as the default served build, the Review steps), plus
// the deferred entry, the Debt form, the Review card's reflections, and the Debt records read through the probe.
import type { Locator, Page } from '@playwright/test';
import { debtFormOf, expect, fillRows, openEntryForm, reachPanel, READY, reflectionSection, type CardRef, type ProbedDatabase, type Row } from '../d4/support.ts';

export * from '../d4/support.ts';

// Instants in America/New_York (EDT, UTC-4) used by these cases.
export const MONDAY_1005 = '2026-10-12T14:05:00Z';
export const MONDAY_1100 = '2026-10-12T15:00:00Z';
export const TUESDAY_1005 = '2026-10-13T14:05:00Z';
export const TUESDAY_1230 = '2026-10-13T16:30:00Z';
export const WEDNESDAY_1700 = '2026-10-14T21:00:00Z';

export const MONDAY = 'Mon Oct 12';
export const TUESDAY = 'Tue Oct 13';
export const WEDNESDAY = 'Wed Oct 14';

// A Position Change at 10:00 on Monday (the Plan is dated 09:30 that day).
export const AT_10: Row = { quantity: '100', price: '50.00', fee: '1.00', time: '2026-10-12T10:00' };

// Opens the entry form and fills the rows, leaving the reflection to the caller.
export async function startEntry(page: Page, rows: readonly Row[]): Promise<void> {
  await openEntryForm(page);
  await fillRows(page, rows);
}

// Records a Position Change with Reflect later, ending on its receipt.
export async function deferEntry(page: Page, rows: readonly Row[]): Promise<void> {
  await startEntry(page, rows);
  await reflectionSection(page).getByLabel('Reflect later').check();
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByRole('heading', { name: 'Entry recorded' })).toBeVisible();
}

// ---- The Debt form (Review card and Trade Detail) --------------------------------------------------

export const debtForm = (page: Page): Locator => page.getByRole('form', { name: 'Reflection' });

// The required answers of the Position Change Reflection: As Planned, Calm, confidence 4.
export async function fillDebtAnswers(page: Page): Promise<void> {
  const form = debtForm(page);
  await form.getByRole('radiogroup', { name: 'Decision mode' }).getByLabel('As Planned').check();
  await form.getByRole('radiogroup', { name: 'Primary emotion' }).getByLabel('Calm').check();
  await form.getByRole('radiogroup', { name: 'Decision confidence' }).getByLabel('4').check();
}

// Waits for the form to go, then shows the saved result. On a card the save also moves the card on to its next panel
// (A157), so the Reflections panel is reached again, and the result is read inside it, not anywhere on the page.
async function expectSavedReflection(page: Page, form: Locator, card: CardRef | undefined): Promise<void> {
  let scope: Locator | Page = page;
  if (card !== undefined) {
    await expect(form).toBeHidden(READY);
    scope = await reachPanel(page, card, 'Reflections');
  }
  await expect(scope.getByRole('region', { name: 'Saved reflection' })).toBeVisible();
  await expect(debtForm(page)).toHaveCount(0);
}

// Presses Answer and waits for the saved result to replace the form. With a card it reaches that Trade's Reflections
// panel first; the card is undefined only on Trade Detail, which has no card and shows the form on the page.
export async function answerDebt(page: Page, card: CardRef | undefined): Promise<void> {
  const form = card === undefined ? debtForm(page) : await debtFormOf(page, card);
  await form.getByRole('button', { name: 'Answer', exact: true }).click();
  await expectSavedReflection(page, form, card);
}

// Types a reason (when given), presses Decline, and waits for the saved result. The card is undefined only on Trade Detail.
export async function declineDebt(page: Page, reason: string | undefined, card: CardRef | undefined): Promise<void> {
  const form = card === undefined ? debtForm(page) : await debtFormOf(page, card);
  if (reason !== undefined) await form.getByLabel('Reason for declining (optional)').fill(reason);
  await form.getByRole('button', { name: 'Decline', exact: true }).click();
  await expectSavedReflection(page, form, card);
}

// ---- Stored records, read through the probe --------------------------------------------------------

export interface StoredDebt {
  readonly debtId?: string;
  readonly versions: readonly { readonly outcome?: string; readonly status?: string; readonly kind?: string }[];
}
export interface StoredResolution {
  readonly settledDebtId?: string;
}
export const debtsOf = (workspace: ProbedDatabase): StoredDebt[] => (workspace.stores['journalDebts'] ?? []) as StoredDebt[];
export const entriesWithSettledDebt = (workspace: ProbedDatabase): StoredResolution[] =>
  ((workspace.stores['journalEntries'] ?? []) as StoredResolution[]).filter((e) => e.settledDebtId !== undefined);
export const declinesOf = (workspace: ProbedDatabase): StoredResolution[] => (workspace.stores['journalDeclines'] ?? []) as StoredResolution[];
