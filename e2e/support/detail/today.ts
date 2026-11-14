// Trade Detail reads of drawer lane D1 (Today): the Valuation's Mark and its provenance, the dated "At the … Marks" section (W19) and "At entry".
// Each read goes through the current layout, scoped to its card. Callers open the Today drawer first.
import type { Locator, Page } from '@playwright/test';
import { detailRoot, figureIn, regionOf } from './scope.ts';

// The current Marks card (T8P.31): the Mark with its provenance, a missing or acknowledged one, the Stale context, the Expected Mark Date and the
// Underlying Mark. It stands in Today, and in Position on a state without Today.
export const valuation = (page: Page): Locator => detailRoot(page).locator('.current-marks');
export const todayFigure = (page: Page, term: string): Locator => figureIn(valuation(page), term);
// A Mark that Today's comparison already shows with its provenance (the current-Marks card leaves it out): the first Instrument's price in the
// newer of the two compared sessions.
export const comparedMark = (page: Page): Locator =>
  regionOf(page, /^Marks: /).locator('tbody tr').first().locator('td').nth(1).locator('span').first();
export const dated =(page: Page, heading: string): Locator => regionOf(page, heading);
export const datedHeading = (page: Page, heading: string): Locator => regionOf(page, heading).getByRole('heading', { name: heading, level: 2 });
export const datedFigure = (page: Page, heading: string, term: string): Locator => figureIn(regionOf(page, heading), term);
export const atEntryHeading = (page: Page): Locator => regionOf(page, 'At entry').getByRole('heading', { name: 'At entry', level: 2 });
export const atEntryFigure = (page: Page, term: string): Locator => figureIn(regionOf(page, 'At entry'), term);
