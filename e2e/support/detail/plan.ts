// Trade Detail reads of drawer lane D3 (Plan and Risk, and the footer): Plan, Plan Baseline, Entry Quality, 1R, Planned-Leg Fulfillment and
// Deviations. Each read goes through the current layout, scoped to its card. Callers open the Plan and Risk drawer first.
import type { Locator, Page } from '@playwright/test';
import { figureIn, regionOf, valueIn } from './scope.ts';

export const plan = (page: Page): Locator => regionOf(page, 'Plan');
export const planBaseline = (page: Page): Locator => regionOf(page, 'Plan Baseline');
export const entryQuality = (page: Page): Locator => regionOf(page, 'Entry Quality');
export const oneR = (page: Page): Locator => valueIn(planBaseline(page), '1R (original risk)');
export const baselineRewardRisk = (page: Page): Locator => valueIn(planBaseline(page), 'Reward : risk');
export const actualInitialRisk = (page: Page): Locator => valueIn(entryQuality(page), 'Actual initial risk');
export const planFigure = (page: Page, term: string): Locator => figureIn(plan(page), term);
export const planValue = (page: Page, term: string): Locator => valueIn(plan(page), term);

// The footer.
export const fulfillment = (page: Page): Locator => regionOf(page, 'Planned-Leg Fulfillment');
export const deviations = (page: Page): Locator => regionOf(page, 'Deviations');
