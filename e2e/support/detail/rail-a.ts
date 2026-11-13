// Trade Detail reads of rail lane R1: the identity (the h1, the lifecycle badge, Record entry, Record exit) and the P&L figures. Each
// read goes through the current layout, scoped to its card. The rail's identity and P&L cards replace the content behind these names (T8P.12, T8P.13).
import type { Locator, Page } from '@playwright/test';
import { detailRoot, figureIn, regionOf, valueIn } from './scope.ts';

export const heading = (page: Page, name: string): Locator => detailRoot(page).getByRole('heading', { name, level: 1 });
export const identityCard = (page: Page): Locator => detailRoot(page).locator('header');
export const lifecycleBadge = (page: Page): Locator => identityCard(page).locator('.badge');
export const lifecycle = (page: Page, text: string): Locator => identityCard(page).getByText(text, { exact: true });
export const recordEntryLink = (page: Page): Locator => identityCard(page).getByRole('link', { name: 'Record entry' });
export const recordExitLink = (page: Page): Locator => identityCard(page).getByRole('link', { name: 'Record exit' });

// The Summary card, until T8P.22 retires it.
export const summary = (page: Page): Locator => regionOf(page, 'Summary');
export const summaryValue = (page: Page, term: string): Locator => valueIn(summary(page), term);

// The P&L: the Trade's current Marked P&L (now a figure of Valuation), and the Result a Closed Trade shows.
export const currentMarkedPnl = (page: Page): Locator => figureIn(regionOf(page, 'Valuation'), 'Current Marked Trade P&L');
export const result = (page: Page): Locator => regionOf(page, 'Result');
export const resultHeading = (page: Page): Locator => detailRoot(page).getByRole('heading', { name: 'Result' });
export const resultValue = (page: Page, term: string): Locator => valueIn(detailRoot(page), term);
