// Trade Detail reads of rail lane R1: the identity (the h1, the lifecycle badge, Record entry, Record exit) and the P&L figures. Each
// read goes through the current layout, scoped to its card. The rail's identity and P&L cards replace the content behind these names (T8P.12, T8P.13).
import type { Locator, Page } from '@playwright/test';
import { detailRoot, regionOf, roleOf, valueIn } from './scope.ts';

export const heading = (page: Page, name: string): Locator => detailRoot(page).getByRole('heading', { name, level: 1 });
export const identityCard = (page: Page): Locator => detailRoot(page).locator('header');
export const lifecycleBadge = (page: Page): Locator => identityCard(page).locator('.badge');
// The lifecycle word, read from the badge's "<Strategy>, <Lifecycle>" (W2).
export const lifecycle = (page: Page, text: string): Locator => lifecycleBadge(page).filter({ hasText: new RegExp(`, ${text}$`) });
export const recordEntryLink = (page: Page): Locator => roleOf(identityCard(page), 'link', { name: 'Record entry' });
export const recordExitLink = (page: Page): Locator => roleOf(identityCard(page), 'link', { name: 'Record exit' });

// The Trade Summary line ("Long 100 shares @ $50.00"): the Position drawer's on an Open or Closed Detail, and Plan and Risk's on a Planned one
// (T8P.31). Open that drawer first.
export const tradeSummary = (page: Page): Locator => detailRoot(page).locator('.summary-text');

// The P&L card (W3, W4): its figure (an Open Trade's Trade P&L, a Closed Trade's realized P&L), the line beneath it, and the Result rows a
// Closed Trade shows. The Position drawer has no Result region (T8P.23-B1), so `resultHeading` is read only to assert it absent.
export const pnlCard = (page: Page): Locator => regionOf(page, 'Trade P&L');
export const pnlFigure = (page: Page): Locator => pnlCard(page).locator('.pnl-figure');
export const pnlLine = (page: Page): Locator => pnlCard(page).locator('.pnl-line');
export const currentMarkedPnl = pnlFigure;
export const result = (page: Page): Locator => pnlCard(page).locator('.pnl-result');
export const resultHeading = (page: Page): Locator => roleOf(detailRoot(page), 'heading', { name: 'Result' });
export const resultValue = (page: Page, term: string): Locator => valueIn(pnlCard(page), term);
