// Trade Detail reads of drawer lane D1 (Today): the Valuation's Mark and its provenance, the dated "At … close" section and "At entry".
// Each read goes through the current layout, scoped to its card. Callers open the Today drawer first.
import type { Locator, Page } from '@playwright/test';
import { figureIn, regionOf } from './scope.ts';

export const valuation = (page: Page): Locator => regionOf(page, 'Valuation');
export const todayFigure = (page: Page, term: string): Locator => figureIn(valuation(page), term);
export const dated = (page: Page, heading: string): Locator => regionOf(page, heading);
export const datedHeading = (page: Page, heading: string): Locator => regionOf(page, heading).getByRole('heading', { name: heading, level: 2 });
export const datedFigure = (page: Page, heading: string, term: string): Locator => figureIn(regionOf(page, heading), term);
export const atEntryHeading = (page: Page): Locator => regionOf(page, 'At entry').getByRole('heading', { name: 'At entry', level: 2 });
export const atEntryFigure = (page: Page, term: string): Locator => figureIn(regionOf(page, 'At entry'), term);
