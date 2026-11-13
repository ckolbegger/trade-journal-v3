// Trade Detail reads for the browser suites. Every spec reads Detail through `detail`, never with a page-wide locator, so the cockpit
// (D08P) can move each card without a spec changing. A read of content that sits in a drawer opens that drawer first, with `openDrawer`
// and its W1 name; a rail read needs none. Each file is its lane's (plan section 4.2); this one holds `openDrawer` and the full-width banners.
import type { Locator, Page } from '@playwright/test';
import * as journal from './journal.ts';
import * as payoff from './payoff.ts';
import * as plan from './plan.ts';
import * as position from './position.ts';
import * as railA from './rail-a.ts';
import * as railB from './rail-b.ts';
import { detailRoot, regionOf } from './scope.ts';
import * as today from './today.ts';

export type DrawerName = 'Today' | 'Position' | 'Plan and Risk' | 'Price History' | 'Journal' | 'Payoff';

const DRAWER_NAMES: readonly DrawerName[] = ['Today', 'Position', 'Plan and Risk', 'Price History', 'Journal', 'Payoff'];

// A Trade Detail is the page at /trades/<id>. Other pages (the Plan form, the Review) have no Detail and no drawers.
const onTradeDetail = (page: Page): boolean => /^\/trades\/[^/]+\/?$/.test(new URL(page.url()).pathname);

// Waits until the Detail has loaded, since `count()` does not wait and the tab list is part of the loaded Detail. On a page that is no Trade
// Detail it returns at once.
async function settled(page: Page): Promise<void> {
  if (onTradeDetail(page)) await detailRoot(page).waitFor();
}

// Selects a drawer by its tab. It first waits for the Detail to finish loading. A loaded Detail with no tab list (today's layout) shows
// everything, so this then returns.
export async function openDrawer(page: Page, name: DrawerName): Promise<void> {
  await settled(page);
  const tabs = detailRoot(page).getByRole('tablist', { name: 'Detail' });
  if ((await tabs.count()) === 0) return;
  const tab = tabs.getByRole('tab', { name });
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
}

// Runs a read once for each drawer the Detail has (each opened in turn), for a measure that must cover every drawer's content. A Detail with
// no tab list shows everything at once, so the read runs once.
export async function eachDrawer<T>(page: Page, read: () => Promise<T>): Promise<T[]> {
  await settled(page);
  const tabs = detailRoot(page).getByRole('tablist', { name: 'Detail' });
  if ((await tabs.count()) === 0) return [await read()];
  const results: T[] = [];
  for (const name of DRAWER_NAMES) {
    if ((await tabs.getByRole('tab', { name, exact: true }).count()) === 0) continue;
    await openDrawer(page, name);
    results.push(await read());
  }
  return results;
}

// The full-width banners: Records disagree, and Facts can't be replayed.
const banner = (page: Page, name: string): Locator => regionOf(page, name);
const recordsDisagree = (page: Page): Locator => banner(page, 'Records disagree');
const factsIncoherent = (page: Page): Locator => banner(page, "Facts can't be replayed");
const storedVersusExpected = (page: Page): Locator => detailRoot(page).getByRole('table', { name: 'Stored versus expected' });
const factsTable = (page: Page): Locator => detailRoot(page).getByRole('table', { name: 'Facts that cannot be replayed' });

// Every figure grid's money amounts, and the cards, of the Detail (page-wide reads, scoped to the Detail).
const figureAmounts = (page: Page): Locator => detailRoot(page).locator('dl.figure-grid dd.number');
const CARDS = '.trade-detail :is(.card, .table-scroll)';
const TABLES = '.trade-detail table';

export const detail = {
  ...railA,
  ...railB,
  ...today,
  ...position,
  ...plan,
  ...payoff,
  ...journal,
  recordsDisagree,
  factsIncoherent,
  storedVersusExpected,
  factsTable,
  figureAmounts,
  CARDS,
  TABLES,
  root: detailRoot,
};
