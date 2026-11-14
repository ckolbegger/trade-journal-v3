// Trade Detail reads of drawer lane D6 (Journal): the Plan Reflection, the Journal items and the debts on the card. Each read goes through the
// current layout, scoped to its card. Callers open the Journal drawer first. An Open or Closed Detail lists its entries on the session cards
// (W10 to W13), and a Planned one the Plan card (W11).
import type { Locator, Page } from '@playwright/test';
import { detailRoot, journalRegion, roleOf } from './scope.ts';

export const journal = (page: Page): Locator => journalRegion(page);
// Every entry the cards list (the old Journal card's count, N, is this locator's count).
export const journalEntries = (page: Page): Locator => journalRegion(page).locator('ul.narrative > li');
// The Plan Reflection: the Plan card, on a Planned Detail (W11, revision 96) and once the Trade has been entered.
export const planReflection = (page: Page): Locator => roleOf(detailRoot(page), 'article', { name: 'Plan', exact: true });
// A settled item (an Entry or a decline), which shows its moment on its own line, for the Position Change at a local time.
export const settledItem = (page: Page, when: string): Locator =>
  journalRegion(page).locator('li', { has: page.getByRole('heading', { level: 3 }), hasText: new RegExp(`Moment\\s*${when}`) }).last();
