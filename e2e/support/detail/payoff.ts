// Trade Detail reads of drawer lane D4 (Payoff): the "Planned" and "Current Expiration Payoff" regions, and the value at expiration at the
// Underlying's latest close. Each read goes through the current layout, scoped to its card. Callers open the Payoff drawer first.
import type { Locator, Page } from '@playwright/test';
import { detailRoot, regionOf, valueIn } from './scope.ts';

export const payoff = (page: Page, kind: 'Planned' | 'Current'): Locator => regionOf(page, `${kind} Expiration Payoff`);
export const payoffChart = (page: Page, kind: 'Planned' | 'Current'): Locator => payoff(page, kind).getByRole('img');
// Every payoff table of the Detail (each chart's text equivalent), by its caption.
export const payoffTables = (page: Page): Locator => detailRoot(page).getByRole('table', { name: / payoff at expiration by / });
export const payoffTable = (page: Page, name: string | RegExp): Locator => detailRoot(page).getByRole('table', { name });
export const latestCloseValue = (page: Page, symbol: string): Locator => valueIn(detailRoot(page), `Value at expiration at ${symbol}'s latest close`);
