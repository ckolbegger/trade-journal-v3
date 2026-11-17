// Trade Detail reads of drawer lane D1 (Today): the Marks table and its notes. Each read goes through the current layout, scoped to its card.
// Callers open the Today drawer first.
import type { Locator, Page } from '@playwright/test';
import { detailRoot, regionOf, roleOf } from './scope.ts';

// W29's Marks table on Today (every state, T8R.6 and T8R.7), its headings, and one cell by its row ("XYZ Mark", "Call Mark") and column.
export const marksTable = (page: Page): Locator => roleOf(detailRoot(page), 'table', { name: 'Marks', exact: true });
export const marksHeadings = (page: Page): Locator => marksTable(page).locator('thead th');
const MARKS_COLUMN = { Today: 1, Yesterday: 2, Change: 3 } as const;
export const marksCell = (page: Page, row: string, column: keyof typeof MARKS_COLUMN): Locator =>
  marksTable(page).locator('tbody tr').filter({ has: page.locator('th', { hasText: new RegExp(`^${row}$`) }) }).locator('td').nth(MARKS_COLUMN[column] - 1);
// The Stale context and the acknowledgment, under the table.
export const marksNotes = (page: Page): Locator => detailRoot(page).locator('#drawer-panel-today .grid-note');
// A card by its heading, for asserting the figure cards that left Today are gone: "At entry" (T8R.12 and T8R.10) and "At the … Marks" (T8R.13).
export const todayCard = (page: Page, heading: string): Locator => regionOf(page, heading);
