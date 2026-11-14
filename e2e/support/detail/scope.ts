// Shared by the Trade Detail read helpers: the Detail article, and the scoping of a region, a value and a figure to it. Every
// helper reads inside the article, never page-wide (D08P section 6.3).
import type { Locator, Page } from '@playwright/test';

export const detailRoot = (page: Page): Locator => page.locator('.trade-detail');

// The cockpit keeps every drawer mounted and hides the unselected ones (T8P.5-B1), and a Playwright role locator leaves out what a hidden panel
// holds. A check that something is GONE (absent from the DOM) must look inside the hidden panels too, so it builds its locator in `anywhere`:
// every role query these helpers make while it runs is made with `includeHidden`. A check that something is only hidden asserts
// `toBeHidden()` on a locator that is not built in `anywhere`, so it still sees only what shows.
type RoleArgs = Parameters<Locator['getByRole']>;
let seeHidden = false;
export const anywhere = <T>(build: () => T): T => {
  seeHidden = true;
  try {
    return build();
  } finally {
    seeHidden = false;
  }
};
export const roleOf = (scope: Locator | Page, role: RoleArgs[0], options: NonNullable<RoleArgs[1]> = {}): Locator =>
  scope.getByRole(role, seeHidden ? { ...options, includeHidden: true } : options);

// A named region (a card) of the Detail.
export const regionOf = (page: Page, name: string | RegExp): Locator =>
  roleOf(detailRoot(page), 'region', typeof name === 'string' ? { name, exact: true } : { name });

// The definition-list value that follows a term, within a scope.
export const valueIn = (scope: Locator, term: string): Locator => scope.locator(`dt:text-is("${term}") + dd`);

// One figure of a scope, by the figure's term.
export const figureIn = (scope: Locator, term: string): Locator =>
  scope.locator('div', { has: scope.page().locator('dt', { hasText: new RegExp(`^${term}$`) }) }).locator('dd');

// The Journal drawer's panel: the session cards (W10 to W13), or the Planned Detail's Plan card. A role query inside it sees only what shows.
export const journalRegion = (page: Page): Locator => detailRoot(page).locator('#drawer-panel-journal');
