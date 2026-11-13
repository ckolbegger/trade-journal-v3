// Shared by the Trade Detail read helpers: the Detail article, and the scoping of a region, a value and a figure to it. Every
// helper reads inside the article, never page-wide (D08P section 6.3).
import type { Locator, Page } from '@playwright/test';

export const detailRoot = (page: Page): Locator => page.locator('.trade-detail');

// A named region (a card) of the Detail.
export const regionOf = (page: Page, name: string | RegExp): Locator =>
  detailRoot(page).getByRole('region', typeof name === 'string' ? { name, exact: true } : { name });

// The definition-list value that follows a term, within a scope.
export const valueIn = (scope: Locator, term: string): Locator => scope.locator(`dt:text-is("${term}") + dd`);

// One figure of a scope, by the figure's term.
export const figureIn = (scope: Locator, term: string): Locator =>
  scope.locator('div', { has: scope.page().locator('dt', { hasText: new RegExp(`^${term}$`) }) }).locator('dd');

// The Journal card, whose title carries its count.
export const journalRegion = (page: Page): Locator => regionOf(page, /^Journal \(\d+\)$/);
