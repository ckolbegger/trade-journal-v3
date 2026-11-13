// Trade Detail reads of drawer lane D6 (Journal): the Plan Reflection, the Journal items and the debts on the card. Each read goes through the
// current layout, scoped to its card. Callers open the Journal drawer first.
import type { Locator, Page } from '@playwright/test';
import { journalRegion, regionOf } from './scope.ts';

export const journal = (page: Page): Locator => journalRegion(page);
export const journalOf = (page: Page, count: number): Locator => regionOf(page, `Journal (${count})`);
export const planReflection = (page: Page): Locator => regionOf(page, 'Plan Reflection');
// A settled item (an Entry or a decline), which shows its moment on its own line, for the Position Change at a local time.
export const settledItem = (page: Page, when: string): Locator =>
  journalRegion(page).locator('li', { has: page.getByRole('heading', { level: 3 }), hasText: new RegExp(`Moment\\s*${when}`) }).last();
