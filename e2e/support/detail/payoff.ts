// Trade Detail reads of drawer lane D4 (Payoff): the one "Expiration Payoff" chart, the "Planned" and "Current Expiration Payoff" regions (each
// line's text-equivalent table), and the value at expiration at the Underlying's latest Mark. Each read goes through the current layout, scoped
// to its card. Callers open the Payoff drawer first.
import type { Locator, Page } from '@playwright/test';
import { detailRoot, regionOf, valueIn } from './scope.ts';

// The drawer: its chart, its tables, and the one line of a Trade with no option expiration.
export const payoffDrawer = (page: Page): Locator => regionOf(page, 'Expiration Payoff');
export const payoff = (page: Page, kind: 'Planned' | 'Current'): Locator => regionOf(page, `${kind} Expiration Payoff`);
// The one chart both lines are drawn on (W14), named by the captions of the tables that are its text equivalents.
// The kind stays a parameter so each spec's call reads the same as before; both lines share the chart.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const payoffChart = (page: Page, _kind?: 'Planned' | 'Current'): Locator => payoffDrawer(page).getByRole('img');
// Every payoff table of the Detail (each line's text equivalent), by its caption.
export const payoffTables = (page: Page): Locator => detailRoot(page).getByRole('table', { name: / payoff at expiration by / });
export const payoffTable = (page: Page, name: string | RegExp): Locator => detailRoot(page).getByRole('table', { name });
export const latestCloseValue = (page: Page, symbol: string): Locator => valueIn(detailRoot(page), `Value at expiration at ${symbol}'s latest Mark`);
