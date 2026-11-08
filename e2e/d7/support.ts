// Shared support for the D7 browser suite (plan section 6.2): D6's helpers (which re-export D5R's, D5's, D4's and D2's), the faults
// build as the served build, and the option steps: the option Plan form and the option exit. Dates follow the breakdown's fixtures:
// every contract expires Friday 2026-11-20 (EST, UTC-5).
import type { Locator, Page } from '@playwright/test';
import { expect, fillRows, READY, test as d1Test, type Row } from '../d6/support.ts';

export * from '../d6/support.ts';

// Routine D7 cases run the faults build, which the D1 default server serves and which builds from the current source.
export const test = d1Test;

// Instants. October is EDT (UTC-4); from 2026-11-01 the Workspace zone is EST (UTC-5).
export const MONDAY_0900 = '2026-10-12T13:00:00Z';
export const MONDAY_1105 = '2026-10-12T15:05:00Z';
export const TUESDAY_1030 = '2026-10-13T14:30:00Z';
export const FRIDAY_NOV_1700 = '2026-11-20T22:00:00Z';
export const MONDAY_NOV_1700 = '2026-11-23T22:00:00Z';

export interface OptionPlanValues {
  readonly strategy: 'Long Call' | 'Long Put' | 'Cash-Secured Put';
  readonly underlying: string;
  readonly expiration: string;
  readonly strike: string;
  readonly contracts: string;
  readonly entry: string;
  readonly stop: string;
  readonly target: string;
}

// O-C: 2 Calls at 2.00, Stop XYZ at or below 48.00, Target at or above 60.00.
export const OC: OptionPlanValues = { strategy: 'Long Call', underlying: 'XYZ', expiration: '2026-11-20', strike: '55', contracts: '2', entry: '2.00', stop: '48', target: '60' };
// O-S: 2 short Puts at 1.20, Stop MNO at or below 42.00, Target at or above 50.00.
export const OS: OptionPlanValues = { strategy: 'Cash-Secured Put', underlying: 'MNO', expiration: '2026-11-20', strike: '45', contracts: '2', entry: '1.20', stop: '42', target: '50' };

const primary = (page: Page): Locator => page.getByRole('navigation', { name: 'Primary' });

// Fills the option Plan form and its reflection (Conviction 4, Calm).
export async function fillOptionPlan(page: Page, values: OptionPlanValues): Promise<void> {
  await primary(page).getByRole('link', { name: 'New Plan' }).click();
  await expect(page.getByRole('heading', { name: 'New Plan' })).toBeVisible(READY);
  await page.getByLabel('Strategy').selectOption({ label: values.strategy });
  await page.getByLabel('Underlying', { exact: true }).fill(values.underlying);
  await page.getByLabel('Expiration date').fill(values.expiration);
  await page.getByLabel('Strike').fill(values.strike);
  await page.getByLabel('Contracts').fill(values.contracts);
  await page.getByLabel('Intended entry price (per share)').fill(values.entry);
  await page.getByLabel(/^Stop \(/).fill(values.stop);
  await page.getByLabel(/^Target \(/).fill(values.target);
  await page.getByLabel('Why this trade, why now?').fill('Earnings run-up with defined risk.');
  await page.getByLabel('What would invalidate the thesis?').fill('A close below the Stop.');
  await page.getByRole('radiogroup', { name: 'Conviction' }).getByLabel('4').check();
  await page.getByRole('radiogroup', { name: 'Primary emotion' }).getByLabel('Calm').check();
}

// Fills and confirms an option Plan at the pinned clock, ending on its Trade Detail.
export async function confirmOptionPlan(page: Page, values: OptionPlanValues): Promise<void> {
  await fillOptionPlan(page, values);
  await page.getByRole('button', { name: 'Confirm Plan' }).click();
  await expect(page.getByRole('heading', { name: values.underlying, level: 1 })).toBeVisible(READY);
}

// From a Trade Detail, opens the exit form (a Buy to close or Sell to close), fills its rows and its reflection.
export async function fillOptionExit(page: Page, rows: readonly Row[]): Promise<void> {
  await page.getByRole('link', { name: 'Record exit' }).click();
  await expect(page.getByRole('heading', { name: 'Record exit', level: 1 })).toBeVisible(READY);
  await fillRows(page, rows);
  const section = page.getByRole('region', { name: 'Reflection on this exit' });
  await section.getByRole('radiogroup', { name: 'Decision mode' }).getByLabel('As Planned').check();
  await section.getByRole('radiogroup', { name: 'Primary emotion' }).getByLabel('Calm').check();
  await section.getByRole('radiogroup', { name: 'Decision confidence' }).getByLabel('4').check();
}
